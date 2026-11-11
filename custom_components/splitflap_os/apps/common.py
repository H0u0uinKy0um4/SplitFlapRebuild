"""Metadata helpers for the app registry and settings UI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable


@dataclass(frozen=True)
class SettingField:
    """Description of one editable setting, rendered by the panel.

    ``key`` is the local key declared by the app manifest.  The registry
    namespaces it as ``<app key>.<local key>`` before exposing it to the UI
    and persistence, so two apps can use the same local key independently.
    """

    key: str
    label: str
    type: str = "text"
    options: tuple[str, ...] = ()
    placeholder: str = ""
    default: Any = ""
    minimum: float | None = None
    maximum: float | None = None
    step: float | None = None
    domain: str | None = None
    help: str = ""
    visible_when: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "type": self.type,
            "options": list(self.options),
            "placeholder": self.placeholder,
            "default": self.default,
            "min": self.minimum,
            "max": self.maximum,
            "step": self.step,
            "domain": self.domain,
            "help": self.help,
            "visible_when": self.visible_when,
        }


@dataclass(frozen=True)
class AppDef:
    """A runnable app shown on the Apps tab."""

    key: str
    name: str
    icon: str
    description: str
    fields: tuple[SettingField, ...] = ()
    default_delay: float = 5.0
    category: str = "data"
    min_rows: int = 1
    min_cols: int = 1
    modes: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "icon": self.icon,
            "description": self.description,
            "fields": [field.as_dict() for field in self.fields],
            "default_delay": self.default_delay,
            "category": self.category,
            "min_rows": self.min_rows,
            "min_cols": self.min_cols,
            "modes": list(self.modes),
        }


class AppContext:
    """The small capability surface an app provider is allowed to use.

    Providers deliberately receive this object instead of the engine.  They
    can render pages, read their own settings, and make cached HTTP requests,
    but cannot touch MQTT, persistence, calibration, playlists or the display
    loop.
    """

    def __init__(self, engine: Any, app_key: str) -> None:
        self._engine = engine
        self.app_key = app_key

    # Read-only engine state -------------------------------------------
    @property
    def hass(self) -> Any:
        return self._engine.hass

    @property
    def board(self) -> tuple[int, int]:
        return self._engine.board

    @property
    def rows(self) -> int:
        return self._engine.rows

    @property
    def cols(self) -> int:
        return self._engine.cols

    @property
    def layout(self) -> Any:
        return self._engine.layout

    @property
    def tz(self) -> Any:
        return self._engine.tz

    @property
    def unit_system(self) -> str:
        return self._engine.unit_system

    @property
    def active_app_mode(self) -> str | None:
        return self._engine.active_app_mode

    @property
    def session(self) -> Any:
        return self._engine.session

    @property
    def http_timeout(self) -> Any:
        return self._engine.http_timeout

    # Capabilities ------------------------------------------------------
    def get_setting(self, key: str, default: Any = None) -> Any:
        """Return this app's value for a local setting key."""

        return self._engine.get_setting(key, default, app=self.app_key)

    def lines(self, *values: object) -> str:
        return self._engine.lines(*values)

    async def async_cached(
        self,
        key: str,
        ttl: float,
        factory: Callable[[], Awaitable[Any]],
    ) -> Any:
        """Cache a value for this app only."""

        return await self._engine.async_cached(
            f"{self.app_key}:{key}", ttl, factory
        )

    async def http_json(
        self,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        return await self._engine.http_json(url, params=params, headers=headers)


def split_csv(value: object) -> list[str]:
    """Split a comma-separated setting into clean values."""

    if value is None:
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]


def as_float(value: object, default: float) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def as_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def condition_label(condition: object) -> str:
    """Turn a Home Assistant weather condition into a short label."""

    key = str(condition or "").strip().lower()
    labels = {
        "clear": "CLEAR",
        "clear-night": "CLEAR",
        "cloudy": "CLOUDY",
        "exceptional": "ALERT",
        "fog": "FOG",
        "hail": "HAIL",
        "lightning": "STORMS",
        "lightning-rainy": "STORMS",
        "partlycloudy": "PARTLY CLOUDY",
        "pouring": "HEAVY RAIN",
        "rainy": "RAIN",
        "snowy": "SNOW",
        "snowy-rainy": "SLEET",
        "sunny": "SUNNY",
        "windy": "WINDY",
        "windy-variant": "WINDY",
    }
    return labels.get(key, key.upper() or "UNKNOWN")


def compact_number(value: float, *, currency: str = "") -> str:
    """Format a price for a narrow split-flap row."""

    prefix = "$" if currency.upper() in {"USD", "US$", "$"} else ""
    absolute = abs(value)
    if absolute >= 10_000:
        return f"{prefix}{value:,.0f}"
    if absolute >= 1_000:
        return f"{prefix}{value:,.1f}"
    if absolute >= 1:
        return f"{prefix}{value:,.2f}"
    return f"{prefix}{value:.4f}"


def signed_percent(value: float) -> str:
    return f"{value:+.2f}%"
