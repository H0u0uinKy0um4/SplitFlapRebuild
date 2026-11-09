"""MQTT coordinator for the ESP32 split-flap master.

The integration owns all entities.  The master only publishes state on
``<prefix>/status`` and accepts commands on ``<prefix>/command/*``; all
translation from board characters to per-module targets happens here.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from homeassistant.components import mqtt
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    COMMAND_TOPICS,
    CONF_TOPIC_PREFIX,
    COORDINATOR_STORAGE_VERSION,
    DEFAULT_DEVICE_NAME,
    DEFAULT_DRUM,
    DEFAULT_TOPIC_PREFIX,
    DOMAIN,
    OFFLINE_TIMEOUT_SECONDS,
    PANEL_URL_PATH,
    STORAGE_SAVE_DELAY,
    signal_update,
)
from .positions import POSITION_MAP_UNSET, normalize_position_map

_LOGGER = logging.getLogger(__name__)

_NUMERIC_ID = re.compile(r"^\d+$")


def module_sort_key(module_id: Any) -> tuple[int, int | str]:
    """Return a stable natural sort key for a module id."""

    value = str(module_id).strip()
    if _NUMERIC_ID.match(value):
        return (0, int(value))
    return (1, value.casefold())


def module_payload_id(module_id: Any) -> int | str:
    """Return a module id as a JSON number when possible."""

    value = str(module_id).strip()
    if _NUMERIC_ID.match(value):
        return int(value)
    return value


def _coerce_count(value: Any, fallback: int = 0) -> int:
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return max(fallback, 0)


def _coerce_optional_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"1", "true", "yes", "on", "enabled", "online"}:
            return True
        if text in {"0", "false", "no", "off", "disabled", "offline"}:
            return False
    return bool(value)


def _coerce_optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_flap_list(value: Any) -> list[str] | None:
    """Normalize a drum sent as a string, list or index map."""

    if value is None:
        return None
    if isinstance(value, str):
        return list(value)
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda item: module_sort_key(item[0]))
        return ["" if item is None else str(item) for _, item in items]
    if isinstance(value, (list, tuple)):
        return ["" if item is None else str(item) for item in value]
    return [str(value)]


MODULE_STAT_ALIASES: dict[str, tuple[str, ...]] = {
    "flap_list": (
        "flap_list",
        "flapList",
        "FlapList",
        "flaps",
        "drum",
        "drum_chars",
        "drumChars",
        "characters",
    ),
    "current_step": (
        "current_step",
        "currentStep",
        "CurrentStep",
        "current_step_pos",
        "currentStepPos",
        "step",
        "step_position",
        "position_step",
        "pos",
    ),
    "auto_homing": (
        "auto_homing",
        "autoHoming",
        "AutoHoming",
        "auto_home",
        "autoHome",
        "autoHomeEnabled",
        "autohome",
    ),
    "home_offset": (
        "home_offset",
        "homeOffset",
        "HomeOffset",
        "hall_offset",
        "hallOffset",
    ),
    "total_steps": (
        "total_steps",
        "totalSteps",
        "TotalSteps",
        "total_steps_per_rev",
        "totalStepsPerRev",
        "steps_per_rev",
        "stepsPerRev",
        "max_steps",
        "maxSteps",
    ),
    "current_index": (
        "current_index",
        "currentIndex",
        "CurrentIndex",
        "current_flap_index",
        "currentFlapIndex",
        "flap_index",
        "flapIndex",
        "index",
    ),
    "map_of_positions": (
        "map_of_positions",
        "mapOfPositions",
        "MapOfPositions",
        "position_map",
        "positionMap",
        "positions",
        "map",
    ),
    "busy": ("busy", "is_busy", "isBusy", "moving"),
    "position_known": (
        "position_known",
        "positionKnown",
        "PositionKnown",
        "position_valid",
        "positionValid",
    ),
    "online": ("online", "is_online", "isOnline", "connected"),
    "last_seen": ("last_seen", "lastSeen", "last_seen_ms", "lastSeenMs"),
}

_MODULE_STAT_CONTAINERS = ("stats", "config", "details", "module_stats")
_MODULE_STATE_KEYS = ("state", "module_state", "status")


def _module_sources(module: dict[str, Any]) -> list[dict[str, Any]]:
    sources = [module]
    for key in _MODULE_STAT_CONTAINERS:
        nested = module.get(key)
        if isinstance(nested, dict):
            sources.append(nested)
    return sources


def _first_value(sources: list[dict[str, Any]], aliases: tuple[str, ...]) -> Any:
    for source in sources:
        for alias in aliases:
            if alias in source and source[alias] is not None:
                return source[alias]
    return None


def module_state(module: dict[str, Any]) -> str:
    for key in _MODULE_STATE_KEYS:
        if key in module and module[key] is not None:
            value = module[key]
            return str(value) if value != "" else "unknown"
    return "unknown"


def module_stats(module: dict[str, Any]) -> dict[str, Any]:
    """Extract canonical diagnostics and derive the current flap index."""

    sources = _module_sources(module)
    stats: dict[str, Any] = {}

    flap_list = normalize_flap_list(
        _first_value(sources, MODULE_STAT_ALIASES["flap_list"])
    )
    if flap_list is not None:
        stats["flap_list"] = flap_list

    for key in ("current_step", "home_offset", "total_steps", "current_index"):
        value = _coerce_optional_int(_first_value(sources, MODULE_STAT_ALIASES[key]))
        if value is not None:
            stats[key] = value

    auto_homing = _coerce_optional_bool(
        _first_value(sources, MODULE_STAT_ALIASES["auto_homing"])
    )
    if auto_homing is not None:
        stats["auto_homing"] = auto_homing

    for key in ("busy", "position_known", "online"):
        value = _coerce_optional_bool(
            _first_value(sources, MODULE_STAT_ALIASES[key])
        )
        if value is not None:
            stats[key] = value

    last_seen = _first_value(sources, MODULE_STAT_ALIASES["last_seen"])
    if last_seen is not None:
        stats["last_seen"] = last_seen

    positions = normalize_position_map(
        _first_value(sources, MODULE_STAT_ALIASES["map_of_positions"])
    )
    # Always expose a canonical dict: a raw string or sentinel-only map must
    # never leak into the panel, where it would look like tuned entries.
    stats["map_of_positions"] = positions or {}

    flap_list = stats.get("flap_list")
    flap = module.get("flap")
    if isinstance(flap_list, list) and flap_list and flap not in (None, ""):
        try:
            flap_index = flap_list.index(str(flap))
        except ValueError:
            flap_index = None
        if flap_index is not None:
            stats["flap_index"] = flap_index
            flap_position = None
            if isinstance(positions, dict):
                flap_position = positions.get(str(flap_index))
            if flap_position is None:
                total_steps = stats.get("total_steps")
                if isinstance(total_steps, int) and total_steps > 0:
                    home_offset = stats.get("home_offset", 0)
                    if not isinstance(home_offset, int):
                        home_offset = 0
                    flap_position = (
                        home_offset + (flap_index * total_steps + 32) // 64
                    ) % total_steps
            if flap_position is not None:
                stats["flap_position"] = flap_position

    known = {
        "id",
        "flap",
        "flap_index",
        "flap_position",
        *_MODULE_STATE_KEYS,
        *_MODULE_STAT_CONTAINERS,
    }
    for aliases in MODULE_STAT_ALIASES.values():
        known.update(aliases)
    extra: dict[str, Any] = {}
    for source in sources:
        for key, value in source.items():
            if key not in known and value is not None:
                extra[key] = value
    if extra:
        stats["extra_stats"] = extra

    return stats


def normalize_modules(raw_modules: Any) -> dict[str, dict[str, Any]]:
    """Normalize a status payload's modules into an ``id -> module`` map."""

    modules: dict[str, dict[str, Any]] = {}

    if isinstance(raw_modules, list):
        for item in raw_modules:
            if not isinstance(item, dict) or item.get("id") is None:
                continue
            modules[str(item["id"])] = dict(item)
    elif isinstance(raw_modules, dict):
        for module_id, item in raw_modules.items():
            if isinstance(item, dict):
                module = dict(item)
            else:
                module = {"id": module_id, "flap": item}
            module.setdefault("id", module_id)
            modules[str(module_id)] = module

    for module in modules.values():
        module.update(module_stats(module))
        if module.get("flap") is None:
            flap_list = module.get("flap_list")
            index = module.get("current_index")
            if (
                isinstance(flap_list, list)
                and isinstance(index, int)
                and 0 <= index < len(flap_list)
            ):
                module["flap"] = flap_list[index]

    return modules


