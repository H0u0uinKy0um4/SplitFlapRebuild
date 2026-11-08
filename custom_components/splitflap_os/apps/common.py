"""Metadata helpers for the app registry and settings UI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SettingField:
    """Description of one editable setting, rendered by the panel."""

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
        }


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
