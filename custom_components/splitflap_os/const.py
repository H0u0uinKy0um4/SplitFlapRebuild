"""Constants for the Split-Flap OS integration."""

from __future__ import annotations

from typing import Final

from homeassistant.const import Platform

from .layout import COLOR_CODES, COLOR_MAP, DEFAULT_DRUM, FLAP_COUNT, PHYSICAL_COLOR_CODES

DOMAIN: Final = "splitflap_os"
NAME: Final = "Split-Flap OS"
# Version model: two independent compatibility domains (see the slave
# repository's docs/VERSIONING.md). MQTT_COMPAT is the master <-> Home Assistant
# side: the MQTT status/command JSON schema. The master carries it too. The
# slave <-> master bus generation is a separate axis that Home Assistant never
# speaks directly. MQTT_COMPAT repeats the leading number of VERSION explicitly
# so the coordinator can compare it with the master's payload without parsing
# the string.
MQTT_COMPAT: Final = 1
VERSION: Final = "1.2.4"

CONF_TOPIC_PREFIX: Final = "topic_prefix"
CONF_NAME: Final = "name"
DEFAULT_TOPIC_PREFIX: Final = "splitflap"
DEFAULT_DEVICE_NAME: Final = "Split-Flap Display"

# Frontend
PANEL_URL_PATH: Final = "splitflap-os"
PANEL_TITLE: Final = "Split-Flap OS"
PANEL_ICON: Final = "mdi:dots-grid"
PANEL_ELEMENT: Final = "splitflap-os-panel"
FRONTEND_DIR: Final = "frontend"
FRONTEND_FILENAME: Final = "splitflap-os-panel.js"
FRONTEND_URL_PATH: Final = f"/{DOMAIN}/{FRONTEND_DIR}"

# Storage
STORAGE_VERSION: Final = 1
STORAGE_SAVE_DELAY: Final = 10
COORDINATOR_STORAGE_VERSION: Final = 1
ENGINE_STORAGE_VERSION: Final = 1

PLATFORMS: Final = [
    Platform.SENSOR,
    Platform.BUTTON,
    Platform.TEXT,
    Platform.SELECT,
]

# MQTT
COMMAND_TOPICS: Final = {
    "display": "command/display",
    "sync": "command/sync",
    "scan": "command/scan",
    "update": "command/update",
    "calibrate": "command/calibrate",
    # Slave-module OTA (see the master's include/ota/SlaveFlasher.h for the
    # message schema): begin/chunk/flash/cancel/reset JSON actions. The
    # master owns the binary framing to the modules; this side only ships
    # base64 image chunks.
    "firmware": "command/firmware",
}

# After this many seconds without a status payload the master is considered
# offline.  The firmware publishes a heartbeat every 30 seconds.
OFFLINE_TIMEOUT_SECONDS: Final = 90

# Animation orders exposed by the panel.
ANIMATION_ORDERS: Final = (
    "ltr",
    "rtl",
    "columns",
    "center_out",
    "outside_in",
    "diagonal",
    "random",
    "rain",
    "spiral",
)

__all__ = [
    "ANIMATION_ORDERS",
    "COLOR_CODES",
    "COLOR_MAP",
    "PHYSICAL_COLOR_CODES",
    "COMMAND_TOPICS",
    "MQTT_COMPAT",
    "CONF_NAME",
    "CONF_TOPIC_PREFIX",
    "COORDINATOR_STORAGE_VERSION",
    "DEFAULT_DEVICE_NAME",
    "DEFAULT_DRUM",
    "DEFAULT_TOPIC_PREFIX",
    "DOMAIN",
    "ENGINE_STORAGE_VERSION",
    "FLAP_COUNT",
    "FRONTEND_DIR",
    "FRONTEND_FILENAME",
    "FRONTEND_URL_PATH",
    "NAME",
    "OFFLINE_TIMEOUT_SECONDS",
    "PANEL_ELEMENT",
    "PANEL_ICON",
    "PANEL_TITLE",
    "PANEL_URL_PATH",
    "PLATFORMS",
    "STORAGE_SAVE_DELAY",
    "STORAGE_VERSION",
    "VERSION",
]


def signal_update(entry_id: str) -> str:
    """Dispatcher signal used by entities, the panel and the engine."""

    return f"{DOMAIN}_update_{entry_id}"
