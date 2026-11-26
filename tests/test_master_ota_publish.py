"""Host test for the master firmware publish stream.

Run with ``python3 tests/test_master_ota_publish.py``. Home Assistant is not
installed, so the MQTT transport is stubbed. The probe drives the real
``async_flash_master_image`` loop with the published image size and asserts
that the chunk stream stays small enough for the master's MQTT receive buffer
and the broker's per-client queue.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
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

package = types.ModuleType("splitflap_os_stub")
package.__path__ = [str(COMPONENT_DIR)]
sys.modules[package.__name__] = package

from splitflap_os_stub import coordinator as coordinator_module  # noqa: E402
from splitflap_os_stub.coordinator import SplitFlapCoordinator  # noqa: E402
from splitflap_os_stub.master_ota import (  # noqa: E402
    MASTER_OTA_CHUNK_BYTES,
    MASTER_OTA_CHUNK_PAUSE_SECONDS,
    MASTER_OTA_MAX_SIZE,
)

# The master setBufferSize(24576) in its MQTT adapter; a chunk command must
# leave room for the fixed header, topic and JSON envelope.
MASTER_MQTT_BUFFER_BYTES = 24576
# Published mqtt-compat-2 firmware.bin.
PUBLISHED_IMAGE_BYTES = 1_477_664


class MasterPublishTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        # Keep the probe fast; the real pacing is pinned in test_master_ota.py.
        self._pause = coordinator_module.MASTER_OTA_CHUNK_PAUSE_SECONDS
        coordinator_module.MASTER_OTA_CHUNK_PAUSE_SECONDS = 0.0

    def tearDown(self) -> None:
        coordinator_module.MASTER_OTA_CHUNK_PAUSE_SECONDS = self._pause

    async def test_full_image_uses_a_bounded_chunk_stream(self) -> None:
        PUBLISHED.clear()
        image = bytes((i * 7 + 3) & 0xFF for i in range(PUBLISHED_IMAGE_BYTES))
        digest = hashlib.sha256(image).hexdigest()

        coordinator = object.__new__(SplitFlapCoordinator)
        coordinator.hass = types.SimpleNamespace()
        coordinator.prefix = "splitflap"
        coordinator.data = {"status": "online"}
        coordinator.status = types.SimpleNamespace(
            ota={"state": "idle"}, master_ota={"state": "idle"}
        )

        result = await coordinator.async_flash_master_image(image, version="1.2.0.0")
        chunks = [payload for _, payload in PUBLISHED if '"action": "chunk"' in payload]
        begins = [payload for _, payload in PUBLISHED if '"action": "begin"' in payload]
        flashes = [payload for _, payload in PUBLISHED if '"action": "flash"' in payload]

        encoded_chunks = [json.loads(payload)["data"] for payload in chunks]

        self.assertEqual(len(begins), 1)
        self.assertEqual(len(flashes), 1)
        # Padding in a non-final chunk shifts the master's carried base64 bits.
        self.assertTrue(all("=" not in data for data in encoded_chunks[:-1]))
        self.assertEqual(len(encoded_chunks[0]), 10_920)
        self.assertEqual(result["chunks"], len(chunks))
        self.assertEqual(result["sha256"], digest)
        self.assertEqual(len(image), PUBLISHED_IMAGE_BYTES)
        self.assertLessEqual(len(image), MASTER_OTA_MAX_SIZE)
        self.assertGreater(MASTER_OTA_CHUNK_PAUSE_SECONDS, 0)

        # 768-byte chunks produced 1,925 QoS-0 messages and the broker dropped
        # the tail; the stream must stay far below a broker client queue.
        self.assertLessEqual(len(chunks), 256, "too many tiny chunk messages")
        self.assertEqual(
            len(chunks),
            (PUBLISHED_IMAGE_BYTES + MASTER_OTA_CHUNK_BYTES - 1)
            // MASTER_OTA_CHUNK_BYTES,
        )
        self.assertLess(
            max(len(payload) for payload in chunks),
            MASTER_MQTT_BUFFER_BYTES,
            "chunk payload does not fit the master's MQTT buffer",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
