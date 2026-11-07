"""Buttons for Split-Flap OS."""

from __future__ import annotations

from typing import Any

from homeassistant.components.button import ButtonEntity
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
    async_add_entities(
        [
            SplitFlapHomeAllButton(runtime),
            SplitFlapScanButton(runtime),
            SplitFlapSyncButton(runtime),
            SplitFlapRefreshButton(runtime),
            SplitFlapStopButton(runtime),
        ]
    )


class SplitFlapActionButton(SplitFlapEntity, ButtonEntity):
    """Base class for one-shot hardware actions."""

    _attr_name: str
    _attr_icon: str

    def __init__(self, runtime: dict[str, Any], key: str) -> None:
        super().__init__(runtime, key)

    async def _press(self) -> None:
        raise NotImplementedError

    async def async_press(self) -> None:
        await self._press()


class SplitFlapHomeAllButton(SplitFlapActionButton):
    """Home every module."""

    _attr_name = "Home all"
    _attr_icon = "mdi:home-import-outline"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "home_all")

    async def _press(self) -> None:
        await self.coordinator.async_home_all()


class SplitFlapScanButton(SplitFlapActionButton):
    """Scan the RS485 bus for modules."""

    _attr_name = "Scan bus"
    _attr_icon = "mdi:radar"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "scan")

    async def _press(self) -> None:
        await self.coordinator.async_scan()


class SplitFlapSyncButton(SplitFlapActionButton):
    """Ask the master to republish its current state."""

    _attr_name = "Sync state"
    _attr_icon = "mdi:sync"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "sync")

    async def _press(self) -> None:
        await self.coordinator.async_sync()


class SplitFlapRefreshButton(SplitFlapActionButton):
    """Refresh the known modules without a full bus scan."""

    _attr_name = "Refresh modules"
    _attr_icon = "mdi:refresh"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "refresh")

    async def _press(self) -> None:
        await self.coordinator.async_update()


class SplitFlapStopButton(SplitFlapActionButton):
    """Stop the app or playlist and leave the current text showing."""

    _attr_name = "Stop display"
    _attr_icon = "mdi:stop"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "stop")

    async def _press(self) -> None:
        await self.engine.async_stop()
