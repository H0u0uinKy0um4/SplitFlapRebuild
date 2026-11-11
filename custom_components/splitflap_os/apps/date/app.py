"""Date app."""

from __future__ import annotations

from datetime import datetime

from ...models import Page


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
    return [Page(_date_lines(now.astimezone(ctx.tz), ctx), delay=1.0)]
