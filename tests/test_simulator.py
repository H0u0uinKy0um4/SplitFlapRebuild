"""Host test for the offline module simulator's MQTT safety boundary.

Run with ``python3 tests/test_simulator.py``. Home Assistant is not installed,
so the MQTT transport and HA helpers are stubbed. The probe drives the real
coordinator: simulation must build virtual modules, keep preview state moving,
and never publish a command to hardware.
"""

from __future__ import annotations

import asyncio
import sys
import types
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMPONENT_DIR = HERE.parent / "custom_components" / "splitflap_os"
sys.path.insert(0, str(COMPONENT_DIR))

PUBLISHED: list[tuple[str, str]] = []


async def fake_publish(hass, topic: str, payload: str) -> None:
    PUBLISHED.append((topic, payload))


def stub(name: str, **attrs) -> types.ModuleType:
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    sys.modules[name] = module
    return module


stub("homeassistant")
stub("homeassistant.components")
stub("homeassistant.components.mqtt", async_publish=fake_publish)
stub("homeassistant.config_entries", ConfigEntry=dict)
stub(
    "homeassistant.core",
    CALLBACK_TYPE=object,
    HomeAssistant=object,
    callback=lambda fn: fn,
)
stub("homeassistant.helpers")
stub("homeassistant.helpers.device_registry", DeviceInfo=dict)
stub("homeassistant.helpers.dispatcher", async_dispatcher_send=lambda *a: None)
stub("homeassistant.helpers.event", async_call_later=lambda *a, **k: None)
stub("homeassistant.helpers.storage", Store=object)
stub("homeassistant.util")
stub("homeassistant.util.dt")
stub(
    "homeassistant.const",
    Platform=types.SimpleNamespace(
        SENSOR="sensor", BUTTON="button", TEXT="text", SELECT="select"
    ),
)

package = types.ModuleType("splitflap_os_simulator_stub")
package.__path__ = [str(COMPONENT_DIR)]
sys.modules[package.__name__] = package

from splitflap_os_simulator_stub.coordinator import SplitFlapCoordinator  # noqa: E402
from splitflap_os_simulator_stub.module_status import ModuleStatus  # noqa: E402


DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw"


class SimulatorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        PUBLISHED.clear()
        self.coordinator = object.__new__(SplitFlapCoordinator)
        self.coordinator.hass = types.SimpleNamespace()
        self.coordinator.prefix = "splitflap"
        self.coordinator.signal = "test"
        self.coordinator.data = {"status": "online", "text": "REAL"}
        self.coordinator.status = ModuleStatus()
        self.coordinator.status.ingest(
            {
                "state": "online",
                "modules_count": 1,
                "modules": [{"id": 1, "flap": "A", "flap_list": DRUM}],
            },
            online=True,
        )
        self.coordinator.status.desired_chars["1"] = "A"

    async def test_simulation_suppresses_every_publish_but_keeps_preview_state(self) -> None:
        self.coordinator.set_simulation(45)

        self.assertEqual(self.coordinator.modules_count, 45)
        self.assertEqual(self.coordinator.module_ids[-1], "45")
        self.assertTrue(self.coordinator.online)
        snapshot = self.coordinator.snapshot()
        self.assertEqual(snapshot["status"], "simulated")
        self.assertEqual(snapshot["simulation"]["module_count"], 45)

        await self.coordinator.async_show_chars({"1": "Z"}, ["1"])
        await self.coordinator.async_sync()
        await self.coordinator.async_scan()
        await self.coordinator.async_update()
        await self.coordinator.async_firmware_begin(1)
        await self.coordinator.async_calibrate(module_id=1, action="goto", flap="B")
        result = await self.coordinator.async_calibrate(
            module_id=1, action="drum_write", drum=DRUM
        )

        self.assertEqual(PUBLISHED, [])
        self.assertEqual(self.coordinator.desired_chars["1"], "Z")
        self.assertEqual(result, {"ok": True, "verified": True})

    async def test_live_status_is_ignored_and_transport_status_restored(self) -> None:
        self.coordinator.set_simulation(45)
        self.assertEqual(self.coordinator.data["status"], "simulated")

        self.coordinator._handle_status_payload(
            {
                "state": "offline",
                "modules_count": 2,
                "text": "LIVE",
                "modules": [
                    {"id": 1, "flap": "B", "flap_list": DRUM},
                    {"id": 2, "flap": "C", "flap_list": DRUM},
                ],
            }
        )
        snapshot = self.coordinator.snapshot()
        self.assertEqual(snapshot["status"], "simulated")
        self.assertTrue(snapshot["online"])
        self.assertEqual(self.coordinator.modules_count, 45)
        self.assertEqual(self.coordinator.desired_chars["1"], " ")

        self.coordinator.set_simulation(0)
        self.assertFalse(self.coordinator.simulation_enabled)
        self.assertEqual(self.coordinator.data["status"], "online")
        self.assertEqual(self.coordinator.modules_count, 1)

    async def test_switching_simulation_off_restores_the_real_module(self) -> None:
        self.coordinator.set_simulation(100)
        self.assertEqual(self.coordinator.modules_count, 100)
        self.assertEqual(self.coordinator.real_modules_count, 1)

        self.coordinator.set_simulation(0)

        self.assertFalse(self.coordinator.simulation_enabled)
        self.assertEqual(self.coordinator.modules_count, 1)
        self.assertEqual(self.coordinator.module_ids, ["1"])
        self.assertEqual(self.coordinator.desired_chars, {"1": "A"})


if __name__ == "__main__":
    unittest.main()
