"""Shared entity base class for Split-Flap OS."""

from __future__ import annotations

from typing import Any

from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity

from .const import DOMAIN


class SplitFlapEntity(Entity):
    """Base entity that refreshes on engine and coordinator updates."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, runtime: dict[str, Any], key: str) -> None:
        self.runtime = runtime
        self.coordinator = runtime["coordinator"]
        self.engine = runtime["engine"]
        self.entry = runtime["entry"]
        self._attr_unique_id = f"{DOMAIN}_{self.entry.entry_id}_{key}"
        self._attr_device_info = self.coordinator.device_info

    async def async_added_to_hass(self) -> None:
        """Subscribe to display updates."""

        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, self.engine.signal, self.async_write_ha_state
            )
        )
