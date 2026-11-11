"""ISS position app."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ...models import Page

_LOGGER = logging.getLogger(__name__)


async def _position(ctx) -> dict[str, Any]:
    return await ctx.http_json(
        "https://api.wheretheiss.at/v1/satellites/25544",
        headers={"User-Agent": "Split-Flap-OS/1.0"},
    )


async def fetch(ctx, now: datetime) -> list[Page]:
    try:
        data = await ctx.async_cached("iss", 5, lambda: _position(ctx))
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("ISS fetch failed: %s", err)
        return [Page(ctx.lines("ISS", "DATA ERROR", "CHECK NETWORK"))]

    if not isinstance(data, dict):
        return [Page(ctx.lines("ISS", "NO DATA", ""))]

    latitude = data.get("latitude")
    longitude = data.get("longitude")
    altitude = data.get("altitude")
    velocity = data.get("velocity")

    def _coord(value: Any, positive: str, negative: str) -> str:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return "--"
        return f"{abs(number):.2f}{positive if number >= 0 else negative}"

    lines = [
        "ISS",
        f"LAT {_coord(latitude, 'N', 'S')}",
        f"LON {_coord(longitude, 'E', 'W')}",
    ]
    if altitude is not None:
        try:
            lines.append(f"ALT {round(float(altitude))} KM")
        except (TypeError, ValueError):
            pass
    if velocity is not None:
        try:
            lines.append(f"VEL {round(float(velocity))} KMH")
        except (TypeError, ValueError):
            pass
    return [Page(ctx.lines(*lines), delay=5.0)]
