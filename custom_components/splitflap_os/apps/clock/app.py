"""Clock app."""

from __future__ import annotations

from datetime import datetime

from ...models import Page


def _time_text(dt: datetime, ctx) -> str:
    pattern = str(ctx.get_setting("clock_format", "12h")).lower()
    if pattern in {"24", "24h"}:
        return dt.strftime("%H:%M")
    return dt.strftime("%I:%M %p").lstrip("0")


async def fetch(ctx, now: datetime) -> list[Page]:
    dt = now.astimezone(ctx.tz)
    mode = getattr(ctx, "active_app_mode", None)
    if mode == "time":
        return [Page(ctx.lines("", _time_text(dt, ctx), ""), delay=1.0)]
    if mode == "date":
        return [
            Page(
                ctx.lines(
                    dt.strftime("%A").upper(),
                    dt.strftime("%b %d").upper(),
                    dt.strftime("%Y").upper(),
                ),
                delay=1.0,
            )
        ]
    return [
        Page(
            ctx.lines(
                dt.strftime("%A").upper(),
                _time_text(dt, ctx),
                dt.strftime("%b %d").upper(),
            ),
            delay=1.0,
        )
    ]
