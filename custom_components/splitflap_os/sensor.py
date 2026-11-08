"""Sensors for Split-Flap OS."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
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
            SplitFlapStatusSensor(runtime),
            SplitFlapModuleCountSensor(runtime),
            SplitFlapDisplaySensor(runtime),
            SplitFlapActiveAppSensor(runtime),
        ]
    )


class SplitFlapStatusSensor(SplitFlapEntity, SensorEntity):
    """Online/offline state of the ESP32 master."""

    _attr_translation_key = "status"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = ["online", "offline"]

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "status")

    @property
    def native_value(self) -> str:
        return "online" if self.coordinator.online else "offline"

    @property
    def icon(self) -> str:
        return "mdi:lan-connect" if self.coordinator.online else "mdi:lan-disconnect"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        snapshot = self.coordinator.snapshot()
        return {
            "mqtt_prefix": snapshot.get("prefix"),
            "modules_count": snapshot.get("modules_count"),
            "last_status": snapshot.get("last_status"),
            "restored": snapshot.get("restored"),
        }


class SplitFlapModuleCountSensor(SplitFlapEntity, SensorEntity):
    """Number of modules reported by the master."""

    _attr_translation_key = "module_count"
    _attr_icon = "mdi:dots-grid"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "module_count")

    @property
    def native_value(self) -> int:
        return self.coordinator.modules_count


class SplitFlapDisplaySensor(SplitFlapEntity, SensorEntity):
    """The last text the integration sent to the display."""

    _attr_translation_key = "display_text"
    _attr_icon = "mdi:format-text"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "display_text")

    @property
    def native_value(self) -> str:
        text = str(self.engine.snapshot()["display"].get("text") or "")
        return text[:255]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        snapshot = self.engine.snapshot()
        return {
            "lines": snapshot["display"].get("lines", []),
            "mode": snapshot.get("mode"),
            "active_app": snapshot.get("active_app"),
            "current_page_index": snapshot.get("current_page_index"),
            "current_page_count": snapshot.get("current_page_count"),
        }


class SplitFlapActiveAppSensor(SplitFlapEntity, SensorEntity):
    """The app or mode currently driving the display."""

    _attr_translation_key = "active_app"
    _attr_icon = "mdi:play-box-multiple"

    def __init__(self, runtime: dict[str, Any]) -> None:
        super().__init__(runtime, "active_app")

    @property
    def native_value(self) -> str:
        return str(self.engine.active_app or self.engine.mode or "idle")

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        snapshot = self.engine.snapshot()
        return {
            "mode": snapshot.get("mode"),
            "running": snapshot.get("running"),
            "current_page_index": snapshot.get("current_page_index"),
            "current_page_count": snapshot.get("current_page_count"),
            "board": snapshot.get("board"),
        }
