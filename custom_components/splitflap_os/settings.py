"""Settings metadata and defaults shared by the integration and the panel."""

from __future__ import annotations

from typing import Any

from .apps import (
    ANIMATION_FIELDS,
    COUNTDOWN_FIELDS,
    CRYPTO_FIELDS,
    METRO_FIELDS,
    SPORTS_FIELDS,
    STOCK_FIELDS,
    WEATHER_FIELDS,
    WORLD_CLOCK_FIELDS,
)
from .apps.common import SettingField

DISPLAY_FIELDS = (
    SettingField(
        key="row_counts",
        label="Physical row layout (blank = auto)",
        type="text",
        default="",
        placeholder="3,3,1",
        help=(
            "One number per physical row, top to bottom. Module IDs are "
            "assigned left to right, then top to bottom. Short rows are "
            "centred. Blank lets the integration choose from the detected "
            "module count."
        ),
    ),
    SettingField(
        key="rows",
        label="Frame rows (0 = auto)",
        type="number",
        default=0,
        minimum=0,
        maximum=100,
        step=1,
        help="Physical frame height. Leave 0 to derive it from the display.",
    ),
    SettingField(
        key="cols",
        label="Frame columns (0 = auto)",
        type="number",
        default=0,
        minimum=0,
        maximum=100,
        step=1,
        help="Physical frame width. Leave 0 to derive it from the display.",
    ),
    SettingField(
        key="ui_scale",
        label="Preview scale (%)",
        type="number",
        default=100,
        minimum=50,
        maximum=200,
        step=5,
        help=(
            "Scales the flap and module previews in the panel. "
            "100% is the default; use a larger value for small displays."
        ),
    ),
    SettingField(
        key="timezone",
        label="Timezone",
        type="timezone",
        placeholder="Home Assistant default",
        help="IANA name such as Europe/London. Empty uses Home Assistant's timezone.",
    ),
    SettingField(
        key="units",
        label="Units",
        type="select",
        options=("auto", "imperial", "metric"),
        default="auto",
    ),
    SettingField(
        key="page_delay",
        label="Default page delay (s)",
        type="number",
        default=5,
        minimum=0.1,
        maximum=120,
        step=0.5,
    ),
)

SETTINGS_GROUPS: list[dict[str, Any]] = [
    {
        "key": "display",
        "name": "Display",
        "icon": "🖥️",
        "fields": [field.as_dict() for field in DISPLAY_FIELDS],
    },
    {
        "key": "weather",
        "name": "Weather",
        "icon": "🌤️",
        "fields": [field.as_dict() for field in WEATHER_FIELDS],
    },
    {
        "key": "markets",
        "name": "Markets",
        "icon": "📈",
        "fields": [field.as_dict() for field in (*STOCK_FIELDS, *CRYPTO_FIELDS)],
    },
    {
        "key": "sports",
        "name": "Sports",
        "icon": "🏒",
        "fields": [field.as_dict() for field in SPORTS_FIELDS],
    },
    {
        "key": "transit",
        "name": "Transit",
        "icon": "🚇",
        "fields": [field.as_dict() for field in METRO_FIELDS],
    },
    {
        "key": "time",
        "name": "Time",
        "icon": "⏳",
        "fields": [
            field.as_dict()
            for field in (*COUNTDOWN_FIELDS, *WORLD_CLOCK_FIELDS)
        ],
    },
    {
        "key": "animations",
        "name": "Animations",
        "icon": "🎨",
        "fields": [field.as_dict() for field in ANIMATION_FIELDS],
    },
]


DEFAULT_SETTINGS: dict[str, Any] = {
    "row_counts": "",
    "default_drum": "",
    "rows": 0,
    "cols": 0,
    "ui_scale": 100,
    "timezone": "",
    "units": "auto",
    "page_delay": 5,
    "weather_entity": "",
    "zip_code": "",
    "weather_api_key": "",
    "stocks_list": "MSFT,GOOG,NVDA",
    "crypto_list": "bitcoin,ethereum,solana",
    "sports_teams": "BOS,DAL",
    "metro_stop": "place-bbsta",
    "metro_route": "Orange",
    "mbta_api_key": "",
    "countdown_event": "NEW YEAR",
    "countdown_target": "2027-01-01T00:00:00",
    "world_clock_zones": "US/Eastern,US/Pacific,Europe/London",
    "clock_format": "12h",
    "anim_effect": "rainbow",
    "anim_style": "ltr",
    "anim_speed": "0.4",
    "anim_text": "SPLIT  FLAP  DISPLAY",
}

# Fill in any default declared on a field but missing above.
for _group in SETTINGS_GROUPS:
    for _field in _group["fields"]:
        if _field.get("default") not in (None, ""):
            DEFAULT_SETTINGS.setdefault(_field["key"], _field["default"])


SETTINGS_KEYS = frozenset(DEFAULT_SETTINGS)


def settings_for_ui(settings: dict[str, Any]) -> dict[str, Any]:
    """Return a merged, JSON-safe settings dictionary for the panel."""

    merged = dict(DEFAULT_SETTINGS)
    merged.update(
        {key: value for key, value in settings.items() if key in SETTINGS_KEYS}
    )
    return merged
