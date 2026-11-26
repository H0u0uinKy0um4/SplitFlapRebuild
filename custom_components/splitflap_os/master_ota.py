"""Pure helpers for the ESP32 master self-update channel.

The master flashes its own application image over MQTT, independently of the
slave-module OTA chain in :mod:`ota`. This module has no Home Assistant imports
so the normalization and validation can be tested under plain Python.
"""

from __future__ import annotations

import re
from typing import Any, Final

# States published by the master in the "master_ota" status object.
MASTER_OTA_STATE_IDLE: Final = "idle"
MASTER_OTA_STATE_COLLECTING: Final = "collecting"
MASTER_OTA_STATE_APPLYING: Final = "applying"
MASTER_OTA_STATE_REBOOTING: Final = "rebooting"
MASTER_OTA_STATE_DONE: Final = "done"
MASTER_OTA_STATE_FAILED: Final = "failed"
MASTER_OTA_STATE_CANCELLED: Final = "cancelled"

MASTER_OTA_STATES: Final = frozenset(
    {
        MASTER_OTA_STATE_IDLE,
        MASTER_OTA_STATE_COLLECTING,
        MASTER_OTA_STATE_APPLYING,
        MASTER_OTA_STATE_REBOOTING,
        MASTER_OTA_STATE_DONE,
        MASTER_OTA_STATE_FAILED,
        MASTER_OTA_STATE_CANCELLED,
    }
)

#: States in which a second firmware operation must be refused.
MASTER_OTA_STATES_ACTIVE: Final = frozenset(
    {
        MASTER_OTA_STATE_COLLECTING,
        MASTER_OTA_STATE_APPLYING,
        MASTER_OTA_STATE_REBOOTING,
    }
)

# Actions accepted on <prefix>/command/master_firmware. After "flash" the
# master reboots automatically; there is deliberately no "reset" action.
MASTER_FIRMWARE_ACTION_BEGIN: Final = "begin"
MASTER_FIRMWARE_ACTION_CHUNK: Final = "chunk"
MASTER_FIRMWARE_ACTION_FLASH: Final = "flash"
MASTER_FIRMWARE_ACTION_CANCEL: Final = "cancel"

#: Upper bound for an app-only ESP32 image. The exact partition size is a
#: master-side property; this is the largest image Home Assistant will ship.
MASTER_OTA_MAX_SIZE: Final = 1024 * 1024

#: Reuse the proven chunk size: 768 bytes -> 1024 base64 characters.
MASTER_OTA_CHUNK_BYTES: Final = 768

#: How long the panel waits for the master to reconnect after a flash.
MASTER_OTA_REBOOT_TIMEOUT_SECONDS: Final = 300

_MASTER_VERSION_PATTERN = re.compile(r"^\d+\.(\d+)\.\d+\.\d+$")


def master_mqtt_from_version(version: Any) -> int | None:
    """Return the MQTT compat generation from ``<bus>.<mqtt>.<release>``."""

    if not isinstance(version, str):
        return None
    match = _MASTER_VERSION_PATTERN.match(version.strip())
    return int(match.group(1)) if match else None


def normalize_master_ota(raw: Any) -> dict[str, Any]:
    """Normalize one ``master_ota`` status object.

    The canonical object always carries every field: an absent value is
    ``None`` for versions/errors and ``0`` for counters. An unknown state
    falls back to ``idle`` rather than being trusted by the panel.
    """

    result: dict[str, Any] = {
        "state": MASTER_OTA_STATE_IDLE,
        "progress": 0,
        "received": 0,
        "size": 0,
        "version": None,
        "target_version": None,
        "error": None,
    }
    if not isinstance(raw, dict):
        return result

    state = str(raw.get("state") or MASTER_OTA_STATE_IDLE).strip().lower()
    result["state"] = state if state in MASTER_OTA_STATES else MASTER_OTA_STATE_IDLE

    progress = raw.get("progress")
    if isinstance(progress, int) and not isinstance(progress, bool):
        result["progress"] = max(0, min(100, progress))
    for field in ("received", "size"):
        value = raw.get(field)
        if isinstance(value, int) and not isinstance(value, bool):
            result[field] = max(0, value)
    for field in ("version", "target_version", "error"):
        value = raw.get(field)
        if isinstance(value, str) and value.strip():
            result[field] = value.strip()

    return result


def empty_master_ota() -> dict[str, Any]:
    """The always-present idle object used until the first status payload."""

    return normalize_master_ota(None)
