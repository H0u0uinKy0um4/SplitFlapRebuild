"""Dashboard app: date followed by the weather pages."""

from __future__ import annotations

from datetime import datetime

from ...models import Page
from ..weather.app import fetch as weather


def _time_text(dt: datetime, ctx) -> str:
    pattern = str(ctx.get_setting("clock_format", "12h")).lower()
    if pattern in {"24", "24h"}:
        return dt.strftime("%H:%M")
    return dt.strftime("%I:%M %p").lstrip("0")


def _date_lines(dt: datetime, ctx) -> str:
    return ctx.lines(
        dt.strftime("%A").upper(),
        dt.strftime("%b %d %Y").upper(),
        _time_text(dt, ctx),
    )


async def fetch(ctx, now: datetime) -> list[Page]:
    pages: list[Page] = [
        Page(_date_lines(now.astimezone(ctx.tz), ctx), delay=4.0)
    ]
    try:
        pages.extend(await weather(ctx, now))
    except Exception:  # noqa: BLE001 - dashboard must survive a weather error
        pages.append(Page(ctx.lines("WEATHER", "UNAVAILABLE", ""), delay=4.0))
    return pages
