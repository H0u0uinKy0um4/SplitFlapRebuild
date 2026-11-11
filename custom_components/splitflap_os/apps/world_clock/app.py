"""World clock app."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ...models import Page
from ..common import split_csv


def _time_text(dt: datetime, ctx) -> str:
    pattern = str(ctx.get_setting("clock_format", "12h")).lower()
    if pattern in {"24", "24h"}:
        return dt.strftime("%H:%M")
    return dt.strftime("%I:%M %p").lstrip("0")


def _zone_label(zone: str) -> str:
    tail = zone.rsplit("/", 1)[-1].replace("_", " ")
    return tail.upper()


async def fetch(ctx, now: datetime) -> list[Page]:
    zones = split_csv(ctx.get_setting("world_clock_zones"))
    if not zones:
        zones = ["UTC"]

    rows, cols = ctx.board
    lines: list[str] = []
    for zone_name in zones[:12]:
        try:
            dt = now.astimezone(ZoneInfo(zone_name))
        except (ZoneInfoNotFoundError, ValueError):
            lines.append(f"BAD ZONE {zone_name}"[:cols].center(cols))
            continue
        label = _zone_label(zone_name)[: max(1, cols - 6)]
        lines.append(f"{label} {_time_text(dt, ctx)}"[:cols].center(cols))

    pages: list[Page] = []
    for start in range(0, len(lines), rows):
        chunk = lines[start : start + rows]
        while len(chunk) < rows:
            chunk.append(" " * cols)
        pages.append(Page("\n".join(chunk), delay=1.0))
    return pages or [Page(ctx.lines("WORLD CLOCK", "NO ZONES", ""))]
