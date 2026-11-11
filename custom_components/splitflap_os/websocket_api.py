"""WebSocket commands used by the Split-Flap OS panel."""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, MQTT_COMPAT, VERSION
from .firmware import MAX_HEX_CHARS, FirmwareImageError, image_from_hex
from .positions import normalize_position_map
from .runtime import get_runtime

_LOGGER = logging.getLogger(__name__)

RuntimeAction = Callable[[dict[str, Any]], Awaitable[Any]]


def _state(hass: HomeAssistant) -> dict[str, Any] | None:
    runtime = get_runtime(hass)
    if runtime is None:
        return None

    engine = runtime["engine"]
    coordinator = runtime["coordinator"]
    return {
        "version": VERSION,
        "mqtt_compat": MQTT_COMPAT,
        # Alias for older panel builds.
        "compat": MQTT_COMPAT,
        "entry_id": runtime["entry"].entry_id,
        "entry_title": runtime["entry"].title,
        "engine": engine.snapshot(),
        "coordinator": coordinator.snapshot(),
    }


def _require_runtime(hass: HomeAssistant, connection, msg) -> dict[str, Any] | None:
    runtime = get_runtime(hass)
    if runtime is None:
        connection.send_error(
            msg["id"],
            "not_configured",
            "Split-Flap OS has no configured display",
        )
    return runtime


