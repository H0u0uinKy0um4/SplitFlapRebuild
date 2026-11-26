"""Host tests for the master self-update status contract.

Run with ``python3 tests/test_master_ota.py``. The helpers are Home Assistant
free, so the published status shape can be checked without a running server.
"""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import master_ota  # noqa: E402  (path is prepared above)


class VersionTests(unittest.TestCase):
    def test_master_version_carries_mqtt_generation(self) -> None:
        """Master versions are <bus>.<mqtt>.<release>, unlike slave versions."""

        self.assertEqual(master_ota.master_mqtt_from_version("1.2.0.0"), 2)
        self.assertEqual(master_ota.master_mqtt_from_version(" 1.11.3.4 "), 11)
        self.assertIsNone(master_ota.master_mqtt_from_version("1.0.1"))
        self.assertIsNone(master_ota.master_mqtt_from_version("v2.0.0"))
        self.assertIsNone(master_ota.master_mqtt_from_version(None))


class NormalizeTests(unittest.TestCase):
    def test_empty_status_is_always_present(self) -> None:
        self.assertEqual(
            master_ota.empty_master_ota(),
            {
                "state": "idle",
                "progress": 0,
                "received": 0,
                "size": 0,
                "version": None,
                "target_version": None,
                "error": None,
            },
        )

    def test_normalize_keeps_known_state_and_clamps_counters(self) -> None:
        normalized = master_ota.normalize_master_ota(
            {
                "state": "COLLECTING",
                "progress": 140,
                "received": 512,
                "size": 1024,
                "version": "1.2.0.0",
                "target_version": "1.2.1.0",
                "error": "  ",
                "extra": "ignored",
            }
        )
        self.assertEqual(normalized["state"], "collecting")
        self.assertEqual(normalized["progress"], 100)
        self.assertEqual(normalized["received"], 512)
        self.assertEqual(normalized["size"], 1024)
        self.assertEqual(normalized["version"], "1.2.0.0")
        self.assertEqual(normalized["target_version"], "1.2.1.0")
        self.assertIsNone(normalized["error"])
        self.assertNotIn("extra", normalized)

    def test_unknown_state_falls_back_to_idle(self) -> None:
        normalized = master_ota.normalize_master_ota(
            {"state": "unknown", "progress": -5, "received": -1}
        )
        self.assertEqual(normalized["state"], "idle")
        self.assertEqual(normalized["progress"], 0)
        self.assertEqual(normalized["received"], 0)

    def test_active_states_cover_the_whole_session(self) -> None:
        self.assertEqual(
            set(master_ota.MASTER_OTA_STATES_ACTIVE),
            {"collecting", "applying", "rebooting"},
        )
        self.assertNotIn("done", master_ota.MASTER_OTA_STATES_ACTIVE)
        self.assertNotIn("failed", master_ota.MASTER_OTA_STATES_ACTIVE)


class ContractTests(unittest.TestCase):
    def test_transport_limits_are_stable(self) -> None:
        self.assertEqual(master_ota.MASTER_OTA_CHUNK_BYTES, 768)
        self.assertEqual(master_ota.MASTER_OTA_MAX_SIZE, 0x1E0000)
        # The published mqtt-compat-2 master image must fit in one app slot.
        self.assertGreater(master_ota.MASTER_OTA_MAX_SIZE, 1_477_664)
        self.assertEqual(master_ota.MASTER_OTA_REBOOT_TIMEOUT_SECONDS, 300)

    def test_actions_match_the_master_topic(self) -> None:
        self.assertEqual(
            [
                master_ota.MASTER_FIRMWARE_ACTION_BEGIN,
                master_ota.MASTER_FIRMWARE_ACTION_CHUNK,
                master_ota.MASTER_FIRMWARE_ACTION_FLASH,
                master_ota.MASTER_FIRMWARE_ACTION_CANCEL,
            ],
            ["begin", "chunk", "flash", "cancel"],
        )


if __name__ == "__main__":
    unittest.main()
