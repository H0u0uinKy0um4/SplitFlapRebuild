"""Text entity for sending a message to the display."""

from __future__ import annotations

from typing import Any

from homeassistant.components.text import TextEntity, TextMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .entity import SplitFlapEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([SplitFlapDisplayText(runtime)])


class SplitFlapDisplayText(SplitFlapEntity, TextEntity):
    """Write a value here to push it to the split-flap board."""

    _attr_name = "Set display text"
    _attr_icon = "mdi:format-text"
    _attr_mode = TextMode.TEXT
    _attr_native_min = 0
    _attr_native_max = 255

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "display_text_entity")

    @property
    def native_value(self) -> str:
        text = str(self.engine.snapshot()["display"].get("text") or "")
        return text[:255]

    async def async_set_value(self, value: str) -> None:
        await self.engine.async_send_text(value, stop=True)
