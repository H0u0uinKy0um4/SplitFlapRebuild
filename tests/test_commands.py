"""Host-side tests for the shared command interface.

Run with ``python3 tests/test_commands.py`` (Home Assistant is not required).
Tests cross the same seam as the panel and automation adapters: one call to
``execute_command`` with an injected runtime, never a private helper.
"""

from __future__ import annotations

import asyncio
import base64
import os
import sys
import unittest
from types import SimpleNamespace
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import commands  # noqa: E402  (path is prepared above)
import firmware_releases  # noqa: E402  (same directory)
import identity  # noqa: E402  (same directory)


def _hex_record(address: int, kind: int, data: bytes = b"") -> str:
    """Build one Intel HEX line (mirrors tests/test_ota.py)."""
    payload = bytes((len(data), (address >> 8) & 0xFF, address & 0xFF, kind)) + data
    checksum = (-sum(payload)) & 0xFF
    return ":" + payload.hex().upper() + f"{checksum:02X}"


VALID_HEX = (
    _hex_record(0x0800, 0x00, b"\xAA") + "\n" + _hex_record(0, 0x01) + "\n"
)


class Recorder:
    """Stand in for an injected engine or coordinator."""

    def __init__(self, prefix: str, failures: dict[str, Exception] | None = None) -> None:
        self.prefix = prefix
        self.calls: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []
        self.failures = failures or {}

    def __getattr__(self, name: str) -> Any:
        async def call(*args: Any, **kwargs: Any) -> str:
            self.calls.append((f"{self.prefix}.{name}", args, kwargs))
            if name in self.failures:
                raise self.failures[name]
            return f"{self.prefix}.{name}"

        return call


def make_runtime(
    engine_failures: dict[str, Exception] | None = None,
    coordinator_failures: dict[str, Exception] | None = None,
) -> dict[str, Recorder]:
    return {
        "engine": Recorder("engine", engine_failures),
        "coordinator": Recorder("coordinator", coordinator_failures),
    }


ALL_COMMANDS = {
    "send_text",
    "notify",
    "play_playlist",
    "start_app",
    "stop_app",
    "set_settings",
    "save_playlist",
    "delete_playlist",
    "run_saved_playlist",
    "save_drum",
    "delete_drum",
    "calibrate",
    "scan",
    "sync",
    "update",
    "home_all",
    "record_all",
    "backup",
    "restore",
    "flash_firmware",
    "list_firmware_releases",
    "flash_firmware_release",
    "cancel_firmware",
    "reset_firmware",
    "list_master_firmware_releases",
    "flash_master_firmware",
    "flash_master_firmware_release",
    "cancel_master_firmware",
}


