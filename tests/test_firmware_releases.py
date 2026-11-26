"""Host tests for published Slave firmware releases.

Run with ``python3 tests/test_firmware_releases.py``. Home Assistant and
aiohttp are not required: the catalog's network calls are injected.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
# Import before adding the component dir to sys.path: asyncio imports the
# stdlib `select`, which this integration shadows with an HA entity module.
from unittest import IsolatedAsyncioTestCase

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import firmware_releases  # noqa: E402  (path is prepared above)

HEX = ":01080000AA4D\n:00000001FF\n"
SHA256 = hashlib.sha256(HEX.encode("utf-8")).hexdigest()
MANIFEST_URL = "https://github.com/example/releases/download/dev/firmware.json"
IMAGE_URL = "https://github.com/example/releases/download/dev/firmware.hex"
MASTER_MANIFEST_URL = (
    "https://github.com/example/releases/download/v1.2.0.0/firmware.json"
)
MASTER_IMAGE_URL = (
    "https://github.com/example/releases/download/v1.2.0.0/firmware.bin"
)
MASTER_BIN = b"\xe9\x00\x00\xa0"
MASTER_SHA256 = hashlib.sha256(MASTER_BIN).hexdigest()


def master_manifest(**overrides):
    data = {
        "schema": 1,
        "kind": "master-app",
        "channel": "stable",
        "version": "1.2.0.0",
        "mqtt_compat": 2,
        "bus_compat": 1,
        "image": "firmware.bin",
        "sha256": MASTER_SHA256,
        "notes": "dual OTA partitions with rollback",
    }
    data.update(overrides)
    return data


def github_master_release(document, published: str = "2026-11-26T10:01:00Z"):
    return {
        "tag_name": "v1.2.0.0",
        "published_at": published,
        "assets": [
            {
                "name": "firmware.json",
                "browser_download_url": MASTER_MANIFEST_URL,
            },
            {"name": "firmware.bin", "browser_download_url": MASTER_IMAGE_URL},
        ],
        "_manifest": document,
    }


def manifest(**overrides):
    data = {
        "schema": 1,
        "kind": "slave-app",
        "channel": "dev",
        "version": "dev-a1b2c3d",
        "fw_bus_compat": 1,
        "fw_release": 2,
        "ota_protocol_version": 1,
        "bootloader_version": 1,
        "sha256": SHA256,
        "source_commit": "a1b2c3d4e5f6",
        "built_at": "2026-11-26T10:00:00Z",
        "asset": "firmware.hex",
    }
    data.update(overrides)
    return data


def github_release(tag: str, document, published: str = "2026-11-26T10:01:00Z"):
    return {
        "tag_name": tag,
        "published_at": published,
        "assets": [
            {
                "name": "firmware.json",
                "browser_download_url": MANIFEST_URL + "?" + tag,
            },
            {
                "name": "firmware.hex",
                "browser_download_url": IMAGE_URL + "?" + tag,
            },
        ],
        "_manifest": document,
    }


async def fake_text(url: str) -> str:
    if url.endswith("firmware.hex") or "firmware.hex?" in url:
        return HEX
    return json.dumps(fake_text.manifest)  # type: ignore[attr-defined]


class ParseManifestTests(unittest.TestCase):
    def test_accepts_a_valid_manifest(self) -> None:
        release = firmware_releases.parse_manifest(
            manifest(),
            tag="dev",
            published_at="2026-11-26T10:01:00Z",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        self.assertEqual(release.channel, "dev")
        self.assertEqual(release.fw_bus_compat, 1)
        self.assertEqual(release.sha256, SHA256)

    def test_rejects_wrong_schema_kind_asset_or_channel(self) -> None:
        for override in (
            {"schema": 2},
            {"kind": "bootloader"},
            {"asset": "firmware.bin"},
            {"channel": "nightly"},
            {"sha256": "nope"},
        ):
            with self.assertRaises(firmware_releases.FirmwareReleaseError):
                firmware_releases.parse_manifest(
                    manifest(**override),
                    tag="dev",
                    published_at="",
                    image_url=IMAGE_URL,
                    manifest_url=MANIFEST_URL,
                )


class CompatibilityTests(unittest.TestCase):
    def test_bus_mismatch_blocks(self) -> None:
        release = firmware_releases.parse_manifest(
            manifest(fw_bus_compat=2),
            tag="dev",
            published_at="",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        result = firmware_releases.check_compatibility(
            release, master_bus_compat=1
        )
        self.assertTrue(result.blocked)
        self.assertIn("firmware_release_bus_mismatch", result.codes)

    def test_ota_generation_mismatch_blocks(self) -> None:
        release = firmware_releases.parse_manifest(
            manifest(ota_protocol_version=2, bootloader_version=1),
            tag="dev",
            published_at="",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        result = firmware_releases.check_compatibility(
            release, master_bus_compat=1, module_bootloader_version=2
        )
        self.assertTrue(result.blocked)
        self.assertIn("firmware_release_ota_protocol_mismatch", result.codes)
        self.assertIn("firmware_release_module_bootloader_mismatch", result.codes)

    def test_override_downgrades_block_to_warning(self) -> None:
        release = firmware_releases.parse_manifest(
            manifest(ota_protocol_version=9),
            tag="dev",
            published_at="",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        result = firmware_releases.check_compatibility(
            release, master_bus_compat=1, allow_incompatible=True
        )
        self.assertEqual(result.level, "warn")
        self.assertIn("firmware_release_override_used", result.codes)

    def test_unknown_master_bus_is_a_warning(self) -> None:
        release = firmware_releases.parse_manifest(
            manifest(),
            tag="dev",
            published_at="",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        result = firmware_releases.check_compatibility(
            release, master_bus_compat=None
        )
        self.assertEqual(result.level, "warn")
        self.assertIn("firmware_release_unknown_bus", result.codes)


class CatalogTests(IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 11, 26, 12, 0, tzinfo=timezone.utc)

    def clock(self):
        return self.now

    async def test_list_sorts_stable_before_dev_and_parses_manifests(self) -> None:
        documents = {}

        async def fetch_text(url: str) -> str:
            key = url.rsplit("?", 1)[-1]
            return json.dumps(documents[key])

        documents["dev"] = manifest()
        documents["v1.0.2"] = manifest(
            channel="stable", version="1.0.2", source_commit="111111111111"
        )
        payload = [
            github_release("dev", documents["dev"], "2026-11-26T11:00:00Z"),
            github_release("v1.0.2", documents["v1.0.2"], "2026-11-25T11:00:00Z"),
        ]

        async def fetch_json(_url: str):
            return payload

        catalog = firmware_releases.ReleaseCatalog(
            fetch_json=fetch_json,
            fetch_text=fetch_text,
            clock=self.clock,
        )
        result = await catalog.list(refresh=True, master_bus_compat=1)
        self.assertEqual([item["tag"] for item in result["releases"]], ["v1.0.2", "dev"])
        self.assertEqual(result["releases"][0]["compatibility"]["level"], "ok")
        self.assertFalse(result["stale"])

    async def test_cache_expiry_and_stale_fallback(self) -> None:
        fake_text.manifest = manifest()  # type: ignore[attr-defined]
        calls = 0

        async def fetch_json(_url: str):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("offline")
            return [github_release("dev", fake_text.manifest)]  # type: ignore[attr-defined]

        catalog = firmware_releases.ReleaseCatalog(
            fetch_json=fetch_json,
            fetch_text=fake_text,
            clock=self.clock,
            ttl_seconds=600,
        )
        first = await catalog.list(refresh=True)
        self.assertFalse(first["stale"])
        self.now += timedelta(seconds=601)
        second = await catalog.list()
        self.assertTrue(second["stale"])
        self.assertEqual(calls, 2)

    async def test_fetch_image_checks_checksum_and_image(self) -> None:
        release = firmware_releases.parse_manifest(
            manifest(),
            tag="dev",
            published_at="",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        catalog = firmware_releases.ReleaseCatalog(fake_text, fake_text)

        image = await catalog.fetch_image(release)
        self.assertEqual(image, b"\xaa")

        bad = firmware_releases.parse_manifest(
            manifest(sha256="0" * 64),
            tag="dev",
            published_at="",
            image_url=IMAGE_URL,
            manifest_url=MANIFEST_URL,
        )
        with self.assertRaises(firmware_releases.FirmwareReleaseError) as caught:
            await catalog.fetch_image(bad)
        self.assertEqual(
            caught.exception.code, "firmware_release_checksum_mismatch"
        )


class ParseMasterManifestTests(unittest.TestCase):
    def test_accepts_a_valid_master_manifest(self) -> None:
        release = firmware_releases.parse_master_manifest(
            master_manifest(),
            tag="v1.2.0.0",
            published_at="2026-11-26T10:01:00Z",
            image_url=MASTER_IMAGE_URL,
            manifest_url=MASTER_MANIFEST_URL,
        )
        self.assertEqual(release.version, "1.2.0.0")
        self.assertEqual(release.mqtt_compat, 2)
        self.assertEqual(release.bus_compat, 1)
        self.assertEqual(release.sha256, MASTER_SHA256)
        self.assertEqual(release.notes, "dual OTA partitions with rollback")

    def test_rejects_wrong_kind_asset_or_version_shape(self) -> None:
        for override in (
            {"kind": "slave-app"},
            {"image": "firmware.hex"},
            {"version": "1.0.1"},
            {"mqtt_compat": None},
            {"bus_compat": None},
            {"sha256": "nope"},
            {"channel": "nightly"},
        ):
            with self.subTest(override=override):
                with self.assertRaises(firmware_releases.FirmwareReleaseError):
                    firmware_releases.parse_master_manifest(
                        master_manifest(**override),
                        tag="v1.2.0.0",
                        published_at="",
                        image_url=MASTER_IMAGE_URL,
                        manifest_url=MASTER_MANIFEST_URL,
                    )


class MasterCompatibilityTests(unittest.TestCase):
    def test_both_mqtt_generations_must_match(self) -> None:
        release = firmware_releases.parse_master_manifest(
            master_manifest(),
            tag="v1.2.0.0",
            published_at="",
            image_url=MASTER_IMAGE_URL,
            manifest_url=MASTER_MANIFEST_URL,
        )
        ok = firmware_releases.check_master_compatibility(
            release, mqtt_compat=2, master_mqtt_compat=2
        )
        self.assertEqual(ok.level, "ok")

        local = firmware_releases.check_master_compatibility(
            release, mqtt_compat=1, master_mqtt_compat=2
        )
        self.assertTrue(local.blocked)
        self.assertIn("master_release_mqtt_mismatch", local.codes)

        master = firmware_releases.check_master_compatibility(
            release, mqtt_compat=2, master_mqtt_compat=1
        )
        self.assertTrue(master.blocked)
        self.assertIn("master_release_master_mqtt_mismatch", master.codes)

    def test_unknown_master_generation_warns_and_bus_is_diagnostic(self) -> None:
        release = firmware_releases.parse_master_manifest(
            master_manifest(bus_compat=9),
            tag="v1.2.0.0",
            published_at="",
            image_url=MASTER_IMAGE_URL,
            manifest_url=MASTER_MANIFEST_URL,
        )
        result = firmware_releases.check_master_compatibility(
            release, mqtt_compat=2, master_mqtt_compat=None
        )
        self.assertEqual(result.level, "warn")
        self.assertIn("master_release_master_mqtt_unknown", result.codes)
        self.assertEqual(result.details["image_bus"], 9)


class MasterCatalogTests(IsolatedAsyncioTestCase):
    async def test_master_catalog_selects_bin_assets_and_verifies_bytes(self) -> None:
        document = master_manifest()

        async def fetch_text(_url: str) -> str:
            return json.dumps(document)

        async def fetch_bytes(_url: str) -> bytes:
            return MASTER_BIN

        async def fetch_json(_url: str):
            return [github_master_release(document)]

        catalog = firmware_releases.ReleaseCatalog(
            fetch_json,
            fetch_text,
            fetch_bytes,
            kind=firmware_releases.MASTER_MANIFEST_KIND,
        )
        listed = await catalog.list(
            refresh=True, mqtt_compat=2, master_mqtt_compat=2
        )
        self.assertEqual(listed["releases"][0]["version"], "1.2.0.0")
        with self.assertRaises(firmware_releases.FirmwareReleaseError):
            await catalog.list(refresh=True)

        release = await catalog.get("v1.2.0.0")
        self.assertEqual(await catalog.fetch_image(release), MASTER_BIN)

        document["sha256"] = "0" * 64
        bad_release = await catalog.get("v1.2.0.0", refresh=True)
        with self.assertRaises(firmware_releases.FirmwareReleaseError) as caught:
            await catalog.fetch_image(bad_release)
        self.assertEqual(
            caught.exception.code, "firmware_release_checksum_mismatch"
        )

    async def test_master_image_size_matches_the_published_release(self) -> None:
        """A real-sized master image passes; an oversized one is rejected."""

        image = b"\xe9" * 1_477_664  # mqtt-compat-2 firmware.bin
        document = master_manifest(sha256=hashlib.sha256(image).hexdigest())

        async def fetch_text(_url: str) -> str:
            return json.dumps(document)

        async def fetch_bytes(_url: str) -> bytes:
            return image

        async def fetch_json(_url: str):
            return [github_master_release(document)]

        catalog = firmware_releases.ReleaseCatalog(
            fetch_json,
            fetch_text,
            fetch_bytes,
            kind=firmware_releases.MASTER_MANIFEST_KIND,
        )
        release = await catalog.get("v1.2.0.0")
        self.assertEqual(await catalog.fetch_image(release), image)

        oversized = b"\xe9" * (firmware_releases.MASTER_OTA_MAX_SIZE + 1)

        async def fetch_oversized(_url: str) -> bytes:
            return oversized

        big_release = firmware_releases.parse_master_manifest(
            master_manifest(sha256=hashlib.sha256(oversized).hexdigest()),
            tag="v1.2.0.0",
            published_at="",
            image_url=MASTER_IMAGE_URL,
            manifest_url=MASTER_MANIFEST_URL,
        )
        big_catalog = firmware_releases.ReleaseCatalog(
            fetch_json,
            fetch_text,
            fetch_oversized,
            kind=firmware_releases.MASTER_MANIFEST_KIND,
        )
        with self.assertRaises(firmware_releases.FirmwareReleaseError) as caught:
            await big_catalog.fetch_image(big_release)
        self.assertEqual(caught.exception.code, "master_firmware_image_invalid")


if __name__ == "__main__":
    unittest.main(verbosity=2)
