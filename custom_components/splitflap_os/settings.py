"""Global display settings metadata.

App settings live in each app's ``manifest.json``; the registry in
``apps/loader.py`` namespaces them and builds the app settings groups.  This
module only owns the settings that belong to the display itself, and must stay
free of Home Assistant imports.
"""

from __future__ import annotations

from typing import Any

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
        key="theme",
        label="Panel theme",
        type="select",
        options=("auto", "light", "dark"),
        default="auto",
        help=(
            "Auto follows the theme selected in your Home Assistant profile "
            "(including its Light/Dark/Auto mode). Light or Dark force the "
            "panel appearance. The physical split-flap display and the module "
            "map stay dark in every mode."
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

# Global keys that are not edited from a settings group.
EXTRA_GLOBAL_DEFAULTS: dict[str, Any] = {
    # Fallback drum for modules that have not reported their own.  Written
    # from the Drums settings sub-tab, not a normal text field.
    "default_drum": "",
}


def display_group() -> dict[str, Any]:
    """Return the Display settings group as rendered by the panel."""

    return {
        "key": "display",
        "name": "Display",
        "icon": "🖥️",
        # "category" routes the group to the panel's Display or Apps
        # settings sub-tab.
        "category": "display",
        "fields": [field.as_dict() for field in DISPLAY_FIELDS],
    }


def global_defaults() -> dict[str, Any]:
    """Return defaults for settings that do not belong to an app."""

    defaults = {field.key: field.default for field in DISPLAY_FIELDS}
    defaults.update(EXTRA_GLOBAL_DEFAULTS)
    return defaults