class CommandInterfaceTests(unittest.TestCase):
    def test_all_command_names_are_pinned(self) -> None:
        self.assertEqual(set(commands.COMMANDS), ALL_COMMANDS)

    def test_each_command_reaches_its_runtime_call(self) -> None:
        drum = "x" * 64
        pages = ["morning", {"text": "evening"}]
        cases: list[
            tuple[str, dict[str, Any], tuple[str, tuple[Any, ...], dict[str, Any]]]
        ] = [
            (
                "send_text",
                {"text": "hello"},
                (
                    "engine.async_send_text",
                    ("hello",),
                    {
                        "start": 1,
                        "style": "ltr",
                        "speed": 15,
                        "stop": True,
                        "raw": False,
                    },
                ),
            ),
            (
                "notify",
                {"text": "hi"},
                (
                    "engine.async_notify",
                    ("hi",),
                    {"seconds": 10.0, "style": "ltr", "priority": 0},
                ),
            ),
            (
                "play_playlist",
                {"pages": pages},
                ("engine.async_play_playlist", (pages, 5.0), {"loop": True}),
            ),
            (
                "start_app",
                {"app": "clock"},
                ("engine.async_start_app", ("clock", None), {"user_id": None}),
            ),
            ("stop_app", {}, ("engine.async_stop", (), {})),
            (
                "set_settings",
                {"settings": {"rows": 3}},
                ("engine.async_set_settings", ({"rows": 3},), {}),
            ),
            (
                "save_playlist",
                {"name": "n", "pages": pages},
                ("engine.async_save_playlist", ("n", pages, 5.0), {}),
            ),
            (
                "delete_playlist",
                {"name": "n"},
                ("engine.async_delete_playlist", ("n",), {}),
            ),
            (
                "run_saved_playlist",
                {"name": "n"},
                ("engine.async_run_saved_playlist", ("n",), {}),
            ),
            (
                "save_drum",
                {"name": "d", "drum": drum},
                ("engine.async_save_drum", ("d", drum), {}),
            ),
            ("delete_drum", {"name": "d"}, ("engine.async_delete_drum", ("d",), {})),
            (
                "calibrate",
                {"module": 3, "action": "goto"},
                (
                    "coordinator.async_calibrate",
                    (),
                    {
                        "module_id": 3,
                        "action": "goto",
                        "index": None,
                        "flap": None,
                        "home_offset": None,
                        "positions": None,
                        "clear_map": False,
                        "steps": None,
                        "drum": None,
                    },
                ),
            ),
            ("scan", {}, ("coordinator.async_scan", (), {})),
            ("sync", {}, ("coordinator.async_sync", (), {})),
            ("update", {}, ("coordinator.async_update", (), {})),
            ("home_all", {}, ("coordinator.async_home_all", (), {})),
            (
                "record_all",
                {"index": 7},
                ("coordinator.async_record_all", (7,), {}),
            ),
            ("backup", {}, ("engine.async_backup", (), {})),
            (
                "restore",
                {"data": {"a": 1}},
                ("engine.async_restore", ({"a": 1},), {}),
            ),
            (
                "flash_firmware",
                {"module": 2, "hex": VALID_HEX},
                ("coordinator.async_flash_image", (2, b"\xAA"), {}),
            ),
            ("cancel_firmware", {}, ("coordinator.async_firmware_cancel", (), {})),
            (
                "reset_firmware",
                {"module": 5},
                ("coordinator.async_firmware_reset", (5,), {}),
            ),
            (
                "cancel_master_firmware",
                {},
                ("coordinator.async_master_firmware_cancel", (), {}),
            ),
        ]
        # Release commands need a catalog in the runtime and are covered below.
        seam_commands = ALL_COMMANDS - {
            "list_firmware_releases",
            "flash_firmware_release",
            "list_master_firmware_releases",
            "flash_master_firmware",
            "flash_master_firmware_release",
        }
        self.assertEqual(len(cases), len(seam_commands))
        for name, data, expected in cases:
            with self.subTest(command=name):
                runtime = make_runtime()
                outcome = asyncio.run(commands.execute_command(name, data, runtime))
                self.assertTrue(outcome.ok, outcome.message)
                calls = runtime["engine"].calls + runtime["coordinator"].calls
                self.assertEqual(calls, [expected])
                self.assertEqual(outcome.result, expected[0])

    def test_coercion_happens_behind_the_seam(self) -> None:
        runtime = make_runtime()
        outcome = asyncio.run(
            commands.execute_command("record_all", {"index": "12"}, runtime)
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(
            runtime["coordinator"].calls,
            [("coordinator.async_record_all", (12,), {})],
        )

    def test_pages_accept_a_json_string(self) -> None:
        runtime = make_runtime()
        outcome = asyncio.run(
            commands.execute_command(
                "play_playlist",
                {"pages": '["morning", {"text": "evening"}]'},
                runtime,
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(
            runtime["engine"].calls[0][1][0],
            ["morning", {"text": "evening"}],
        )

    def test_positions_are_normalized_behind_the_seam(self) -> None:
        runtime = make_runtime()
        outcome = asyncio.run(
            commands.execute_command(
                "calibrate",
                {"module": "3", "action": "set_positions", "positions": "7=12"},
                runtime,
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        kwargs = runtime["coordinator"].calls[0][2]
        self.assertEqual(kwargs["module_id"], "3")
        self.assertEqual(kwargs["positions"], {"7": 12})

    def test_unknown_command_fails_as_invalid_request(self) -> None:
        outcome = asyncio.run(
            commands.execute_command("not_a_command", {}, make_runtime())
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.error, commands.INVALID_REQUEST)
        self.assertIsInstance(outcome.exception, ValueError)

    def test_missing_required_field_fails_as_invalid_request(self) -> None:
        outcome = asyncio.run(
            commands.execute_command("delete_playlist", {}, make_runtime())
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.error, commands.INVALID_REQUEST)
        self.assertIn("name", outcome.message)

    def test_wrong_field_type_fails_as_invalid_request(self) -> None:
        outcome = asyncio.run(
            commands.execute_command(
                "set_settings", {"settings": "not a mapping"}, make_runtime()
            )
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.error, commands.INVALID_REQUEST)

    def test_value_error_keeps_invalid_request_and_original_exception(self) -> None:
        err = ValueError("Drum must be exactly 64 characters without line breaks")
        runtime = make_runtime(engine_failures={"async_save_drum": err})
        outcome = asyncio.run(
            commands.execute_command(
                "save_drum", {"name": "d", "drum": "short"}, runtime
            )
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.error, commands.INVALID_REQUEST)
        self.assertIs(outcome.exception, err)

    def test_other_exception_becomes_command_failed(self) -> None:
        err = RuntimeError("mqtt offline")
        runtime = make_runtime(coordinator_failures={"async_scan": err})
        outcome = asyncio.run(commands.execute_command("scan", {}, runtime))
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.error, commands.COMMAND_FAILED)
        self.assertIs(outcome.exception, err)

    def test_invalid_hex_fails_as_invalid_request(self) -> None:
        outcome = asyncio.run(
            commands.execute_command(
                "flash_firmware", {"module": 2, "hex": "not a hex file"}, make_runtime()
            )
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.error, commands.INVALID_REQUEST)
        self.assertIsInstance(outcome.exception, ValueError)

    def test_user_identity_is_an_input_to_the_same_interface(self) -> None:
        runtime = make_runtime()
        outcome = asyncio.run(
            commands.execute_command(
                "start_app", {"app": "clock"}, runtime, user_id="user-42"
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(
            runtime["engine"].calls,
            [("engine.async_start_app", ("clock", None), {"user_id": "user-42"})],
        )


class ReleaseCommandTests(unittest.TestCase):
    def _release(self, **overrides):
        values = {
            "tag": "dev",
            "channel": "dev",
            "version": "dev-a1b2c3d",
            "fw_bus_compat": 1,
            "ota_protocol_version": 1,
            "bootloader_version": 1,
        }
        values.update(overrides)
        release = SimpleNamespace(**values)
        release.as_dict = lambda: dict(values)  # type: ignore[attr-defined]
        return release

    def _runtime(self, release):
        class Catalog:
            def __init__(self) -> None:
                self.calls: list[tuple[str, dict[str, Any]]] = []

            async def list(self, **kwargs):
                self.calls.append(("list", kwargs))
                return {"releases": [], "stale": False, "count": 0}

            async def get(self, tag, *, refresh=True):
                self.calls.append(("get", {"tag": tag, "refresh": refresh}))
                return release

            async def fetch_image(self, item):
                self.calls.append(("fetch_image", {}))
                return b"\xaa"

        class Coordinator:
            master_bus_compat = 1

            def __init__(self) -> None:
                self.calls: list[tuple[Any, ...]] = []

            def snapshot(self):
                return {"ota": {"state": "idle"}}

            def module_snapshot(self, module_id):
                return {"fw_bus_compatible": True}

            async def async_flash_image(self, module, image):
                self.calls.append((module, image))
                return {"size": len(image), "crc32": "00000000"}

        coordinator = Coordinator()
        return {
            "engine": SimpleNamespace(settings={}),
            "coordinator": coordinator,
            "release_catalog": Catalog(),
        }, coordinator

    def test_list_forwards_refresh_and_compatibility_context(self) -> None:
        runtime, _coordinator = self._runtime(self._release())
        outcome = asyncio.run(
            commands.execute_command(
                "list_firmware_releases", {"refresh": True}, runtime
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(
            runtime["release_catalog"].calls,
            [
                (
                    "list",
                    {
                        "refresh": True,
                        "master_bus_compat": 1,
                        "allow_incompatible": False,
                    },
                )
            ],
        )

    def test_flash_downloads_verifies_and_uses_the_existing_flash_path(self) -> None:
        runtime, coordinator = self._runtime(self._release())
        outcome = asyncio.run(
            commands.execute_command(
                "flash_firmware_release", {"release": "dev", "module": 3}, runtime
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(coordinator.calls, [(3, b"\xaa")])
        self.assertEqual(outcome.result["size"], 1)
        self.assertEqual(
            runtime["release_catalog"].calls[0],
            ("get", {"tag": "dev", "refresh": True}),
        )

    def test_known_mismatch_blocks_with_a_stable_code(self) -> None:
        runtime, coordinator = self._runtime(
            self._release(fw_bus_compat=2)
        )
        outcome = asyncio.run(
            commands.execute_command(
                "flash_firmware_release", {"release": "dev", "module": 3}, runtime
            )
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.message, "firmware_release_bus_mismatch")
        self.assertEqual(coordinator.calls, [])


class MasterReleaseCommandTests(unittest.TestCase):
    """Panel-only master update commands, exercised behind the shared seam."""

    def _release(self, mqtt_compat: int = 2) -> firmware_releases.MasterFirmwareRelease:
        return firmware_releases.MasterFirmwareRelease(
            tag="v1.2.0.0",
            published_at="2026-11-26T00:00:00Z",
            channel="stable",
            version="1.2.0.0",
            mqtt_compat=mqtt_compat,
            bus_compat=1,
            sha256="ab" * 32,
            notes="first master release",
            image_url="https://example.test/firmware.bin",
            manifest_url="https://example.test/firmware.json",
        )

    def _runtime(self, release, *, master_mqtt_compat=2):
        class Catalog:
            def __init__(self) -> None:
                self.calls: list[tuple[str, dict[str, Any]]] = []

            async def list(self, **kwargs):
                self.calls.append(("list", kwargs))
                return {"releases": [release.as_dict()], "stale": False, "count": 1}

            async def get(self, tag, *, refresh=True):
                self.calls.append(("get", {"tag": tag, "refresh": refresh}))
                return release

            async def fetch_image(self, item):
                self.calls.append(("fetch_image", {}))
                return b"\xaa\xbb\xcc"

        class Coordinator:
            def __init__(self) -> None:
                self.calls: list[tuple[bytes, dict[str, Any]]] = []
                self.master_mqtt_compat = master_mqtt_compat

            def snapshot(self):
                return {"mqtt_compat": 2, "master_ota": {"state": "idle"}}

            async def async_flash_master_image(self, image, **kwargs):
                self.calls.append((image, kwargs))
                return {"ok": True, "size": len(image), "chunks": 1}

        coordinator = Coordinator()
        return {
            "engine": SimpleNamespace(settings={}),
            "coordinator": coordinator,
            "master_release_catalog": Catalog(),
        }, coordinator

    def test_list_forwards_both_mqtt_generations(self) -> None:
        runtime, _coordinator = self._runtime(self._release())
        outcome = asyncio.run(
            commands.execute_command(
                "list_master_firmware_releases", {"refresh": True}, runtime
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(
            runtime["master_release_catalog"].calls,
            [
                (
                    "list",
                    {
                        "refresh": True,
                        "mqtt_compat": 2,
                        "master_mqtt_compat": 2,
                        "allow_incompatible": False,
                    },
                )
            ],
        )

    def test_local_upload_decodes_and_checks_compatibility(self) -> None:
        runtime, coordinator = self._runtime(self._release())
        image = b"\xaa\xbb\xcc"
        outcome = asyncio.run(
            commands.execute_command(
                "flash_master_firmware",
                {
                    "base64": base64.b64encode(image).decode("ascii"),
                    "version": "1.2.0.0",
                },
                runtime,
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(coordinator.calls, [(image, {"version": "1.2.0.0", "sha256": None})])
        self.assertEqual(outcome.result["compatibility"]["level"], "ok")

    def test_local_upload_with_incompatible_version_is_blocked(self) -> None:
        runtime, coordinator = self._runtime(self._release())
        outcome = asyncio.run(
            commands.execute_command(
                "flash_master_firmware",
                {
                    "base64": base64.b64encode(b"\xaa").decode("ascii"),
                    "version": "1.1.0.0",
                },
                runtime,
            )
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.message, "master_release_mqtt_mismatch")
        self.assertEqual(coordinator.calls, [])

    def test_published_release_is_downloaded_and_flashed(self) -> None:
        runtime, coordinator = self._runtime(self._release())
        outcome = asyncio.run(
            commands.execute_command(
                "flash_master_firmware_release", {"release": "v1.2.0.0"}, runtime
            )
        )
        self.assertTrue(outcome.ok, outcome.message)
        self.assertEqual(
            coordinator.calls,
            [(b"\xaa\xbb\xcc", {"version": "1.2.0.0", "sha256": "ab" * 32})],
        )
        self.assertEqual(outcome.result["release"]["version"], "1.2.0.0")

    def test_release_blocked_when_master_reports_another_generation(self) -> None:
        runtime, coordinator = self._runtime(
            self._release(), master_mqtt_compat=1
        )
        outcome = asyncio.run(
            commands.execute_command(
                "flash_master_firmware_release", {"release": "v1.2.0.0"}, runtime
            )
        )
        self.assertFalse(outcome.ok)
        self.assertEqual(outcome.message, "master_release_master_mqtt_mismatch")
        self.assertEqual(coordinator.calls, [])


class IdentityAdapterTests(unittest.TestCase):
    def test_current_connection_user(self) -> None:
        source = SimpleNamespace(user=SimpleNamespace(id="abc"))
        self.assertEqual(identity.resolve_user_id(source), "abc")

    def test_legacy_connection_user_id(self) -> None:
        source = SimpleNamespace(user_id="legacy")
        self.assertEqual(identity.resolve_user_id(source), "legacy")

    def test_context_factory_receives_the_message(self) -> None:
        source = SimpleNamespace(
            context=lambda msg: SimpleNamespace(user_id=msg["uid"])
        )
        self.assertEqual(
            identity.resolve_user_id(source, {"uid": "from-context"}), "from-context"
        )

    def test_failing_context_factory_yields_no_identity(self) -> None:
        def broken(_msg: dict[str, Any]) -> None:
            raise RuntimeError("no user")

        self.assertIsNone(identity.resolve_user_id(SimpleNamespace(context=broken), {}))

    def test_service_call_context(self) -> None:
        source = SimpleNamespace(context=SimpleNamespace(user_id="service-user"))
        self.assertEqual(identity.resolve_user_id(source), "service-user")

    def test_entity_context(self) -> None:
        source = SimpleNamespace(context=SimpleNamespace(user_id="entity-user"))
        self.assertEqual(identity.resolve_user_id(source), "entity-user")

    def test_no_identity(self) -> None:
        self.assertIsNone(identity.resolve_user_id(None))


if __name__ == "__main__":
    unittest.main()
