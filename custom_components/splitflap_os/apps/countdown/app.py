"""Countdown app."""

from __future__ import annotations

from datetime import datetime

from ...models import Page


def _parse_target(ctx) -> datetime | None:
    raw = str(ctx.get_setting("countdown_target", "")).strip()
    if not raw:
        return None
    try:
        target = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if target.tzinfo is None:
        target = target.replace(tzinfo=ctx.tz)
    return target


async def fetch(ctx, now: datetime) -> list[Page]:
    target = _parse_target(ctx)
    event = str(ctx.get_setting("countdown_event", "COUNTDOWN")).strip().upper()
    if target is None:
        return [Page(ctx.lines(event[: ctx.cols], "SET TARGET", "IN SETTINGS"))]

    remaining = target - now.astimezone(ctx.tz)
    total = int(remaining.total_seconds())
    if total <= 0:
        return [Page(ctx.lines(event[: ctx.cols], "HAS PASSED", ""))]

    days, rem = divmod(total, 86_400)
    hours, rem = divmod(rem, 3_600)
    minutes, seconds = divmod(rem, 60)
    return [
        Page(
            ctx.lines(
                event[: ctx.cols],
                f"{days}D {hours:02d}H {minutes:02d}M",
                f"{seconds:02d} SECONDS",
            ),
            delay=1.0,
        )
    ]
