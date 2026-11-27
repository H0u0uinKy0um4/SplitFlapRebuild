"""Pure-Python probes for the HA-free module-status normalization module.

Run with ``python3 tests/test_module_status.py``. No Home Assistant is
installed or imported; every probe crosses the same ``ingest()`` /
``snapshot()`` seam the coordinator uses.
"""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import layout  # noqa: E402
import module_status  # noqa: E402


DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw"
ALTERNATE = " ZYXWVUTSRQPONMLKJIHGFEDCBA0987654321!@#$&()-+=;q:%'.,/?*roygbpw"


def raw_payload() -> dict:
    """A status payload using firmware alias spellings (see protocol docs)."""

    return {
        "state": "online",
        "text": "HELLO",
        "version": "1.1.0.0",
        "bus_compat": 1,
        "compat": 1,
        "modules_count": 1,
        "modules": [
            {
                "id": 1,
                "state": "online",
                "flapList": DRUM,
                "pos": "3616",
                "currentIndex": 1,
                "homeOffset": "2832",
                "totalStepsPerRev": "4096",
                "positionMap": "0=2832,1=2896",
                "connected": "yes",
                "firmwareVersion": " 1.0.1 ",
                "isBusy": "false",
                "positionValid": 1,
                "details": {"maxSteps": 4096, "drumChars": DRUM},
                "flap": "A",
                "customThing": 7,
            }
        ],
        "ota": {"state": "collecting", "progress": 3, "received": 2304, "error": ""},
        "master_ota": {
            "state": "collecting",
            "progress": 20,
            "received": 2048,
            "size": 10240,
            "version": "1.1.0.0",
            "target_version": "1.2.0.0",
            "error": "",
        },
        "ip": "10.0.1.42",
    }


def panel_snapshot(status: module_status.ModuleStatus, *, online: bool = True) -> dict:
    return status.snapshot(
        prefix="splitflap",
        online=online,
        status="online" if online else "offline",
        text="HELLO",
        last_status="2026-11-25T00:00:00+00:00",
        restored=False,
        mqtt_compat=1,
    )