async def _run_action(
    hass: HomeAssistant,
    connection,
    msg,
    action: RuntimeAction,
) -> None:
    runtime = _require_runtime(hass, connection, msg)
    if runtime is None:
        return

    try:
        result = await action(runtime)
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_request", str(err))
        return
    except Exception as err:  # noqa: BLE001 - report failures to the panel
        _LOGGER.exception("Split-Flap OS WebSocket action %s failed", msg["type"])
        connection.send_error(msg["id"], "command_failed", str(err))
        return

    connection.send_result(msg["id"], result if result is not None else {})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/get_state"}
)
@callback
def websocket_get_state(hass: HomeAssistant, connection, msg) -> None:
    """Return a complete snapshot of the display and engine."""

    state = _state(hass)
    if state is None:
        _require_runtime(hass, connection, msg)
        return
    connection.send_result(msg["id"], state)


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/subscribe"}
)
@callback
def websocket_subscribe(hass: HomeAssistant, connection, msg) -> None:
    """Push a new snapshot whenever the display or engine changes."""

    runtime = _require_runtime(hass, connection, msg)
    if runtime is None:
        return

    @callback
    def forward() -> None:
        state = _state(hass)
        if state is not None:
            connection.send_message(websocket_api.event_message(msg["id"], state))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, runtime["engine"].signal, forward
    )
    connection.send_result(msg["id"])
    forward()


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/send_text",
        vol.Required("text"): str,
        vol.Optional("start", default=1): vol.Coerce(int),
        vol.Optional("style", default="ltr"): str,
        vol.Optional("speed", default=15): vol.Coerce(int),
        vol.Optional("stop", default=True): bool,
        vol.Optional("raw", default=False): bool,
    }
)
@websocket_api.async_response
async def websocket_send_text(hass: HomeAssistant, connection, msg) -> None:
    """Display a block of text."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_send_text(
            msg["text"],
            start=msg["start"],
            style=msg["style"],
            speed=msg["speed"],
            stop=msg["stop"],
            raw=msg["raw"],
        ),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/play_playlist",
        vol.Required("pages"): [vol.Any(str, dict)],
        vol.Optional("delay", default=5): vol.Coerce(float),
        vol.Optional("loop", default=True): bool,
    }
)
@websocket_api.async_response
async def websocket_play_playlist(hass: HomeAssistant, connection, msg) -> None:
    """Start a playlist immediately."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_play_playlist(
            msg["pages"], msg["delay"], loop=msg["loop"]
        ),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/start_app",
        vol.Required("app"): str,
        vol.Optional("mode"): str,
    }
)
@websocket_api.async_response
async def websocket_start_app(hass: HomeAssistant, connection, msg) -> None:
    """Activate a data app."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_start_app(msg["app"], msg.get("mode")),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/stop_app"}
)
@websocket_api.async_response
async def websocket_stop_app(hass: HomeAssistant, connection, msg) -> None:
    """Stop the active app or playlist and return to idle."""

    await _run_action(
        hass, connection, msg, lambda runtime: runtime["engine"].async_stop()
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/set_settings",
        vol.Required("settings"): dict,
    }
)
@websocket_api.async_response
async def websocket_set_settings(hass: HomeAssistant, connection, msg) -> None:
    """Merge settings and persist them."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_set_settings(msg["settings"]),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_playlist",
        vol.Required("name"): str,
        vol.Required("pages"): [vol.Any(str, dict)],
        vol.Optional("delay", default=5): vol.Coerce(float),
    }
)
@websocket_api.async_response
async def websocket_save_playlist(hass: HomeAssistant, connection, msg) -> None:
    """Save a named playlist."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_save_playlist(
            msg["name"], msg["pages"], msg["delay"]
        ),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_playlist",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def websocket_delete_playlist(hass: HomeAssistant, connection, msg) -> None:
    """Delete a saved playlist."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_delete_playlist(msg["name"]),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_drum",
        vol.Required("name"): str,
        vol.Required("drum"): str,
    }
)
@websocket_api.async_response
async def websocket_save_drum(hass: HomeAssistant, connection, msg) -> None:
    """Save a named drum (64 characters, one per flap)."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_save_drum(
            msg["name"], msg["drum"]
        ),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_drum",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def websocket_delete_drum(hass: HomeAssistant, connection, msg) -> None:
    """Delete a saved drum."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_delete_drum(msg["name"]),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/run_saved_playlist",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def websocket_run_saved_playlist(
    hass: HomeAssistant, connection, msg
) -> None:
    """Run a saved playlist in a loop."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_run_saved_playlist(msg["name"]),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/calibrate",
        vol.Required("module"): vol.Any(int, str),
        vol.Required("action"): str,
        vol.Optional("index"): vol.Coerce(int),
        vol.Optional("flap"): str,
        vol.Optional("home_offset"): vol.Coerce(int),
        vol.Optional("positions"): vol.Any(dict, str),
        vol.Optional("clear_map", default=False): bool,
        vol.Optional("steps"): vol.Coerce(int),
        vol.Optional("drum"): vol.All(str, vol.Length(min=64, max=64)),
    }
)
@websocket_api.async_response
async def websocket_calibrate(hass: HomeAssistant, connection, msg) -> None:
    """Send one calibration command to the master."""

    positions = msg.get("positions")
    if isinstance(positions, str):
        positions = normalize_position_map(positions)

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["coordinator"].async_calibrate(
            module_id=msg["module"],
            action=msg["action"],
            index=msg.get("index"),
            flap=msg.get("flap"),
            home_offset=msg.get("home_offset"),
            positions=positions if isinstance(positions, dict) else None,
            clear_map=msg.get("clear_map", False),
            steps=msg.get("steps"),
            drum=msg.get("drum"),
        ),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/scan"}
)
@websocket_api.async_response
async def websocket_scan(hass: HomeAssistant, connection, msg) -> None:
    """Ask the master to run a full RS485 bus scan."""

    await _run_action(
        hass, connection, msg, lambda runtime: runtime["coordinator"].async_scan()
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/sync"}
)
@websocket_api.async_response
async def websocket_sync(hass: HomeAssistant, connection, msg) -> None:
    """Ask the master to republish its state."""

    await _run_action(
        hass, connection, msg, lambda runtime: runtime["coordinator"].async_sync()
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/update"}
)
@websocket_api.async_response
async def websocket_update(hass: HomeAssistant, connection, msg) -> None:
    """Ask the master to refresh known modules."""

    await _run_action(
        hass, connection, msg, lambda runtime: runtime["coordinator"].async_update()
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/home_all"}
)
@websocket_api.async_response
async def websocket_home_all(hass: HomeAssistant, connection, msg) -> None:
    """Home every known module."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["coordinator"].async_home_all(),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/record_all",
        vol.Required("index"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_record_all(hass: HomeAssistant, connection, msg) -> None:
    """Record one character index on every module."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["coordinator"].async_record_all(msg["index"]),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/backup"}
)
@websocket_api.async_response
async def websocket_backup(hass: HomeAssistant, connection, msg) -> None:
    """Export settings, playlists and the last module snapshot."""

    await _run_action(
        hass, connection, msg, lambda runtime: runtime["engine"].async_backup()
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/restore",
        vol.Required("data"): dict,
    }
)
@websocket_api.async_response
async def websocket_restore(hass: HomeAssistant, connection, msg) -> None:
    """Restore settings and playlists from a backup object."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["engine"].async_restore(msg["data"]),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/flash_firmware",
        vol.Required("module"): vol.Coerce(int),
        vol.Required("hex"): vol.All(str, vol.Length(min=1, max=MAX_HEX_CHARS)),
    }
)
@websocket_api.async_response
async def websocket_flash_firmware(hass: HomeAssistant, connection, msg) -> None:
    """Validate an Intel HEX image and flash one module over RS485.

    The panel reads the ``ATtiny1616_OTA`` ``firmware.hex`` and sends its
    text; the integration extracts the application region, publishes it in
    ``chunk`` messages and finally starts the (blocking) flash session.
    Progress then arrives through the ``ota`` status object.
    """

    if _require_runtime(hass, connection, msg) is None:
        return
    try:
        image = image_from_hex(msg["hex"])
    except FirmwareImageError as err:
        connection.send_error(msg["id"], "invalid_request", str(err))
        return

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["coordinator"].async_flash_image(msg["module"], image),
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/cancel_firmware"}
)
@websocket_api.async_response
async def websocket_cancel_firmware(hass: HomeAssistant, connection, msg) -> None:
    """Abort a running flash session or discard a collected image."""

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["coordinator"].async_firmware_cancel(),
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/reset_firmware",
        vol.Required("module"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def websocket_reset_firmware(hass: HomeAssistant, connection, msg) -> None:
    """Boot a module stuck in the bootloader back into its application.

    A module that stayed in update mode after a cancelled or interrupted
    flash no longer answers the ASCII scan, so the panel lets the user
    enter its id directly. The master refuses the reset while an image is
    being collected or a flash session is running.
    """

    await _run_action(
        hass,
        connection,
        msg,
        lambda runtime: runtime["coordinator"].async_firmware_reset(msg["module"]),
    )


COMMANDS = (
    websocket_get_state,
    websocket_subscribe,
    websocket_send_text,
    websocket_play_playlist,
    websocket_start_app,
    websocket_stop_app,
    websocket_set_settings,
    websocket_save_playlist,
    websocket_delete_playlist,
    websocket_save_drum,
    websocket_delete_drum,
    websocket_run_saved_playlist,
    websocket_calibrate,
    websocket_scan,
    websocket_sync,
    websocket_update,
    websocket_home_all,
    websocket_record_all,
    websocket_backup,
    websocket_restore,
    websocket_flash_firmware,
    websocket_cancel_firmware,
    websocket_reset_firmware,
)


@callback
def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register all panel WebSocket commands once."""

    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("_websocket_registered"):
        return

    for command in COMMANDS:
        websocket_api.async_register_command(hass, command)

    domain_data["_websocket_registered"] = True
