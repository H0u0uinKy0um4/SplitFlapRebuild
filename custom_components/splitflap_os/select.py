"""Select entity for choosing the active data app."""

from __future__ import annotations

from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .apps import app_defs
from .const import DOMAIN
from .entity import SplitFlapEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([SplitFlapAppSelect(runtime)])


class SplitFlapAppSelect(SplitFlapEntity, SelectEntity):
    """Start an app, or turn the display engine off."""

    _attr_translation_key = "app"
    _attr_icon = "mdi:apps"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "app_select")
        self._apps = app_defs()
        self._by_key = {app["key"]: app["name"] for app in self._apps}
        self._by_name = {app["name"]: app["key"] for app in self._apps}
        self._attr_options = [*self._by_key.values(), "Off"]

    @property
    def current_option(self) -> str:
        key = self.engine.active_app
        if not key:
            return "Off"
        return self._by_key.get(key, key)

    async def async_select_option(self, option: str) -> None:
        if option == "Off":
            await self.engine.async_stop()
            return

        key = self._by_name.get(option, option)
        await self.engine.async_start_app(key)
