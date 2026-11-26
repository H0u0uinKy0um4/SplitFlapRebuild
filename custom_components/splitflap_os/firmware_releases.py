"""Discover and verify published Slave firmware releases.

This module is deliberately Home Assistant free. It owns the small contract
between the Slave repository's GitHub Releases and the panel:

* discover releases that contain a ``firmware.json`` + ``firmware.hex`` pair;
* validate the manifest without trusting any URL it supplies;
* verify the downloaded HEX against the manifest checksum;
* decide whether an image is compatible with the master/module status.

All network access is injected, so host tests can supply fake fetch functions
and the Home Assistant adapter can use its shared aiohttp session.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Mapping

try:  # package import (Home Assistant)
    from .firmware import FirmwareImageError, image_from_hex
    from .master_ota import MASTER_OTA_MAX_SIZE, master_mqtt_from_version
    from .ota import OTA_PROTOCOL_VERSION
except ImportError:  # direct import in the host tests (component dir on sys.path)
    from firmware import FirmwareImageError, image_from_hex
    from master_ota import MASTER_OTA_MAX_SIZE, master_mqtt_from_version
    from ota import OTA_PROTOCOL_VERSION

DEFAULT_REPOSITORY: str = "H0u0uinKy0um4/SplFlp_Slave_Attiny"
MASTER_DEFAULT_REPOSITORY: str = "H0u0uinKy0um4/SplFlp_Master"
GITHUB_API_ROOT: str = "https://api.github.com"
MANIFEST_SCHEMA: int = 1
MANIFEST_KIND: str = "slave-app"
MASTER_MANIFEST_KIND: str = "master-app"
MANIFEST_NAME: str = "firmware.json"
IMAGE_NAME: str = "firmware.hex"
MASTER_IMAGE_NAME: str = "firmware.bin"
RELEASE_LIMIT: int = 12
DEFAULT_TTL_SECONDS: int = 600

_SHA256_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")
_CHANNELS = frozenset({"dev", "stable"})

FetchJson = Callable[[str], Awaitable[Any]]
FetchText = Callable[[str], Awaitable[str]]
FetchBytes = Callable[[str], Awaitable[bytes]]
Clock = Callable[[], datetime]


class FirmwareReleaseError(ValueError):
    """A release could not be used. The message is a stable panel error code."""

    code: str

    def __init__(self, code: str, message: str | None = None) -> None:
        self.code = code
        super().__init__(message or code)


class Compatibility:
    """One compatibility decision for a release and the current hardware."""

    def __init__(
        self, *, level: str, codes: tuple[str, ...], details: dict[str, Any]
    ) -> None:
        self.level = level
        self.codes = codes
        self.details = details

    @property
    def blocked(self) -> bool:
        return self.level == "block"

    def as_dict(self) -> dict[str, Any]:
        return {
            "level": self.level,
            "codes": list(self.codes),
            "details": dict(self.details),
        }


@dataclass(frozen=True)
class FirmwareRelease:
    """One validated manifest plus the GitHub asset URL for its image."""

    tag: str
    published_at: str
    channel: str
    version: str
    fw_bus_compat: int | None
    fw_release: int | None
    ota_protocol_version: int | None
    bootloader_version: int | None
    sha256: str
    source_commit: str
    built_at: str
    image_url: str
    manifest_url: str

    def as_dict(self, compatibility: Compatibility | None = None) -> dict[str, Any]:
        result: dict[str, Any] = {
            "tag": self.tag,
            "channel": self.channel,
            "version": self.version,
            "fw_bus_compat": self.fw_bus_compat,
            "fw_release": self.fw_release,
            "ota_protocol_version": self.ota_protocol_version,
            "bootloader_version": self.bootloader_version,
            "source_commit": self.source_commit,
            "built_at": self.built_at,
            "published_at": self.published_at,
        }
        if compatibility is not None:
            result["compatibility"] = compatibility.as_dict()
        return result


@dataclass(frozen=True)
class MasterFirmwareRelease:
    """One validated master ``firmware.json`` plus its app-only image URL."""

    tag: str
    published_at: str
    channel: str
    version: str
    mqtt_compat: int
    bus_compat: int
    sha256: str
    notes: str
    image_url: str
    manifest_url: str

    def as_dict(self, compatibility: Compatibility | None = None) -> dict[str, Any]:
        result: dict[str, Any] = {
            "tag": self.tag,
            "channel": self.channel,
            "version": self.version,
            "mqtt_compat": self.mqtt_compat,
            "bus_compat": self.bus_compat,
            "notes": self.notes,
            "published_at": self.published_at,
        }
        if compatibility is not None:
            result["compatibility"] = compatibility.as_dict()
        return result


def _optional_int(payload: Mapping[str, Any], key: str) -> int | None:
    value = payload.get(key)
    if value is None or value == "":
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", f"{key} must be an integer"
        )
    return value


def _required_text(payload: Mapping[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", f"{key} must be a non-empty string"
        )
    return value.strip()


def parse_manifest(
    payload: Any,
    *,
    tag: str,
    published_at: str,
    image_url: str,
    manifest_url: str,
) -> FirmwareRelease:
    """Validate one ``firmware.json`` document.

    URLs inside the manifest are ignored on purpose: only the asset URL GitHub
    supplied with the release is ever fetched.
    """

    if not isinstance(payload, Mapping):
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "manifest is not an object"
        )
    if payload.get("schema") != MANIFEST_SCHEMA:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unsupported manifest schema"
        )
    if payload.get("kind") != MANIFEST_KIND:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unsupported manifest kind"
        )
    if payload.get("asset") != IMAGE_NAME:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unexpected image asset name"
        )

    channel = _required_text(payload, "channel")
    if channel not in _CHANNELS:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unknown release channel"
        )

    sha256 = _required_text(payload, "sha256")
    if not _SHA256_PATTERN.fullmatch(sha256):
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "sha256 is not a hex digest"
        )

    return FirmwareRelease(
        tag=tag,
        published_at=published_at,
        channel=channel,
        version=_required_text(payload, "version"),
        fw_bus_compat=_optional_int(payload, "fw_bus_compat"),
        fw_release=_optional_int(payload, "fw_release"),
        ota_protocol_version=_optional_int(payload, "ota_protocol_version"),
        bootloader_version=_optional_int(payload, "bootloader_version"),
        sha256=sha256.lower(),
        source_commit=_required_text(payload, "source_commit"),
        built_at=_required_text(payload, "built_at"),
        image_url=image_url,
        manifest_url=manifest_url,
    )


def _manifest_text(payload: Mapping[str, Any], key: str) -> str:
    """A required string field which may carry an empty release note."""

    value = payload.get(key)
    if not isinstance(value, str):
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", f"{key} must be a string"
        )
    return value.strip()


def parse_master_manifest(
    payload: Any,
    *,
    tag: str,
    published_at: str,
    image_url: str,
    manifest_url: str,
) -> MasterFirmwareRelease:
    """Validate one master ``firmware.json`` document.

    The master image is a raw app-only ``.bin``. Its MQTT compat generation is
    a gate; the bus generation is diagnostic only, because Home Assistant
    never speaks RS485.
    """

    if not isinstance(payload, Mapping):
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "manifest is not an object"
        )
    if payload.get("schema") != MANIFEST_SCHEMA:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unsupported manifest schema"
        )
    if payload.get("kind") != MASTER_MANIFEST_KIND:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unsupported manifest kind"
        )
    if payload.get("image") != MASTER_IMAGE_NAME:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unexpected master image asset name"
        )

    channel = _required_text(payload, "channel")
    if channel not in _CHANNELS:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "unknown release channel"
        )

    version = _required_text(payload, "version")
    if master_mqtt_from_version(version) is None:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid",
            "master version must be <bus>.<mqtt>.<release>",
        )
    mqtt_compat = _optional_int(payload, "mqtt_compat")
    bus_compat = _optional_int(payload, "bus_compat")
    if mqtt_compat is None or bus_compat is None:
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid",
            "mqtt_compat and bus_compat are required",
        )

    sha256 = _required_text(payload, "sha256")
    if not _SHA256_PATTERN.fullmatch(sha256):
        raise FirmwareReleaseError(
            "firmware_release_manifest_invalid", "sha256 is not a hex digest"
        )

    return MasterFirmwareRelease(
        tag=tag,
        published_at=published_at,
        channel=channel,
        version=version,
        mqtt_compat=mqtt_compat,
        bus_compat=bus_compat,
        sha256=sha256.lower(),
        notes=_manifest_text(payload, "notes"),
        image_url=image_url,
        manifest_url=manifest_url,
    )


def releases_url(repository: str) -> str:
    """Return the GitHub Releases API URL for ``owner/repo``."""

    return f"{GITHUB_API_ROOT}/repos/{repository}/releases?per_page={RELEASE_LIMIT}"


def _asset_url(assets: Any, name: str) -> str | None:
    if not isinstance(assets, list):
        return None
    for asset in assets:
        if not isinstance(asset, Mapping) or asset.get("name") != name:
            continue
        url = asset.get("browser_download_url")
        if isinstance(url, str) and url.startswith("https://"):
            return url
    return None


async def releases_from_payload(
    payload: Any,
    fetch_text: FetchText,
    *,
    kind: str = MANIFEST_KIND,
) -> list[FirmwareRelease | MasterFirmwareRelease]:
    """Build validated releases from a GitHub Releases API response.

    The requested ``kind`` selects both the image asset and the manifest
    parser; a release is never chosen by repository name.
    """

    if not isinstance(payload, list):
        raise FirmwareReleaseError(
            "firmware_release_unavailable", "GitHub returned an unexpected payload"
        )
    image_name = (
        MASTER_IMAGE_NAME if kind == MASTER_MANIFEST_KIND else IMAGE_NAME
    )
    parse = parse_master_manifest if kind == MASTER_MANIFEST_KIND else parse_manifest

    releases: list[FirmwareRelease | MasterFirmwareRelease] = []
    for raw in payload:
        if not isinstance(raw, Mapping):
            continue
        tag = raw.get("tag_name")
        image_url = _asset_url(raw.get("assets"), image_name)
        manifest_url = _asset_url(raw.get("assets"), MANIFEST_NAME)
        if not isinstance(tag, str) or not tag:
            continue
        if not image_url or not manifest_url:
            continue
        published_at = raw.get("published_at")
        if not isinstance(published_at, str):
            published_at = ""

        try:
            manifest = await fetch_text(manifest_url)
            document = json.loads(manifest)
            releases.append(
                parse(
                    document,
                    tag=tag,
                    published_at=published_at,
                    image_url=image_url,
                    manifest_url=manifest_url,
                )
            )
        except (FirmwareReleaseError, ValueError, TypeError):
            # A malformed release must not hide the other usable ones.
            continue

    stable = sorted(
        (item for item in releases if item.channel == "stable"),
        key=lambda item: item.published_at,
        reverse=True,
    )[: max(0, RELEASE_LIMIT - 1)]
    dev = sorted(
        (item for item in releases if item.channel == "dev"),
        key=lambda item: item.published_at,
        reverse=True,
    )[:1]
    return stable + dev


def check_compatibility(
    release: FirmwareRelease,
    *,
    master_bus_compat: int | None,
    module_bus_compatible: bool | None = None,
    module_bootloader_version: int | None = None,
    allow_incompatible: bool = False,
    ota_protocol_version: int = OTA_PROTOCOL_VERSION,
) -> Compatibility:
    """Compare a release with the compatibility facts HASC already has."""

    codes: list[str] = []
    blocking: list[str] = []
    details: dict[str, Any] = {"ota_protocol": ota_protocol_version}

    if (
        master_bus_compat is not None
        and release.fw_bus_compat is not None
        and master_bus_compat != release.fw_bus_compat
    ):
        blocking.append("firmware_release_bus_mismatch")
        details["master_bus"] = master_bus_compat
        details["image_bus"] = release.fw_bus_compat

    for value, code in (
        (release.ota_protocol_version, "firmware_release_ota_protocol_mismatch"),
        (release.bootloader_version, "firmware_release_bootloader_mismatch"),
        (module_bootloader_version, "firmware_release_module_bootloader_mismatch"),
    ):
        if value is not None and value != ota_protocol_version:
            blocking.append(code)
            details["reported_ota_protocol"] = value

    if master_bus_compat is None or release.fw_bus_compat is None:
        codes.append("firmware_release_unknown_bus")
    if (
        release.ota_protocol_version is None
        and release.bootloader_version is None
    ):
        codes.append("firmware_release_unknown_ota_protocol")
    if module_bus_compatible is False:
        codes.append("firmware_release_installed_bus_incompatible")

    codes = blocking + [code for code in codes if code not in blocking]
    if blocking:
        codes.append("firmware_release_blocked")
        if allow_incompatible:
            codes.append("firmware_release_override_used")
            level = "warn"
        else:
            level = "block"
    elif any(code.startswith("firmware_release_unknown") for code in codes):
        level = "warn"
    elif codes:
        level = "warn"
    else:
        level = "ok"

    return Compatibility(level=level, codes=tuple(codes), details=details)


def check_master_versions(
    *,
    image_mqtt: int,
    mqtt_compat: int,
    master_mqtt_compat: int | None = None,
    allow_incompatible: bool = False,
    image_bus: int | None = None,
) -> Compatibility:
    """Gate a master image against both MQTT compat generations.

    The bus generation is copied into ``details`` for diagnostics only: Home
    Assistant never speaks RS485, so it cannot gate on it.
    """

    codes: list[str] = []
    blocking: list[str] = []
    details: dict[str, Any] = {
        "image_mqtt": image_mqtt,
        "local_mqtt": mqtt_compat,
        "master_mqtt": master_mqtt_compat,
        "image_bus": image_bus,
    }

    if image_mqtt != mqtt_compat:
        blocking.append("master_release_mqtt_mismatch")
    if master_mqtt_compat is None:
        codes.append("master_release_master_mqtt_unknown")
    elif image_mqtt != master_mqtt_compat:
        blocking.append("master_release_master_mqtt_mismatch")

    codes = blocking + [code for code in codes if code not in blocking]
    if blocking:
        codes.append("master_release_blocked")
        if allow_incompatible:
            codes.append("firmware_release_override_used")
            level = "warn"
        else:
            level = "block"
    elif codes:
        level = "warn"
    else:
        level = "ok"

    return Compatibility(level=level, codes=tuple(codes), details=details)


def check_master_compatibility(
    release: MasterFirmwareRelease,
    *,
    mqtt_compat: int,
    master_mqtt_compat: int | None = None,
    allow_incompatible: bool = False,
) -> Compatibility:
    """Gate one master manifest with :func:`check_master_versions`."""

    return check_master_versions(
        image_mqtt=release.mqtt_compat,
        mqtt_compat=mqtt_compat,
        master_mqtt_compat=master_mqtt_compat,
        allow_incompatible=allow_incompatible,
        image_bus=release.bus_compat,
    )


class ReleaseCatalog:
    """Small in-memory catalog over the public GitHub Releases API."""

    def __init__(
        self,
        fetch_json: FetchJson,
        fetch_text: FetchText,
        fetch_bytes: FetchBytes | None = None,
        *,
        repository: str | None = None,
        kind: str = MANIFEST_KIND,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        clock: Clock | None = None,
    ) -> None:
        self._fetch_json = fetch_json
        self._fetch_text = fetch_text
        self._fetch_bytes = fetch_bytes
        self._kind = kind
        default_repository = (
            MASTER_DEFAULT_REPOSITORY
            if kind == MASTER_MANIFEST_KIND
            else DEFAULT_REPOSITORY
        )
        self._url = releases_url(repository or default_repository)
        self._ttl_seconds = max(0, ttl_seconds)
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._releases: tuple[FirmwareRelease | MasterFirmwareRelease, ...] | None = (
            None
        )
        self._fetched_at: datetime | None = None

    def _fresh(self) -> bool:
        if self._releases is None or self._fetched_at is None:
            return False
        age = (self._clock() - self._fetched_at).total_seconds()
        return 0 <= age < self._ttl_seconds

    async def _refresh(self) -> tuple[FirmwareRelease | MasterFirmwareRelease, ...]:
        payload = await self._fetch_json(self._url)
        releases = await releases_from_payload(
            payload, self._fetch_text, kind=self._kind
        )
        self._releases = tuple(releases)
        self._fetched_at = self._clock()
        return self._releases

    async def _load(
        self, *, refresh: bool = False
    ) -> tuple[tuple[FirmwareRelease | MasterFirmwareRelease, ...], bool, datetime | None]:
        if not refresh and self._fresh():
            assert self._releases is not None
            return self._releases, False, self._fetched_at
        try:
            return await self._refresh(), False, self._fetched_at
        except FirmwareReleaseError:
            raise
        except Exception as err:  # noqa: BLE001 - network errors are one code
            if self._releases is None:
                raise FirmwareReleaseError(
                    "firmware_release_unavailable", str(err)
                ) from err
            return self._releases, True, self._fetched_at

    async def list(
        self,
        *,
        refresh: bool = False,
        master_bus_compat: int | None = None,
        module_bus_compatible: bool | None = None,
        mqtt_compat: int | None = None,
        master_mqtt_compat: int | None = None,
        allow_incompatible: bool = False,
    ) -> dict[str, Any]:
        """Return the panel's release list with compatibility annotations."""

        releases, stale, fetched_at = await self._load(refresh=refresh)
        if self._kind == MASTER_MANIFEST_KIND:
            if mqtt_compat is None:
                raise FirmwareReleaseError("firmware_release_unavailable")
            items = [
                release.as_dict(
                    check_master_compatibility(
                        release,
                        mqtt_compat=mqtt_compat,
                        master_mqtt_compat=master_mqtt_compat,
                        allow_incompatible=allow_incompatible,
                    )
                )
                for release in releases
                if isinstance(release, MasterFirmwareRelease)
            ]
        else:
            items = [
                release.as_dict(
                    check_compatibility(
                        release,
                        master_bus_compat=master_bus_compat,
                        module_bus_compatible=module_bus_compatible,
                        allow_incompatible=allow_incompatible,
                    )
                )
                for release in releases
                if isinstance(release, FirmwareRelease)
            ]
        return {
            "releases": items,
            "stale": stale,
            "fetched_at": fetched_at.isoformat() if fetched_at else None,
            "count": len(items),
        }

    async def get(
        self, tag: str, *, refresh: bool = True
    ) -> FirmwareRelease | MasterFirmwareRelease:
        """Return one release by GitHub tag."""

        releases, _stale, _fetched_at = await self._load(refresh=refresh)
        for release in releases:
            if release.tag == tag:
                return release
        raise FirmwareReleaseError("firmware_release_not_found")

    async def fetch_image(
        self, release: FirmwareRelease | MasterFirmwareRelease
    ) -> bytes:
        """Download, checksum and validate one published application image."""

        if isinstance(release, MasterFirmwareRelease):
            if self._fetch_bytes is None:
                raise FirmwareReleaseError(
                    "firmware_release_image_invalid", "binary fetch is unavailable"
                )
            try:
                image = await self._fetch_bytes(release.image_url)
            except FirmwareReleaseError:
                raise
            except Exception as err:  # noqa: BLE001 - one code for network errors
                raise FirmwareReleaseError(
                    "firmware_release_unavailable", str(err)
                ) from err
            digest = hashlib.sha256(image).hexdigest()
            if digest != release.sha256:
                raise FirmwareReleaseError("firmware_release_checksum_mismatch")
            if not image or len(image) > MASTER_OTA_MAX_SIZE:
                raise FirmwareReleaseError("firmware_release_image_invalid")
            return image

        try:
            text = await self._fetch_text(release.image_url)
        except FirmwareReleaseError:
            raise
        except Exception as err:  # noqa: BLE001 - network errors are one code
            raise FirmwareReleaseError("firmware_release_unavailable", str(err)) from err

        try:
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        except UnicodeEncodeError as err:
            raise FirmwareReleaseError(
                "firmware_release_image_invalid", str(err)
            ) from err
        if digest != release.sha256:
            raise FirmwareReleaseError("firmware_release_checksum_mismatch")

        try:
            return image_from_hex(text)
        except FirmwareImageError as err:
            raise FirmwareReleaseError("firmware_release_image_invalid", str(err)) from err