def derive_flap_state(
    module: dict[str, Any], flap: Any
) -> tuple[int | None, int | None]:
    """Return ``(flap_index, flap_position)`` for a character."""

    flap_list = module.get("flap_list")
    if not isinstance(flap_list, list) or not flap_list or flap in (None, ""):
        return None, None
    try:
        index = flap_list.index(str(flap))
    except ValueError:
        return None, None

    positions = module.get("map_of_positions")
    position = positions.get(str(index)) if isinstance(positions, dict) else None
    if position is None:
        total_steps = module.get("total_steps")
        if isinstance(total_steps, int) and total_steps > 0:
            home_offset = module.get("home_offset", 0)
            if not isinstance(home_offset, int):
                home_offset = 0
            position = (home_offset + (index * total_steps + 32) // 64) % total_steps
    return index, position if isinstance(position, int) else None


class SplitFlapCoordinator:
    """Own the MQTT connection and the last known hardware state."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.prefix = (
            entry.options.get(
                CONF_TOPIC_PREFIX,
                entry.data.get(CONF_TOPIC_PREFIX, DEFAULT_TOPIC_PREFIX),
            )
            .strip()
            .rstrip("/")
        )
        self.signal = signal_update(entry.entry_id)

        self.data: dict[str, Any] = {
            "status": "offline",
            "modules": {},
            "modules_count": 0,
            "text": "",
            "last_status": None,
            "restored": False,
        }
        #: Characters the integration has asked the display to show.
        self.desired_chars: dict[str, str] = {}

        self._mqtt_unsub: CALLBACK_TYPE | None = None
        self._offline_timer: CALLBACK_TYPE | None = None
        self._store: Store[dict[str, Any]] = Store(
            hass, COORDINATOR_STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
        )

    # ------------------------------------------------------------------
    # Identity / snapshots
    # ------------------------------------------------------------------
    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self.entry.entry_id)},
            name=self.entry.title or DEFAULT_DEVICE_NAME,
            manufacturer="DIY",
            model="ESP32-C3 RS485 Split-Flap Master",
            sw_version="MQTT",
            configuration_url=f"homeassistant://{PANEL_URL_PATH}",
        )

    @property
    def online(self) -> bool:
        return str(self.data.get("status", "offline")).lower() == "online"

    @property
    def modules(self) -> dict[str, dict[str, Any]]:
        modules = self.data.get("modules")
        return modules if isinstance(modules, dict) else {}

    @property
    def module_ids(self) -> list[str]:
        return sorted(self.modules, key=module_sort_key)

    @property
    def modules_count(self) -> int:
        count = _coerce_count(self.data.get("modules_count"), 0)
        return count or len(self.modules)

    def flap_list_for(self, module_id: Any) -> list[str] | None:
        """Return the module's reported drum, or ``None`` when unknown."""

        module = self.modules.get(str(module_id)) or {}
        flap_list = module.get("flap_list")
        if isinstance(flap_list, list) and flap_list:
            return flap_list
        return None

    def drum_for(self, module_id: Any) -> list[str]:
        return self.get_effective_drum(module_id)

    def get_effective_drum(self, module_id: Any) -> list[str]:
        """Return the effective drum for a module.

        Priority:
        1. Module's reported drum (flap_list).
        2. Per-module override from settings (key ``drum_<id>``).
        3. Global ``default_drum`` setting.
        4. Built-in ``DEFAULT_DRUM``.
        """
        reported = self.flap_list_for(module_id)
        if reported:
            return list(reported)

        # Check for per-module override in settings.
        module_key = f"drum_{module_id}"
        try:
            from .engine import AppEngine  # noqa: F401
        except Exception:  # noqa: BLE001
            pass

        # The coordinator does not have direct access to engine settings,
        # so we check the runtime store via hass.data.
        try:
            runtime = self.hass.data.get(DOMAIN, {}).get(self.entry.entry_id)
            if runtime:
                engine = runtime.get("engine")
                if engine is not None:
                    settings = getattr(engine, "settings", {}) or {}
                    override = settings.get(module_key)
                    if isinstance(override, str) and len(override) >= 1:
                        return list(override[:64].ljust(64, " "))
                    default = settings.get("default_drum")
                    if isinstance(default, str) and len(default) >= 1:
                        return list(default[:64].ljust(64, " "))
        except Exception:  # noqa: BLE001
            pass

        return list(DEFAULT_DRUM)

    def module_snapshot(self, module_id: str) -> dict[str, Any]:
        module = dict(self.modules.get(module_id) or {})
        stats = module_stats(module)
        module.update(stats)
        actual_flap = module.get("flap")
        desired_flap = self.desired_chars.get(str(module_id))
        displayed_flap = desired_flap if desired_flap is not None else actual_flap
        display_index, display_position = derive_flap_state(module, displayed_flap)
        module.update(
            {
                "id": module_payload_id(module_id),
                "actual_flap": actual_flap,
                "desired_flap": desired_flap,
                "displayed_flap": displayed_flap,
                "display_flap_index": display_index,
                "display_flap_position": display_position,
                "flap": actual_flap,
                "state": module_state(module),
                "online": bool(module.get("online", True)) and self.online,
            }
        )
        return module

    def snapshot(self) -> dict[str, Any]:
        modules = [self.module_snapshot(module_id) for module_id in self.module_ids]
        return {
            "prefix": self.prefix,
            "online": self.online,
            "status": self.data.get("status", "offline"),
            "text": self.data.get("text", ""),
            "modules": modules,
            "modules_count": self.modules_count,
            "desired_chars": dict(self.desired_chars),
            "last_status": self.data.get("last_status"),
            "restored": bool(self.data.get("restored", False)),
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def async_setup(self) -> None:
        await self._async_restore_state()

        status_topic = f"{self.prefix}/status"

        @callback
        def message_received(msg) -> None:
            try:
                payload = json.loads(msg.payload)
            except (json.JSONDecodeError, UnicodeDecodeError):
                _LOGGER.error("Failed to decode MQTT status payload: %s", msg.payload)
                return
            if not isinstance(payload, dict):
                _LOGGER.warning("MQTT status payload is not an object: %s", payload)
                return
            self._handle_status_payload(payload)

        self._mqtt_unsub = await mqtt.async_subscribe(
            self.hass, status_topic, message_received
        )
        _LOGGER.info("Subscribed to %s", status_topic)
        self._reset_offline_timer()
        await self.async_sync()

    async def async_unload(self) -> None:
        try:
            await self._store.async_save(self._state_snapshot())
        except Exception:  # noqa: BLE001 - unload must continue
            _LOGGER.exception("Could not save Split-Flap state")

        if self._offline_timer is not None:
            self._offline_timer()
            self._offline_timer = None
        if self._mqtt_unsub is not None:
            self._mqtt_unsub()
            self._mqtt_unsub = None

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------
    def _state_snapshot(self) -> dict[str, Any]:
        return {
            "modules": self.modules,
            "modules_count": self.modules_count,
            "text": str(self.data.get("text") or ""),
            "desired_chars": dict(self.desired_chars),
            "saved_at": dt_util.now(dt_util.UTC).isoformat(),
        }

    def _schedule_save(self) -> None:
        self._store.async_delay_save(self._state_snapshot, STORAGE_SAVE_DELAY)

    async def _async_restore_state(self) -> None:
        try:
            stored = await self._store.async_load()
        except Exception:  # noqa: BLE001 - restore must never block setup
            _LOGGER.exception("Could not restore Split-Flap state")
            return
        if not isinstance(stored, dict):
            return

        modules = normalize_modules(stored.get("modules"))
        count = _coerce_count(stored.get("modules_count"), len(modules))
        if not modules and not count:
            return

        desired = stored.get("desired_chars")
        if isinstance(desired, dict):
            self.desired_chars = {
                str(key): str(value) for key, value in desired.items()
            }

        self.data.update(
            {
                "modules": modules,
                "modules_count": count or len(modules),
                "text": str(stored.get("text") or ""),
                "status": "offline",
                "restored": True,
            }
        )
        _LOGGER.info(
            "Restored %s module(s) for %s from storage",
            self.modules_count,
            self.prefix,
        )

    # ------------------------------------------------------------------
    # MQTT receive
    # ------------------------------------------------------------------
    @callback
    def _handle_status_payload(self, payload: dict[str, Any]) -> None:
        data = dict(self.data)
        state_text = str(payload.get("state", "online")).lower()
        online = state_text not in {"offline", "unavailable", "disconnected"}
        data["status"] = "online" if online else "offline"

        if online and isinstance(payload.get("text"), str):
            data["text"] = payload["text"]

        raw_modules = payload.get("modules")
        if isinstance(raw_modules, (list, dict)):
            modules = normalize_modules(raw_modules)
            reported_count = _coerce_count(payload.get("modules_count"), len(modules))
            # An offline last-will payload contains no modules; keep the last
            # known snapshot so the panel and sensors survive a reboot.
            if online or not data.get("modules"):
                data["modules"] = modules
                data["modules_count"] = len(modules) if modules else reported_count
        elif online and "modules_count" in payload:
            data["modules_count"] = _coerce_count(
                payload.get("modules_count"), data.get("modules_count", 0)
            )

        data["last_status"] = dt_util.now().isoformat()
        data["restored"] = False if online else bool(data.get("restored", False))
        self.data = data

        self._notify()
        self._schedule_save()
        self._reset_offline_timer()
        _LOGGER.debug("Split-Flap status: %s module(s), %s", self.modules_count, data["status"])

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, self.signal)

    @callback
    def _reset_offline_timer(self) -> None:
        if self._offline_timer is not None:
            self._offline_timer()
            self._offline_timer = None

        @callback
        def _timeout(_now) -> None:
            self._offline_timer = None
            if not self.online:
                return
            _LOGGER.warning(
                "No status from Split-Flap (%s) for %ss; marking offline",
                self.prefix,
                OFFLINE_TIMEOUT_SECONDS,
            )
            data = dict(self.data)
            data["status"] = "offline"
            self.data = data
            self._notify()

        self._offline_timer = async_call_later(
            self.hass, OFFLINE_TIMEOUT_SECONDS, _timeout
        )

    # ------------------------------------------------------------------
    # MQTT publish
    # ------------------------------------------------------------------
    async def _publish(self, command: str, payload: dict[str, Any]) -> None:
        topic = f"{self.prefix}/{COMMAND_TOPICS[command]}"
        await mqtt.async_publish(self.hass, topic, json.dumps(payload))
        _LOGGER.debug("Published to %s: %s", topic, payload)

    async def async_show_chars(
        self,
        char_by_id: dict[str, str],
        order_ids: list[str] | None = None,
        *,
        speed: int | None = None,
    ) -> None:
        """Send one character per module, in the requested send order."""

        ordered: list[str] = []
        seen: set[str] = set()
        for module_id in order_ids or []:
            key = str(module_id)
            if key in char_by_id and key not in seen:
                ordered.append(key)
                seen.add(key)
        for key in char_by_id:
            if key not in seen:
                ordered.append(str(key))
                seen.add(str(key))

        modules = [
            {
                "id": module_payload_id(key),
                "char": (char_by_id.get(key) or " ")[:1] or " ",
            }
            for key in ordered
        ]
        if not modules:
            _LOGGER.warning("Cannot display: no modules known yet")
            return

        payload: dict[str, Any] = {"modules": modules}
        # The current master ignores this, but it is part of the historical
        # display contract and newer firmware can honour it.
        if speed is not None:
            payload["speed"] = int(speed)

        await self._publish("display", payload)
        for key in ordered:
            self.desired_chars[key] = (char_by_id.get(key) or " ")[:1] or " "
        self._notify()

    async def async_sync(self) -> None:
        await self._publish("sync", {"action": "fetch_state"})

    async def async_scan(self) -> None:
        await self._publish("scan", {"action": "scan"})

    async def async_update(self) -> None:
        await self._publish("update", {"action": "update_data"})

    async def async_calibrate(
        self,
        *,
        module_id: int | str,
        action: str,
        index: int | None = None,
        flap: str | None = None,
        home_offset: int | None = None,
        positions: dict[str, Any] | None = None,
        clear_map: bool = False,
        steps: int | None = None,
        drum: str | None = None,
    ) -> None:
        """Publish one calibration command to the master."""

        cleaned_positions: dict[int, int] = {}
        if isinstance(positions, dict):
            for key, value in positions.items():
                entry_index = _coerce_optional_int(key)
                entry_position = _coerce_optional_int(value)
                if (
                    entry_index is not None
                    and 0 <= entry_index < 64
                    and entry_position is not None
                    and 0 <= entry_position <= POSITION_MAP_UNSET
                ):
                    cleaned_positions[entry_index] = entry_position

        action_norm = str(action).lower().strip().replace("-", "_")
        if action_norm in {"getpos", "get_position", "get_pos", "position", "pos", "get"}:
            action_norm = "get_pos"
        if action_norm in {"clearmap", "clear_map"}:
            action_norm = "clear_map"
        if action_norm in {"drumwrite", "writedrum", "drum_write", "write_drum"}:
            action_norm = "drum_write"

        payload: dict[str, Any] = {
            "action": action_norm,
            "module": module_payload_id(module_id),
        }
        if action_norm == "goto":
            if index is not None:
                payload["index"] = int(index)
            elif flap:
                payload["flap"] = str(flap)[0]
        elif action_norm == "step" and steps is not None:
            step_value = _coerce_optional_int(steps)
            if step_value is None:
                raise ValueError("steps must be an integer")
            # The slave `g<pos>` command is an absolute position, while the
            # integration/UI exposes a relative step count.  Convert here so a
            # negative value (for example -32) can never wrap to the end of the
            # drum by accident.
            module = self.modules.get(str(module_id)) or {}
            current_step = _coerce_optional_int(module.get("current_step"))
            total_steps = _coerce_optional_int(module.get("total_steps"))
            if current_step is not None and total_steps and total_steps > 0:
                payload["steps"] = (current_step + step_value) % total_steps
            else:
                _LOGGER.warning(
                    "Relative step for module %s requested before its position "
                    "is known; sending %s as an absolute position",
                    module_id,
                    step_value,
                )
                payload["steps"] = step_value
        elif action_norm == "record" and index is not None:
            payload["index"] = int(index)
            if int(index) == 0:
                _LOGGER.warning(
                    "Recording index 0 also makes the current master send a "
                    "destructive m<id>w0:0 write; prefer a nonzero index"
                )
        elif action_norm == "apply":
            if home_offset is not None:
                payload["home_offset"] = int(home_offset)
            if clear_map:
                payload["clear_map"] = True
            if cleaned_positions:
                payload["positions"] = {
                    str(key): value for key, value in sorted(cleaned_positions.items())
                }
        elif action_norm in {"drum_write", "drumwrite", "write_drum"}:
            if drum is not None and len(drum) == 64:
                payload["action"] = "drum_write"
                payload["drum"] = drum
            else:
                raise ValueError("drum must be a 64-character string")

        await self._publish("calibrate", payload)

    async def async_home_all(self) -> None:
        for module_id in self.module_ids:
            await self.async_calibrate(module_id=module_id, action="home")
            await asyncio.sleep(0.05)

    async def async_record_all(self, index: int) -> None:
        if int(index) == 0:
            _LOGGER.warning(
                "Recording index 0 on every module also triggers the master's "
                "destructive m<id>w0:0 write"
            )
        for module_id in self.module_ids:
            await self.async_calibrate(module_id=module_id, action="record", index=index)
            await asyncio.sleep(0.05)
