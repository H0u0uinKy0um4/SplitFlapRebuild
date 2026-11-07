"""Helpers for finding the active integration runtime."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from homeassistant.core import HomeAssistant

from .const import DOMAIN


def get_runtime(
    hass: HomeAssistant, entry_id: str | None = None
) -> dict[str, Any] | None:
    """Return the runtime for one entry, or the first runtime when omitted."""

    domain_data = hass.data.get(DOMAIN, {})
    if entry_id is not None:
        value = domain_data.get(entry_id)
        if isinstance(value, dict) and "engine" in value and "coordinator" in value:
            return value
        return None

    for key, value in domain_data.items():
        if str(key).startswith("_"):
            continue
        if isinstance(value, dict) and "engine" in value and "coordinator" in value:
            return value
    return None


def iter_runtimes(hass: HomeAssistant) -> Iterator[dict[str, Any]]:
    """Yield every configured integration runtime."""

    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if str(key).startswith("_"):
            continue
        if isinstance(value, dict) and "engine" in value and "coordinator" in value:
            yield value
