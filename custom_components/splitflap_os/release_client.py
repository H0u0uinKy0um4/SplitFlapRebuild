"""Home Assistant adapter for the public firmware release catalogs."""

from __future__ import annotations

from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .firmware_releases import (
    MASTER_MANIFEST_KIND,
    FetchJson,
    FetchText,
    ReleaseCatalog,
)

_API_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "splitflap-os",
}
_DOWNLOAD_HEADERS = {
    "Accept": "text/plain, application/octet-stream;q=0.9, */*;q=0.1",
    "User-Agent": "splitflap-os",
}


def _fetchers(hass: HomeAssistant):
    """Build the three HTTP adapters shared by both release catalogs."""

    session = async_get_clientsession(hass)

    async def fetch_json(url: str) -> Any:
        async with session.get(
            url, headers=_API_HEADERS, timeout=aiohttp.ClientTimeout(total=20)
        ) as response:
            response.raise_for_status()
            return await response.json(content_type=None)

    async def fetch_text(url: str) -> str:
        async with session.get(
            url, headers=_DOWNLOAD_HEADERS, timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            response.raise_for_status()
            return await response.text()

    async def fetch_bytes(url: str) -> bytes:
        async with session.get(
            url, headers=_DOWNLOAD_HEADERS, timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            response.raise_for_status()
            return await response.read()

    return fetch_json, fetch_text, fetch_bytes


def create_release_catalog(hass: HomeAssistant) -> ReleaseCatalog:
    """Build the slave release catalog on the shared HTTP session."""

    return ReleaseCatalog(*_fetchers(hass))


def create_master_release_catalog(hass: HomeAssistant) -> ReleaseCatalog:
    """Build the master release catalog on the shared HTTP session."""

    return ReleaseCatalog(*_fetchers(hass), kind=MASTER_MANIFEST_KIND)


__all__ = [
    "FetchJson",
    "FetchText",
    "ReleaseCatalog",
    "create_master_release_catalog",
    "create_release_catalog",
]