class AliasResolutionTests(unittest.TestCase):
    def test_aliases_become_one_canonical_module(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        module = status.modules["1"]

        self.assertEqual(module["flap_list"], list(DRUM))
        self.assertEqual(module["current_step"], 3616)
        self.assertEqual(module["current_index"], 1)
        self.assertEqual(module["home_offset"], 2832)
        self.assertEqual(module["total_steps"], 4096)
        self.assertTrue(module["online"])
        self.assertFalse(module["busy"])
        self.assertTrue(module["position_known"])
        self.assertEqual(module["fw_version"], "1.0.1")
        self.assertEqual(module["map_of_positions"], {"0": 2832, "1": 2896})
        self.assertEqual(module["extra_stats"], {"customThing": 7})
        self.assertEqual(module["state"], "online")

    def test_master_versions_resolve_once(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        self.assertEqual(status.master_version, "1.1.0.0")
        self.assertEqual(status.master_bus_compat, 1)
        self.assertEqual(status.master_mqtt_compat, 1)
        self.assertTrue(status.compat_ok(1))

    def test_legacy_compat_fallback_and_unknown_generation(self) -> None:
        fresh = module_status.ModuleStatus()
        self.assertIsNone(fresh.compat_ok(1))

        status = module_status.ModuleStatus()
        status.ingest(
            {"version": "1.0.0", "compat": 2, "mqtt_compat": 3}, online=True
        )
        self.assertEqual(status.master_mqtt_compat, 3)
        self.assertFalse(status.compat_ok(1))

        legacy = module_status.ModuleStatus()
        legacy.ingest({"compat": 2}, online=True)
        self.assertEqual(legacy.master_mqtt_compat, 2)

    def test_ota_status_is_normalized(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        self.assertEqual(
            status.ota,
            {"state": "collecting", "progress": 3, "received": 2304},
        )

    def test_master_ota_and_recovery_ip_are_normalized(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        self.assertEqual(status.master_ip, "10.0.1.42")
        self.assertEqual(status.master_ota["state"], "collecting")
        self.assertEqual(status.master_ota["progress"], 20)
        self.assertEqual(status.master_ota["target_version"], "1.2.0.0")
        self.assertIsNone(status.master_ota["error"])
        snapshot = panel_snapshot(status)
        self.assertEqual(snapshot["master_ip"], "10.0.1.42")
        self.assertEqual(snapshot["master_ota"], status.master_ota)
        self.assertEqual(panel_snapshot(status)["ota"], status.ota)


class FlapDerivationTests(unittest.TestCase):
    def test_map_hit_and_linear_fallback_share_one_derivation(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        module = status.modules["1"]
        self.assertEqual(module["flap_index"], 1)
        self.assertEqual(module["flap_position"], 2896)

        # Remove the tuned entry: the very same derivation uses home_offset
        # and the geometric position instead.
        module["map_of_positions"].pop("1")
        snapshot = panel_snapshot(status)["modules"][0]
        self.assertEqual(snapshot["flap_index"], 1)
        self.assertEqual(snapshot["flap_position"], 2832 + 64)

    def test_desired_character_drives_display_state(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        status.desired_chars["1"] = "Z"
        module = panel_snapshot(status)["modules"][0]
        self.assertEqual(module["actual_flap"], "A")
        self.assertEqual(module["flap"], "A")
        self.assertEqual(module["desired_flap"], "Z")
        self.assertEqual(module["displayed_flap"], "Z")
        self.assertEqual(module["display_flap_index"], 26)
        # 26 steps past home_offset wraps once around the 4096-step drum.
        self.assertEqual(module["display_flap_position"], (2832 + 1664) % 4096)

    def test_stale_derived_values_are_removed(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        status.modules["1"]["flap_list"] = ["Z"]
        module = status.module_snapshot("1", master_online=True)
        self.assertNotIn("flap_index", module)
        self.assertNotIn("flap_position", module)
        self.assertIsNone(module["display_flap_index"])
        self.assertNotIn("extra_stats", module.get("extra_stats", {}))


class DrumPriorityTests(unittest.TestCase):
    def test_reported_then_configured_then_stock(self) -> None:
        configured = module_status.ModuleStatus(drum_provider=lambda: ALTERNATE)
        self.assertEqual(configured.effective_drum(9), list(ALTERNATE))

        stock = module_status.ModuleStatus()
        self.assertEqual(stock.effective_drum(9), list(layout.DEFAULT_DRUM))

        status = module_status.ModuleStatus(drum_provider=lambda: ALTERNATE)
        status.ingest(raw_payload(), online=True)
        self.assertEqual(status.effective_drum(1), list(DRUM))

    def test_short_or_multiline_configured_drum_is_rejected(self) -> None:
        for bad in ("ABC", ALTERNATE[:32] + "\n" + ALTERNATE[33:]):
            status = module_status.ModuleStatus(drum_provider=lambda bad=bad: bad)
            self.assertEqual(status.effective_drum(9), list(layout.DEFAULT_DRUM))


class StateFlowTests(unittest.TestCase):
    def test_offline_last_will_keeps_modules_version_and_ota(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        status.ingest({"state": "offline", "modules": []}, online=False)

        self.assertEqual(status.modules_count, 1)
        self.assertEqual(status.master_version, "1.1.0.0")
        self.assertEqual(status.ota["state"], "collecting")
        module = panel_snapshot(status, online=False)["modules"][0]
        self.assertFalse(module["online"])
        self.assertEqual(module["state"], "online")

    def test_only_count_can_be_updated_without_a_module_list(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        status.ingest({"modules_count": 7}, online=True)
        self.assertEqual(status.modules_count, 7)

    def test_restore_and_persisted_round_trip(self) -> None:
        status = module_status.ModuleStatus()
        stored = {
            "modules": {
                "2": {"id": 2, "flap": "A", "flapList": DRUM, "positions": "0=1=0xFFFF"}
            },
            "modules_count": 1,
            "desired_chars": {2: "A"},
            "text": "HI",
        }
        self.assertTrue(status.restore(stored))
        self.assertEqual(status.module_ids, ["2"])
        self.assertEqual(status.desired_chars, {"2": "A"})
        self.assertEqual(status.modules["2"]["map_of_positions"], {})

        persisted = status.persisted()
        self.assertEqual(persisted["modules_count"], 1)
        self.assertEqual(persisted["desired_chars"], {"2": "A"})
        self.assertFalse(status.restore({}))

    def test_snapshot_exposes_the_panel_contract(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        snapshot = panel_snapshot(status)
        for key in (
            "prefix", "online", "status", "text", "modules", "modules_count",
            "desired_chars", "simulation", "last_status", "restored", "mqtt_compat",
            "master_version", "master_bus_compat", "master_mqtt_compat",
            "mqtt_compat_ok", "compat", "master_compat", "compat_ok", "ota",
            "master_ota", "master_ip",
        ):
            self.assertIn(key, snapshot)
        self.assertEqual(snapshot["compat"], 1)
        self.assertEqual(snapshot["master_compat"], 1)
        self.assertEqual(snapshot["compat_ok"], True)

    def test_simulation_replaces_and_restores_real_modules(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        status.desired_chars["1"] = "A"

        status.set_simulated(45)
        self.assertEqual(status.modules_count, 45)
        self.assertEqual(status.module_ids[:2], ["1", "2"])
        self.assertEqual(status.module_ids[-1], "45")
        self.assertEqual(status.real_modules_count, 1)
        self.assertTrue(status.simulated)
        self.assertEqual(
            panel_snapshot(status)["simulation"],
            {"enabled": True, "module_count": 45, "real_module_count": 1},
        )

        status.desired_chars["1"] = "Z"
        status.ingest(raw_payload(), online=True)
        self.assertEqual(status.modules_count, 45)
        self.assertEqual(status.desired_chars["1"], "Z")
        module = panel_snapshot(status)["modules"][0]
        self.assertTrue(module["simulated"])
        self.assertEqual(module["displayed_flap"], "Z")
        self.assertEqual(status.persisted()["modules_count"], 1)

        status.set_simulated(0)
        self.assertEqual(status.modules_count, 1)
        self.assertEqual(status.module_ids, ["1"])
        self.assertEqual(status.desired_chars, {"1": "A"})
        self.assertFalse(status.simulated)

    def test_changing_simulated_count_rebuilds_from_real_state(self) -> None:
        status = module_status.ModuleStatus()
        status.ingest(raw_payload(), online=True)
        status.set_simulated(45)
        status.set_simulated(100)

        self.assertEqual(status.modules_count, 100)
        self.assertEqual(status.module_ids[-1], "100")
        self.assertEqual(status.real_modules_count, 1)
        status.set_simulated(0)
        self.assertEqual(status.modules_count, 1)


if __name__ == "__main__":
    unittest.main()
