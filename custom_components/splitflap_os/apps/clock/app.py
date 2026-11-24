"""Clock app."""

from __future__ import annotations

from datetime import datetime

from ...models import Page


def _time_text(dt: datetime, ctx) -> str:
    pattern = str(ctx.get_setting("clock_format", "12h")).lower()
    if pattern in {"24", "24h"}:
        return dt.strftime("%H:%M")
    return dt.strftime("%I:%M %p").lstrip("0")


def _minute_text(dt: datetime) -> str:
    """Return the two-digit minute of the hour, with a leading zero."""

    return f"{dt.minute:02d}"


def _minutes_only(ctx) -> bool:
    """Whether the frame can only show the two-digit minute mode.

    The other modes reserve three rows for a vertically centred label and need
    at least five columns for ``HH:MM``.  A 1×2 frame (and any smaller canvas)
    gets the minute digits instead of a truncated or blank page.
    """

    try:
        rows = int(getattr(ctx, "rows", 0) or 0)
        cols = int(getattr(ctx, "cols", 0) or 0)
    except (TypeError, ValueError):
        return True
    return rows < 2 or cols < 5


async def fetch(ctx, now: datetime) -> list[Page]:
    dt = now.astimezone(ctx.tz)
    mode = getattr(ctx, "active_app_mode", None)
    if mode == "minutes" or _minutes_only(ctx):
        return [Page(ctx.lines(_minute_text(dt)), delay=1.0)]
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
