"""Home Assistant services for Split-Flap OS."""

from __future__ import annotations

import json
import logging
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall

from .const import DOMAIN
from .positions import normalize_position_map
from .runtime import get_runtime

_LOGGER = logging.getLogger(__name__)

SERVICE_SEND_TEXT = "send_text"
SERVICE_PLAY_PLAYLIST = "play_playlist"
SERVICE_START_APP = "start_app"
SERVICE_STOP_APP = "stop_app"
SERVICE_SYNC = "sync"
SERVICE_SCAN = "scan"
SERVICE_UPDATE = "update"
SERVICE_CALIBRATE = "calibrate"
SERVICE_HOME_ALL = "home_all"
SERVICE_RECORD_ALL = "record_all"
SERVICE_SAVE_PLAYLIST = "save_playlist"
SERVICE_DELETE_PLAYLIST = "delete_playlist"
SERVICE_RUN_SAVED_PLAYLIST = "run_saved_playlist"
SERVICE_SET_SETTINGS = "set_settings"

SERVICES = (
    SERVICE_SEND_TEXT,
    SERVICE_PLAY_PLAYLIST,
    SERVICE_START_APP,
    SERVICE_STOP_APP,
    SERVICE_SYNC,
    SERVICE_SCAN,
    SERVICE_UPDATE,
    SERVICE_CALIBRATE,
    SERVICE_HOME_ALL,
    SERVICE_RECORD_ALL,
    SERVICE_SAVE_PLAYLIST,
    SERVICE_DELETE_PLAYLIST,
    SERVICE_RUN_SAVED_PLAYLIST,
    SERVICE_SET_SETTINGS,
)


def _get_runtime(hass: HomeAssistant) -> dict[str, Any] | None:
    """Return the single integration runtime, if configured."""

    return get_runtime(hass)


def _pages_from_value(value: Any) -> list[Any]:
    """Accept a real list or a JSON-encoded list from the service UI."""

    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as err:
            raise ValueError("pages must be a JSON array") from err
        if isinstance(parsed, list):
            return parsed
    raise ValueError("pages must be a JSON array")


async def _handle_send_text(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if not runtime:
        _LOGGER.warning("Split-Flap OS is not configured")
        return
    await runtime["engine"].async_send_text(
        call.data["text"],
        start=call.data.get("start", 1),
        style=call.data.get("style", "ltr"),
        speed=call.data.get("speed", 15),
        stop=call.data.get("stop", True),
        raw=call.data.get("raw", False),
    )


async def _handle_play_playlist(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if not runtime:
        return
    await runtime["engine"].async_play_playlist(
        _pages_from_value(call.data.get("pages", [])),
        call.data.get("delay", 5),
        loop=call.data.get("loop", True),
    )


async def _handle_start_app(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if not runtime:
        return
    await runtime["engine"].async_start_app(call.data["app"])


async def _handle_stop_app(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["engine"].async_stop()


async def _handle_sync(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["coordinator"].async_sync()


async def _handle_scan(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["coordinator"].async_scan()


async def _handle_update(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["coordinator"].async_update()


async def _handle_calibrate(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if not runtime:
        return
    positions = call.data.get("positions")
    if isinstance(positions, str):
        positions = normalize_position_map(positions)
    await runtime["coordinator"].async_calibrate(
        module_id=call.data["module"],
        action=call.data["action"],
        index=call.data.get("index"),
        flap=call.data.get("flap"),
        home_offset=call.data.get("home_offset"),
        positions=positions if isinstance(positions, dict) else None,
        clear_map=call.data.get("clear_map", False),
        steps=call.data.get("steps"),
        drum=call.data.get("drum"),
    )


async def _handle_home_all(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["coordinator"].async_home_all()


async def _handle_record_all(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["coordinator"].async_record_all(call.data["index"])


async def _handle_save_playlist(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["engine"].async_save_playlist(
            call.data["name"],
            _pages_from_value(call.data.get("pages", [])),
            call.data.get("delay", 5),
        )


async def _handle_delete_playlist(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["engine"].async_delete_playlist(call.data["name"])


async def _handle_run_saved_playlist(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["engine"].async_run_saved_playlist(call.data["name"])


async def _handle_set_settings(call: ServiceCall) -> None:
    runtime = _get_runtime(call.hass)
    if runtime:
        await runtime["engine"].async_set_settings(call.data.get("settings", {}))


SEND_TEXT_SCHEMA = vol.Schema(
    {
        vol.Required("text"): vol.All(str, vol.Length(max=4096)),
        vol.Optional("start", default=1): vol.Coerce(int),
        vol.Optional("style", default="ltr"): str,
        vol.Optional("speed", default=15): vol.Coerce(int),
        vol.Optional("stop", default=True): bool,
        vol.Optional("raw", default=False): bool,
    }
)

PLAY_PLAYLIST_SCHEMA = vol.Schema(
    {
        vol.Required("pages"): vol.Any([vol.Any(str, dict)], str),
        vol.Optional("delay", default=5): vol.Coerce(float),
        vol.Optional("loop", default=True): bool,
    }
)

CALIBRATE_SCHEMA = vol.Schema(
    {
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


async def async_register_services(hass: HomeAssistant) -> None:
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("_services_registered"):
        return

    hass.services.async_register(
        DOMAIN, SERVICE_SEND_TEXT, _handle_send_text, schema=SEND_TEXT_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_PLAY_PLAYLIST, _handle_play_playlist, schema=PLAY_PLAYLIST_SCHEMA
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_START_APP,
        _handle_start_app,
        schema=vol.Schema({vol.Required("app"): str}),
    )
    hass.services.async_register(DOMAIN, SERVICE_STOP_APP, _handle_stop_app)
    hass.services.async_register(DOMAIN, SERVICE_SYNC, _handle_sync)
    hass.services.async_register(DOMAIN, SERVICE_SCAN, _handle_scan)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE, _handle_update)
    hass.services.async_register(
        DOMAIN, SERVICE_CALIBRATE, _handle_calibrate, schema=CALIBRATE_SCHEMA
    )
    hass.services.async_register(DOMAIN, SERVICE_HOME_ALL, _handle_home_all)
    hass.services.async_register(
        DOMAIN,
        SERVICE_RECORD_ALL,
        _handle_record_all,
        schema=vol.Schema({vol.Required("index"): vol.Coerce(int)}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SAVE_PLAYLIST,
        _handle_save_playlist,
        schema=vol.Schema(
            {
                vol.Required("name"): str,
                vol.Required("pages"): vol.Any([vol.Any(str, dict)], str),
                vol.Optional("delay", default=5): vol.Coerce(float),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_DELETE_PLAYLIST,
        _handle_delete_playlist,
        schema=vol.Schema({vol.Required("name"): str}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_RUN_SAVED_PLAYLIST,
        _handle_run_saved_playlist,
        schema=vol.Schema({vol.Required("name"): str}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_SETTINGS,
        _handle_set_settings,
        schema=vol.Schema({vol.Required("settings"): dict}),
    )

    domain_data["_services_registered"] = True


def async_unregister_services(hass: HomeAssistant) -> None:
    domain_data = hass.data.get(DOMAIN, {})
    for service in SERVICES:
        if hass.services.has_service(DOMAIN, service):
            hass.services.async_remove(DOMAIN, service)
    domain_data.pop("_services_registered", None)
