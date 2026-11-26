"""Home Assistant adapter for the public Slave firmware release catalog."""

from __future__ import annotations

from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .firmware_releases import FetchJson, FetchText, ReleaseCatalog

_API_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "splitflap-os",
}
_DOWNLOAD_HEADERS = {
    "Accept": "text/plain, application/octet-stream;q=0.9, */*;q=0.1",
    "User-Agent": "splitflap-os",
}


def create_release_catalog(hass: HomeAssistant) -> ReleaseCatalog:
    """Build one catalog backed by Home Assistant's shared HTTP session."""

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

    return ReleaseCatalog(fetch_json, fetch_text)


__all__ = ["FetchJson", "FetchText", "ReleaseCatalog", "create_release_catalog"]
