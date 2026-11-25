"""Home Assistant services for Split-Flap OS."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall

from .commands import execute_command
from .const import DOMAIN
from .identity import resolve_user_id
from .runtime import get_runtime

_LOGGER = logging.getLogger(__name__)

SERVICE_SEND_TEXT = "send_text"
SERVICE_NOTIFY = "notify"
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
    SERVICE_NOTIFY,
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


async def _run_command_service(
    hass: HomeAssistant,
    name: str,
    data: dict[str, Any] | None = None,
    *,
    user_id: str | None = None,
    warn_if_missing: bool = False,
) -> None:
    """Run a shared command; services report failure by propagating it."""

    runtime = _get_runtime(hass)
    if runtime is None:
        if warn_if_missing:
            _LOGGER.warning("Split-Flap OS is not configured")
        return
    outcome = await execute_command(name, data or {}, runtime, user_id=user_id)
    if not outcome.ok:
        raise outcome.exception or ValueError(outcome.message)


async def _handle_send_text(call: ServiceCall) -> None:
    await _run_command_service(
        call.hass, "send_text", call.data, warn_if_missing=True
    )


async def _handle_notify(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "notify", call.data, warn_if_missing=True)


async def _handle_play_playlist(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "play_playlist", call.data)


async def _handle_start_app(call: ServiceCall) -> None:
    await _run_command_service(
        call.hass, "start_app", call.data, user_id=resolve_user_id(call.context)
    )


async def _handle_stop_app(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "stop_app")


async def _handle_sync(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "sync")


async def _handle_scan(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "scan")


async def _handle_update(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "update")


async def _handle_calibrate(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "calibrate", call.data)


async def _handle_home_all(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "home_all")


async def _handle_record_all(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "record_all", call.data)


async def _handle_save_playlist(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "save_playlist", call.data)


async def _handle_delete_playlist(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "delete_playlist", call.data)


async def _handle_run_saved_playlist(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "run_saved_playlist", call.data)


async def _handle_set_settings(call: ServiceCall) -> None:
    await _run_command_service(call.hass, "set_settings", call.data)


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

NOTIFY_SCHEMA = vol.Schema(
    {
        vol.Required("text"): vol.All(str, vol.Length(min=1, max=4096)),
        vol.Optional("seconds", default=10): vol.All(
            vol.Coerce(float), vol.Range(min=0.5, max=300)
        ),
        vol.Optional("style", default="ltr"): str,
        vol.Optional("priority", default=0): vol.Coerce(int),
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
        DOMAIN, SERVICE_NOTIFY, _handle_notify, schema=NOTIFY_SCHEMA
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
