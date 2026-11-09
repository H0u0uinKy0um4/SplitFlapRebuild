"""The Split-Flap OS integration."""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    COORDINATOR_STORAGE_VERSION,
    DOMAIN,
    ENGINE_STORAGE_VERSION,
    PLATFORMS,
)
from .coordinator import SplitFlapCoordinator
from .engine import AppEngine
from .panel import async_register_panel, async_unregister_panel
from .runtime import iter_runtimes
from .services import async_register_services, async_unregister_services
from .websocket_api import async_register_websocket_api

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the Split-Flap OS component."""

    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up one Split-Flap OS config entry."""

    domain_data = hass.data.setdefault(DOMAIN, {})

    if entry.entry_id in domain_data:
        return True

    coordinator = SplitFlapCoordinator(hass, entry)
    engine = AppEngine(hass, entry, coordinator)

    try:
        await coordinator.async_setup()
        await engine.async_setup()

        domain_data[entry.entry_id] = {
            "entry": entry,
            "coordinator": coordinator,
            "engine": engine,
        }

        await async_register_services(hass)
        async_register_websocket_api(hass)
        await async_register_panel(hass)

        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    except Exception:
        domain_data.pop(entry.entry_id, None)
        await engine.async_unload()
        await coordinator.async_unload()
        raise

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    _LOGGER.info(
        "Split-Flap OS started for MQTT prefix %s", coordinator.prefix
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Split-Flap OS config entry."""

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unload_ok:
        return False

    runtime = hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    if isinstance(runtime, dict):
        await runtime["engine"].async_unload()
        await runtime["coordinator"].async_unload()

    if not any(True for _ in iter_runtimes(hass)):
        async_unregister_services(hass)

    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Remove the panel and persisted data when the entry is deleted."""

    await async_unregister_panel(hass)

    await Store(
        hass, ENGINE_STORAGE_VERSION, f"{DOMAIN}.engine.{entry.entry_id}"
    ).async_remove()
    await Store(
        hass, COORDINATOR_STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
    ).async_remove()


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload when configuration options change."""

    await hass.config_entries.async_reload(entry.entry_id)
