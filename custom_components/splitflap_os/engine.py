"""The Split-Flap OS app engine.

The engine owns the long-running display loop: it renders pages, publishes
them through the MQTT coordinator, waits for the slowest module to arrive, and
then advances to the next page.  All app providers are plain asynchronous
functions, which keeps them easy to test and easy to add.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Awaitable, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import aiohttp
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .apps import APP_DEFS_BY_KEY, APP_PROVIDERS, app_defs
from .const import (
    DEFAULT_SETTINGS,
    DOMAIN,
    ENGINE_STORAGE_VERSION,
    SETTINGS_GROUPS,
    SETTINGS_KEYS,
    STORAGE_SAVE_DELAY,
    VERSION,
    signal_update,
)
from .coordinator import SplitFlapCoordinator
from .layout import (
    Layout,
    app_fits,
    compose_board,
    estimate_rotation_seconds,
    format_lines,
    order_indices,
    parse_row_counts,
    resolve_layout,
    unknown_characters,
)
from .models import Page
from .settings import settings_for_ui

_LOGGER = logging.getLogger(__name__)

PageProvider = Callable[["AppEngine", datetime], Awaitable[list[Page] | Page | None]]


class AppEngine:
    """Render pages and run the active app or playlist."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        coordinator: SplitFlapCoordinator,
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.coordinator = coordinator
        self.signal = signal_update(entry.entry_id)

        self.settings: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self.saved_playlists: dict[str, dict[str, Any]] = {}
        self.playlist: list[Page] = []
        self.playlist_delay = 5.0

        self.mode = "idle"  # idle | playlist | app
        self.active_app: str | None = None
        self._loop_playlist = True
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_locks: dict[str, asyncio.Lock] = {}

        self._last_lines: list[str] = []
        self._last_board = ""
        self._last_text = ""
        self._last_style: str | None = None
        self._last_speed: int | None = None
        self._current_page: dict[str, Any] | None = None
        self._current_page_index = 0
        self._current_page_count = 0
        self._layout_cache_key: tuple[Any, ...] | None = None
        self._layout_cache: Layout | None = None

        self._store: Store[dict[str, Any]] = Store(
            hass, ENGINE_STORAGE_VERSION, f"{DOMAIN}.engine.{entry.entry_id}"
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def async_setup(self) -> None:
        try:
            stored = await self._store.async_load()
        except Exception:  # noqa: BLE001 - restore must never block setup
            _LOGGER.exception("Could not restore Split-Flap OS settings")
            stored = None

        if isinstance(stored, dict):
            raw_settings = stored.get("settings")
            if isinstance(raw_settings, dict):
                self.settings.update(
                    {
                        key: value
                        for key, value in raw_settings.items()
                        if key in SETTINGS_KEYS
                    }
                )
            playlists = stored.get("saved_playlists")
            if isinstance(playlists, dict):
                self.saved_playlists = {
                    str(name): self._sanitize_saved_playlist(value)
                    for name, value in playlists.items()
                }
            playlist = stored.get("playlist")
            if isinstance(playlist, list):
                self.playlist = [Page.from_dict(item) for item in playlist][:100]
            try:
                self.playlist_delay = float(stored.get("playlist_delay", 5))
            except (TypeError, ValueError):
                self.playlist_delay = 5.0

    async def async_unload(self) -> None:
        await self.async_stop(notify=False)
        try:
            await self._store.async_save(self._state_snapshot())
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Could not save Split-Flap OS settings")

    # ------------------------------------------------------------------
    # Public state
    # ------------------------------------------------------------------
    @property
    def tz(self) -> ZoneInfo:
        name = str(self.settings.get("timezone") or self.hass.config.time_zone or "UTC")
        try:
            return ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            return ZoneInfo("UTC")

    @property
    def unit_system(self) -> str:
        configured = str(self.settings.get("units", "auto")).lower()
        if configured in {"metric", "imperial"}:
            return configured
        is_metric = getattr(self.hass.config.units, "is_metric", True)
        return "metric" if is_metric else "imperial"

    @property
    def layout(self) -> Layout:
        rows = self.settings.get("rows", 0)
        cols = self.settings.get("cols", 0)
        row_counts = self.settings.get("row_counts", "")
        key = (self.coordinator.modules_count, rows, cols, str(row_counts))
        if self._layout_cache_key != key or self._layout_cache is None:
            self._layout_cache = resolve_layout(
                self.coordinator.modules_count,
                rows,
                cols,
                row_counts,
            )
            self._layout_cache_key = key
        return self._layout_cache

    @property
    def board(self) -> tuple[int, int]:
        layout = self.layout
        return layout.rows, layout.cols

    @property
    def rows(self) -> int:
        return self.board[0]

    @property
    def cols(self) -> int:
        return self.board[1]

    @property
    def session(self) -> aiohttp.ClientSession:
        return async_get_clientsession(self.hass)

    @property
    def http_timeout(self) -> aiohttp.ClientTimeout:
        return aiohttp.ClientTimeout(total=15)

    def get_setting(self, key: str, default: Any = None) -> Any:
        return self.settings.get(key, DEFAULT_SETTINGS.get(key, default))

    def lines(self, *values: object) -> str:
        return "\n".join(format_lines(values, self.rows, self.cols))

    def app_status(self, app_key: str) -> dict[str, Any]:
        app = APP_DEFS_BY_KEY.get(str(app_key))
        if app is None:
            return {
                "key": str(app_key),
                "available": False,
                "unavailable_reason": f"Unknown app: {app_key}",
            }
        available, reason = self._app_available(app)
        return {
            **app.as_dict(),
            "available": available,
            "unavailable_reason": reason,
        }

    def _app_available(self, app: Any) -> tuple[bool, str]:
        if isinstance(app, dict):
            min_rows = int(app.get("min_rows") or 1)
            min_cols = int(app.get("min_cols") or 1)
        else:
            min_rows = int(getattr(app, "min_rows", 1) or 1)
            min_cols = int(getattr(app, "min_cols", 1) or 1)
        layout = self.layout
        if layout.error:
            if min_rows <= 1 and min_cols <= 1:
                return True, ""
            return False, f"Fix the display layout first: {layout.error}"
        return app_fits(layout, min_rows, min_cols)

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def snapshot(self) -> dict[str, Any]:
        rows, cols = self.board
        layout = self.layout
        lines = list(self._last_lines)
        if len(lines) != rows or any(len(line) != cols for line in lines):
            lines = [" " * cols for _ in range(rows)]
        apps = [
            {**app, **self._app_status_dict(app)}
            for app in app_defs()
        ]
        return {
            "mode": self.mode,
            "active_app": self.active_app,
            "running": self.running,
            "board": {
                "rows": rows,
                "cols": cols,
                "module_count": self.coordinator.modules_count,
                **{
                    key: value
                    for key, value in layout.as_board_dict().items()
                    if key not in {"rows", "cols"}
                },
            },
            "display": {
                "lines": lines,
                "chars": "".join(lines),
                "text": self._last_text,
            },
            "playlist": [page.as_dict() for page in self.playlist],
            "playlist_delay": self.playlist_delay,
            "saved_playlists": self.saved_playlists,
            "settings": settings_for_ui(self.settings),
            "settings_groups": SETTINGS_GROUPS,
            "apps": apps,
            "current_page": self._current_page,
            "current_page_index": self._current_page_index,
            "current_page_count": self._current_page_count,
        }

    def _app_status_dict(self, app: Any) -> dict[str, Any]:
        available, reason = self._app_available(app)
        return {
            "available": available,
            "unavailable_reason": reason,
        }

    # ------------------------------------------------------------------
    # Settings / playlists
    # ------------------------------------------------------------------
    async def async_set_settings(self, updates: dict[str, Any]) -> dict[str, Any]:
        cleaned: dict[str, Any] = {}
        for key, value in (updates or {}).items():
            if key not in SETTINGS_KEYS:
                continue
            if key in {"rows", "cols"}:
                try:
                    cleaned[key] = max(0, min(100, int(value)))
                except (TypeError, ValueError):
                    continue
            elif key == "row_counts":
                try:
                    counts = parse_row_counts(value)
                except ValueError as err:
                    raise ValueError(str(err)) from err
                cleaned[key] = ",".join(str(count) for count in counts)
            elif key == "ui_scale":
                try:
                    cleaned[key] = max(50, min(200, int(float(value))))
                except (TypeError, ValueError):
                    continue
            elif key == "page_delay":
                try:
                    cleaned[key] = max(0.1, min(120.0, float(value)))
                except (TypeError, ValueError):
                    continue
            else:
                cleaned[key] = value

        candidate = {**self.settings, **cleaned}
        layout_keys = {"rows", "cols", "row_counts"}
        layout = resolve_layout(
            self.coordinator.modules_count,
            candidate.get("rows", 0),
            candidate.get("cols", 0),
            candidate.get("row_counts", ""),
        )
        if layout.error and layout_keys.intersection(cleaned):
            raise ValueError(layout.error)

        self.settings.update(cleaned)
        self._layout_cache_key = None
        self._layout_cache = None
        self._cache.clear()

        if self.mode == "app" and self.active_app:
            app = APP_DEFS_BY_KEY.get(self.active_app)
            if app is not None and not self._app_available(app)[0]:
                await self.async_stop(notify=False)

        await self._store.async_save(self._state_snapshot())
        self._notify()
        return settings_for_ui(self.settings)

    async def async_save_playlist(
        self, name: str, pages: list[Any], delay: float = 5.0
    ) -> None:
        clean_name = str(name or "").strip()[:64]
        if not clean_name:
            raise ValueError("Playlist name is required")
        self.saved_playlists[clean_name] = {
            "pages": [Page.from_dict(page).as_dict() for page in (pages or [])][:100],
            "delay": float(delay or 5.0),
        }
        await self._store.async_save(self._state_snapshot())
        self._notify()

    async def async_delete_playlist(self, name: str) -> None:
        self.saved_playlists.pop(str(name), None)
        await self._store.async_save(self._state_snapshot())
        self._notify()

    async def async_run_saved_playlist(self, name: str) -> None:
        saved = self.saved_playlists.get(str(name))
        if not saved:
            raise ValueError(f"Unknown playlist: {name}")
        pages = [Page.from_dict(page) for page in saved.get("pages", [])]
        await self.async_play_playlist(pages, saved.get("delay", 5.0), loop=True)

    # ------------------------------------------------------------------
    # Display control
    # ------------------------------------------------------------------
    async def async_send_text(
        self,
        text: str,
        *,
        start: int = 1,
        style: str = "ltr",
        speed: int = 15,
        stop: bool = True,
        raw: bool = False,
    ) -> None:
        rows, cols = self.board
        try:
            offset = max(0, int(start) - 1)
        except (TypeError, ValueError):
            offset = 0
        value = (" " * offset) + str(text or "")
        lines, board = compose_board(value, rows, cols, raw=raw)
        page_style = style if style in {
            "ltr",
            "rtl",
            "columns",
            "center_out",
            "outside_in",
            "diagonal",
            "random",
            "rain",
            "spiral",
        } else "ltr"
        page = Page(
            text=str(text or ""),
            raw=raw,
            style=page_style,
            speed=int(speed) if speed not in (None, "") else None,
            start=0,
        )

        # Validate before stopping the current display so a rejected message
        # leaves whatever is already on the board untouched.
        self._validate_board(board, page_style)

        if stop:
            await self.async_stop(notify=False)

        await self._publish_board(lines, board, page_style, page)
        self._last_style = page_style
        self._last_speed = page.speed
        self._current_page = {**page.as_dict(), "lines": lines}
        self._current_page_index = 0
        self._current_page_count = 1
        if not raw:
            self._last_text = str(text or "")
        self._notify()
        self._schedule_save()

    async def async_play_playlist(
        self,
        pages: list[Page | dict[str, Any] | str],
        delay: float = 5.0,
        *,
        loop: bool = True,
    ) -> None:
        prepared = [Page.from_dict(page) for page in (pages or [])][:100]
        # Check every page up front so a playlist cannot start with a
        # character that the current drums cannot show.
        for page in prepared:
            self._validate_page(page)

        await self.async_stop(notify=False)
        self.playlist = prepared
        try:
            self.playlist_delay = max(0.1, float(delay or 5.0))
        except (TypeError, ValueError):
            self.playlist_delay = 5.0
        self._loop_playlist = bool(loop)
        self.mode = "playlist"
        self.active_app = None
        self._current_page = None
        self._current_page_index = 0
        self._current_page_count = len(self.playlist)
        self._start_runner()
        self._notify()
        self._schedule_save()

    async def async_start_app(self, app_key: str) -> None:
        key = str(app_key or "").strip()
        app = APP_DEFS_BY_KEY.get(key)
        if app is None:
            raise ValueError(f"Unknown app: {app_key}")
        available, reason = self._app_available(app)
        if not available:
            raise ValueError(f"{app.name} cannot run on this display: {reason}")
        await self.async_stop(notify=False)
        self.mode = "app"
        self.active_app = key
        self._current_page = None
        self._current_page_index = 0
        self._current_page_count = 0
        self._start_runner()
        self._notify()
        self._schedule_save()

    async def async_stop(self, *, notify: bool = True) -> None:
        self.mode = "idle"
        self.active_app = None
        self._loop_playlist = False
        self._stop_event.set()

        task = self._task
        self._task = None
        if task is not None and task is not asyncio.current_task():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass

        self._stop_event = asyncio.Event()
        self._current_page = None
        self._current_page_index = 0
        self._current_page_count = 0
        if notify:
            self._notify()
            self._schedule_save()

    async def async_home_all(self) -> None:
        await self.async_stop(notify=False)
        await self.coordinator.async_home_all()
        self._notify()

    # ------------------------------------------------------------------
    # Runner
    # ------------------------------------------------------------------
    def _start_runner(self) -> None:
        if self.running:
            return
        self._stop_event = asyncio.Event()
        self._task = self.hass.async_create_task(self._runner())

    async def _runner(self) -> None:
        try:
            while self.mode != "idle":
                pages = await self._pages_for_cycle()
                if self._stop_event.is_set() or self.mode == "idle":
                    break
                if not pages:
                    await self._sleep(1.0)
                    continue

                self._current_page_count = len(pages)
                for index, page in enumerate(pages):
                    if self._stop_event.is_set() or self.mode == "idle":
                        break
                    self._current_page_index = index
                    rotation = await self._display_page(page)
                    delay = page.delay
                    if delay is None:
                        delay = self._default_delay()
                    await self._sleep(max(0.05, rotation) + max(0.0, float(delay or 0)))

                if self.mode == "playlist" and not self._loop_playlist:
                    self.mode = "idle"
                    self.active_app = None
                    break
        except asyncio.CancelledError:
            pass
        except Exception:  # noqa: BLE001 - a bad app must not kill the loop forever
            _LOGGER.exception("Split-Flap OS display loop failed")
        finally:
            if self._task is asyncio.current_task():
                self._task = None
            self._notify_safe()

    async def _pages_for_cycle(self) -> list[Page]:
        if self.mode == "playlist":
            return list(self.playlist)

        if self.mode != "app" or not self.active_app:
            return []

        provider = APP_PROVIDERS.get(self.active_app)
        if provider is None:
            return [Page(self.lines("APP NOT FOUND", self.active_app, ""))]

        app = APP_DEFS_BY_KEY.get(self.active_app)
        if app is not None and not self._app_available(app)[0]:
            _LOGGER.warning(
                "Stopping %s: it no longer fits the display layout",
                self.active_app,
            )
            self.mode = "idle"
            self.active_app = None
            return []

        try:
            result = await provider(self, datetime.now(self.tz))
        except Exception as err:  # noqa: BLE001 - show an error page
            _LOGGER.exception("App %s failed", self.active_app)
            return [
                Page(
                    self.lines(
                        "APP ERROR",
                        self.active_app.upper()[: self.cols],
                        str(err)[: self.cols].upper(),
                    ),
                    delay=10.0,
                )
            ]

        if result is None:
            return []
        if isinstance(result, Page):
            result = [result]
        return [page if isinstance(page, Page) else Page.from_dict(page) for page in result]

    async def _display_page(self, page: Page) -> float:
        rows, cols = self.board
        text = page.text
        if page.start:
            text = (" " * page.start) + text

        lines, board = compose_board(text, rows, cols, raw=page.raw)
        style = page.style or "ltr"

        if (
            not page.resend
            and board == self._last_board
            and style == self._last_style
            and page.speed == self._last_speed
        ):
            self._current_page = {**page.as_dict(), "lines": lines}
            if not page.raw:
                self._last_text = page.text
            return 0.0

        rotation = await self._publish_board(lines, board, style, page)
        self._last_style = style
        self._last_speed = page.speed
        self._current_page = {**page.as_dict(), "lines": lines}
        if not page.raw:
            self._last_text = page.text
        return rotation

    def _mapped_chars(
        self, board: str, style: str
    ) -> tuple[dict[str, str], list[str]]:
        """Map board cells to module ids and build the send order."""

        rows, cols = self.board
        layout = self.layout
        module_ids = self.coordinator.module_ids
        if not module_ids:
            # Before the first scan, assume the stock 1-based ids.  The master
            # ignores ids that do not answer, so this is harmless.
            module_ids = [
                str(index + 1) for index in range(layout.module_count or rows * cols)
            ]

        char_by_id: dict[str, str] = {}
        for cell, slot in enumerate(layout.cell_slots):
            if slot is None or slot >= len(module_ids):
                continue
            module_id = module_ids[slot]
            char_by_id[module_id] = board[cell] if cell < len(board) else " "

        order = order_indices(style, rows, cols)
        order_ids: list[str] = []
        for cell in order:
            if cell >= len(layout.cell_slots):
                continue
            slot = layout.cell_slots[cell]
            if slot is None or slot >= len(module_ids):
                continue
            module_id = module_ids[slot]
            if module_id not in order_ids:
                order_ids.append(module_id)
        for module_id in module_ids:
            if module_id not in order_ids:
                order_ids.append(module_id)
        return char_by_id, order_ids

    def _validate_chars(self, char_by_id: dict[str, str]) -> None:
        """Reject characters that a module's reported drum cannot show."""

        drums = {
            module_id: self.coordinator.flap_list_for(module_id)
            for module_id in char_by_id
        }
        missing = unknown_characters(char_by_id, drums)
        if not missing:
            return

        details = "; ".join(
            f"module {module_id} lacks {', '.join(repr(char) for char in chars)}"
            for module_id, chars in missing.items()
        )
        raise ValueError(
            f"Cannot display: {details}. Use a character from the module's "
            "drum or update its flap list in Tuning."
        )

    def _validate_board(self, board: str, style: str) -> None:
        char_by_id, _ = self._mapped_chars(board, style)
        self._validate_chars(char_by_id)

    def _validate_page(self, page: Page) -> None:
        rows, cols = self.board
        text = page.text
        if page.start:
            text = (" " * page.start) + text
        _, board = compose_board(text, rows, cols, raw=page.raw)
        self._validate_board(board, page.style or "ltr")

    async def _publish_board(
        self,
        lines: list[str],
        board: str,
        style: str,
        page: Page,
    ) -> float:
        char_by_id, order_ids = self._mapped_chars(board, style)

        previous = dict(self.coordinator.desired_chars)
        drums = {
            module_id: self.coordinator.drum_for(module_id)
            for module_id in char_by_id
        }
        rotation = estimate_rotation_seconds(previous, char_by_id, drums)

        await self.coordinator.async_show_chars(
            char_by_id, order_ids, speed=page.speed
        )

        self._last_lines = list(lines)
        self._last_board = board
        self._current_page = {**page.as_dict(), "lines": list(lines)}
        self._notify()
        return rotation

    def _default_delay(self) -> float:
        if self.mode == "app" and self.active_app:
            for app in app_defs():
                if app["key"] == self.active_app:
                    return float(app.get("default_delay", 5.0))
        try:
            return float(self.settings.get("page_delay", 5.0) or 5.0)
        except (TypeError, ValueError):
            return 5.0

    async def _sleep(self, seconds: float) -> None:
        if seconds <= 0:
            await asyncio.sleep(0)
            return
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            pass

    # ------------------------------------------------------------------
    # Caching / network helpers
    # ------------------------------------------------------------------
    async def async_cached(
        self,
        key: str,
        ttl: float,
        factory: Callable[[], Awaitable[Any]],
    ) -> Any:
        now = time.monotonic()
        cached = self._cache.get(key)
        if cached is not None and now - cached[0] < ttl:
            return cached[1]

        lock = self._cache_locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = self._cache.get(key)
            if cached is not None and time.monotonic() - cached[0] < ttl:
                return cached[1]
            value = await factory()
            self._cache[key] = (time.monotonic(), value)
            return value

    async def http_json(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        async with self.session.get(
            url,
            params=params,
            headers=headers,
            timeout=self.http_timeout,
        ) as response:
            response.raise_for_status()
            return await response.json(content_type=None)

    # ------------------------------------------------------------------
    # Backup / restore
    # ------------------------------------------------------------------
    async def async_backup(self) -> dict[str, Any]:
        return {
            "version": VERSION,
            "exported_at": datetime.now(self.tz).isoformat(),
            "settings": settings_for_ui(self.settings),
            "saved_playlists": self.saved_playlists,
            "playlist": [page.as_dict() for page in self.playlist],
            "playlist_delay": self.playlist_delay,
            "modules": self.coordinator.snapshot().get("modules", []),
        }

    async def async_restore(self, data: dict[str, Any]) -> None:
        if not isinstance(data, dict):
            raise ValueError("Backup must be a JSON object")

        settings = data.get("settings")
        if isinstance(settings, dict):
            self.settings.update(
                {
                    key: value
                    for key, value in settings.items()
                    if key in SETTINGS_KEYS
                }
            )

        playlists = data.get("saved_playlists")
        if isinstance(playlists, dict):
            self.saved_playlists = {
                str(name): self._sanitize_saved_playlist(value)
                for name, value in playlists.items()
            }

        raw_playlist = data.get("playlist")
        if isinstance(raw_playlist, list):
            self.playlist = [Page.from_dict(item) for item in raw_playlist][:100]

        try:
            self.playlist_delay = float(data.get("playlist_delay", self.playlist_delay))
        except (TypeError, ValueError):
            pass

        self._cache.clear()
        await self._store.async_save(self._state_snapshot())
        self._notify()

    # ------------------------------------------------------------------
    # Persistence / notifications
    # ------------------------------------------------------------------
    def _state_snapshot(self) -> dict[str, Any]:
        return {
            "version": VERSION,
            "settings": settings_for_ui(self.settings),
            "saved_playlists": self.saved_playlists,
            "playlist": [page.as_dict() for page in self.playlist],
            "playlist_delay": self.playlist_delay,
            "mode": self.mode,
            "active_app": self.active_app,
        }

    def _sanitize_saved_playlist(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            return {"pages": [], "delay": 5.0}
        pages = value.get("pages")
        try:
            delay = float(value.get("delay", 5.0))
        except (TypeError, ValueError):
            delay = 5.0
        return {
            "pages": [
                Page.from_dict(page).as_dict()
                for page in (pages if isinstance(pages, list) else [])
            ][:100],
            "delay": delay,
        }

    def _schedule_save(self) -> None:
        self._store.async_delay_save(self._state_snapshot, STORAGE_SAVE_DELAY)

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, self.signal)

    def _notify_safe(self) -> None:
        try:
            self._notify()
        except Exception:  # noqa: BLE001 - never let notification kill the loop
            _LOGGER.debug("Could not notify panel", exc_info=True)
