"""Clock, date, countdown, world-clock and dashboard apps."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..models import Page
from .common import split_csv


def _time_text(dt: datetime, engine) -> str:
    pattern = str(engine.get_setting("clock_format", "12h")).lower()
    if pattern in {"24", "24h"}:
        return dt.strftime("%H:%M")
    return dt.strftime("%I:%M %p").lstrip("0")


def _date_lines(dt: datetime, engine) -> str:
    return engine.lines(
        dt.strftime("%A").upper(),
        dt.strftime("%b %d %Y").upper(),
        _time_text(dt, engine),
    )


async def clock(engine, now: datetime) -> list[Page]:
    dt = now.astimezone(engine.tz)
    mode = getattr(engine, "active_app_mode", None)
    if mode == "time":
        return [Page(engine.lines("", _time_text(dt, engine), ""), delay=1.0)]
    if mode == "date":
        return [
            Page(
                engine.lines(
                    dt.strftime("%A").upper(),
                    dt.strftime("%b %d").upper(),
                    dt.strftime("%Y").upper(),
                ),
                delay=1.0,
            )
        ]
    return [
        Page(
            engine.lines(
                dt.strftime("%A").upper(),
                _time_text(dt, engine),
                dt.strftime("%b %d").upper(),
            ),
            delay=1.0,
        )
    ]


async def date(engine, now: datetime) -> list[Page]:
    return [Page(_date_lines(now.astimezone(engine.tz), engine), delay=1.0)]


async def dashboard(engine, now: datetime) -> list[Page]:
    from .weather import weather

    pages: list[Page] = [Page(_date_lines(now.astimezone(engine.tz), engine), delay=4.0)]
    try:
        pages.extend(await weather(engine, now))
    except Exception:  # noqa: BLE001 - dashboard must survive a weather error
        pages.append(Page(engine.lines("WEATHER", "UNAVAILABLE", ""), delay=4.0))
    return pages


def _parse_target(engine) -> datetime | None:
    raw = str(engine.get_setting("countdown_target", "")).strip()
    if not raw:
        return None
    try:
        target = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if target.tzinfo is None:
        target = target.replace(tzinfo=engine.tz)
    return target


async def countdown(engine, now: datetime) -> list[Page]:
    target = _parse_target(engine)
    event = str(engine.get_setting("countdown_event", "COUNTDOWN")).strip().upper()
    if target is None:
        return [Page(engine.lines(event[: engine.cols], "SET TARGET", "IN SETTINGS"))]

    remaining = target - now.astimezone(engine.tz)
    total = int(remaining.total_seconds())
    if total <= 0:
        return [Page(engine.lines(event[: engine.cols], "HAS PASSED", ""))]

    days, rem = divmod(total, 86_400)
    hours, rem = divmod(rem, 3_600)
    minutes, seconds = divmod(rem, 60)
    return [
        Page(
            engine.lines(
                event[: engine.cols],
                f"{days}D {hours:02d}H {minutes:02d}M",
                f"{seconds:02d} SECONDS",
            ),
            delay=1.0,
        )
    ]


def _zone_label(zone: str) -> str:
    tail = zone.rsplit("/", 1)[-1].replace("_", " ")
    return tail.upper()


async def world_clock(engine, now: datetime) -> list[Page]:
    zones = split_csv(engine.get_setting("world_clock_zones"))
    if not zones:
        zones = ["UTC"]

    rows, cols = engine.board
    lines: list[str] = []
    for zone_name in zones[:12]:
        try:
            dt = now.astimezone(ZoneInfo(zone_name))
        except (ZoneInfoNotFoundError, ValueError):
            lines.append(f"BAD ZONE {zone_name}"[:cols].center(cols))
            continue
        label = _zone_label(zone_name)[: max(1, cols - 6)]
        lines.append(f"{label} {_time_text(dt, engine)}"[:cols].center(cols))

    pages: list[Page] = []
    for start in range(0, len(lines), rows):
        chunk = lines[start : start + rows]
        while len(chunk) < rows:
            chunk.append(" " * cols)
        pages.append(Page("\n".join(chunk), delay=1.0))
    return pages or [Page(engine.lines("WORLD CLOCK", "NO ZONES", ""))]
