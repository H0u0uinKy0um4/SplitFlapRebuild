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
    from .ota import OTA_PROTOCOL_VERSION
except ImportError:  # direct import in the host tests (component dir on sys.path)
    from firmware import FirmwareImageError, image_from_hex
    from ota import OTA_PROTOCOL_VERSION

DEFAULT_REPOSITORY: str = "H0u0uinKy0um4/SplFlp_Slave_Attiny"
GITHUB_API_ROOT: str = "https://api.github.com"
MANIFEST_SCHEMA: int = 1
MANIFEST_KIND: str = "slave-app"
MANIFEST_NAME: str = "firmware.json"
IMAGE_NAME: str = "firmware.hex"
RELEASE_LIMIT: int = 12
DEFAULT_TTL_SECONDS: int = 600

_SHA256_PATTERN = re.compile(r"^[0-9a-fA-F]{64}$")
_CHANNELS = frozenset({"dev", "stable"})

FetchJson = Callable[[str], Awaitable[Any]]
FetchText = Callable[[str], Awaitable[str]]
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
) -> list[FirmwareRelease]:
    """Build validated releases from a GitHub Releases API response."""

    if not isinstance(payload, list):
        raise FirmwareReleaseError(
            "firmware_release_unavailable", "GitHub returned an unexpected payload"
        )

    releases: list[FirmwareRelease] = []
    for raw in payload:
        if not isinstance(raw, Mapping):
            continue
        tag = raw.get("tag_name")
        image_url = _asset_url(raw.get("assets"), IMAGE_NAME)
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
                parse_manifest(
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


class ReleaseCatalog:
    """Small in-memory catalog over the public GitHub Releases API."""

    def __init__(
        self,
        fetch_json: FetchJson,
        fetch_text: FetchText,
        *,
        repository: str = DEFAULT_REPOSITORY,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        clock: Clock | None = None,
    ) -> None:
        self._fetch_json = fetch_json
        self._fetch_text = fetch_text
        self._url = releases_url(repository)
        self._ttl_seconds = max(0, ttl_seconds)
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._releases: tuple[FirmwareRelease, ...] | None = None
        self._fetched_at: datetime | None = None

    def _fresh(self) -> bool:
        if self._releases is None or self._fetched_at is None:
            return False
        age = (self._clock() - self._fetched_at).total_seconds()
        return 0 <= age < self._ttl_seconds

    async def _refresh(self) -> tuple[FirmwareRelease, ...]:
        payload = await self._fetch_json(self._url)
        releases = await releases_from_payload(payload, self._fetch_text)
        self._releases = tuple(releases)
        self._fetched_at = self._clock()
        return self._releases

    async def _load(self, *, refresh: bool = False) -> tuple[tuple[FirmwareRelease, ...], bool, datetime | None]:
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
        allow_incompatible: bool = False,
    ) -> dict[str, Any]:
        """Return the panel's release list with compatibility annotations."""

        releases, stale, fetched_at = await self._load(refresh=refresh)
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
        ]
        return {
            "releases": items,
            "stale": stale,
            "fetched_at": fetched_at.isoformat() if fetched_at else None,
            "count": len(items),
        }

    async def get(self, tag: str, *, refresh: bool = True) -> FirmwareRelease:
        """Return one release by GitHub tag."""

        releases, _stale, _fetched_at = await self._load(refresh=refresh)
        for release in releases:
            if release.tag == tag:
                return release
        raise FirmwareReleaseError("firmware_release_not_found")

    async def fetch_image(self, release: FirmwareRelease) -> bytes:
        """Download, checksum and validate one published application image."""

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
