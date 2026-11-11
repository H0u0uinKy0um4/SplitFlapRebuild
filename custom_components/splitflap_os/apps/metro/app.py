"""Transit app using the MBTA v3 API (no key required for light use)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from ...models import Page

_LOGGER = logging.getLogger(__name__)


def _parse_time(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def _predictions(ctx) -> list[dict[str, Any]]:
    stop = str(ctx.get_setting("metro_stop", "")).strip()
    route = str(ctx.get_setting("metro_route", "")).strip()
    if not stop:
        return []

    params: dict[str, Any] = {
        "filter[stop]": stop,
        "sort": "time",
        "page[limit]": 4,
    }
    if route:
        params["filter[route]"] = route
    api_key = str(ctx.get_setting("mbta_api_key", "")).strip()
    if api_key:
        params["api_key"] = api_key

    data = await ctx.http_json(
        "https://api-v3.mbta.com/predictions", params=params
    )
    return (data or {}).get("data", [])  # type: ignore[union-attr]


async def fetch(ctx, now: datetime) -> list[Page]:
    stop = str(ctx.get_setting("metro_stop", "")).strip()
    route = str(ctx.get_setting("metro_route", "")).strip() or "TRANSIT"
    if not stop:
        return [Page(ctx.lines(route.upper(), "SET STOP", "IN SETTINGS"))]

    try:
        predictions = await ctx.async_cached(
            "metro", 30, lambda: _predictions(ctx)
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Metro fetch failed: %s", err)
        return [Page(ctx.lines(route.upper(), "DATA ERROR", "CHECK NETWORK"))]

    if not predictions:
        return [Page(ctx.lines(route.upper(), "NO", "PREDICTIONS"))]

    pages: list[Page] = []
    for prediction in predictions:
        attrs = prediction.get("attributes") or {}
        when = _parse_time(attrs.get("arrival_time") or attrs.get("departure_time"))
        if when is None:
            continue
        minutes = max(0, int((when - now.astimezone(timezone.utc)).total_seconds() // 60))
        direction = "OUT" if attrs.get("direction_id") == 1 else "IN"
        pages.append(
            Page(
                ctx.lines(
                    f"{route.upper()} {direction}",
                    f"{minutes} MIN",
                    when.astimezone(ctx.tz).strftime("%I:%M %p").lstrip("0"),
                ),
                delay=5.0,
            )
        )
    return pages or [Page(ctx.lines(route.upper(), "NO", "PREDICTIONS"))]
