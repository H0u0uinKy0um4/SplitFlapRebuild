"""Pure helpers for the slave-module OTA (RS485 bootloader) chain.

Kept free of Home Assistant imports so ``tests/test_ota.py`` can exercise
it directly. The wire protocol itself (framing, escaping, CRCs) is owned by
the master firmware (``include/ota/SlaveFlasher.h`` in the master repo) and
the ATtiny bootloader (``bootloader/src/protocol.h`` in the slave repo);
this module only normalizes the status the master publishes and names the
MQTT actions for the ``<prefix>/command/firmware`` topic.
"""

from __future__ import annotations

from typing import Any, Final

# Session states published by the master in the "ota" status object.
OTA_STATE_IDLE: Final = "idle"
OTA_STATE_COLLECTING: Final = "collecting"
OTA_STATE_ENTERING: Final = "entering"
OTA_STATE_FLASHING: Final = "flashing"
OTA_STATE_VERIFYING: Final = "verifying"
OTA_STATE_DONE: Final = "done"
OTA_STATE_CANCELLED: Final = "cancelled"
OTA_STATE_FAILED: Final = "failed"

OTA_STATES: Final = frozenset(
    {
        OTA_STATE_IDLE,
        OTA_STATE_COLLECTING,
        OTA_STATE_ENTERING,
        OTA_STATE_FLASHING,
        OTA_STATE_VERIFYING,
        OTA_STATE_DONE,
        OTA_STATE_CANCELLED,
        OTA_STATE_FAILED,
    }
)

# Actions accepted on <prefix>/command/firmware (see the master's
# include/ota/SlaveFlasher.h for the full JSON schema).
FIRMWARE_ACTION_BEGIN: Final = "begin"
FIRMWARE_ACTION_CHUNK: Final = "chunk"
FIRMWARE_ACTION_FLASH: Final = "flash"
FIRMWARE_ACTION_CANCEL: Final = "cancel"
FIRMWARE_ACTION_RESET: Final = "reset"

# Application region of the ATtiny1616 slave flash (BOOTEND fuse = 8: a
# 2 KB boot section, the app lives at 0x0800). Mirrors the bootloader's
# protocol.h so callers can sanity-check an image before shipping it.
OTA_APP_START: Final = 0x0800
OTA_APP_MAX_SIZE: Final = 14336
OTA_PAGE_SIZE: Final = 64
OTA_MAX_PAGES: Final = OTA_APP_MAX_SIZE // OTA_PAGE_SIZE


def normalize_ota(raw: Any) -> dict[str, Any]:
    """Normalize the master's slave-OTA status object.

    Published by the master on ``<prefix>/status`` as ``"ota"``: ``state``
    (one of :data:`OTA_STATES`) plus ``module``, ``progress`` (0-100),
    ``received`` (image bytes while collecting) and ``error`` when a
    session failed. Unknown fields and values of the wrong type are
    dropped rather than trusted; an unknown state falls back to ``idle``.
    """

    if not isinstance(raw, dict):
        return {"state": OTA_STATE_IDLE}
    state = str(raw.get("state") or OTA_STATE_IDLE)
    ota: dict[str, Any] = {
        "state": state if state in OTA_STATES else OTA_STATE_IDLE
    }
    for field in ("module", "progress", "received"):
        value = raw.get(field)
        if isinstance(value, int) and not isinstance(value, bool):
            ota[field] = value
    error = raw.get("error")
    if error:
        ota["error"] = str(error)
    return ota
