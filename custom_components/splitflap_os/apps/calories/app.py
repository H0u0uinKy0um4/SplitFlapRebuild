"""Calories app: today's energy from the launching user's KT account.

The app does not read Kaloricke Tabulky sensor entities directly.  It calls the
``kaloricke_tabulky.get_summary`` action with the Home Assistant user who
launched the app in the service context, so the KT integration resolves that
user's own account and rejects access to anyone else's diary.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ...models import Page

_LOGGER = logging.getLogger(__name__)

KT_DOMAIN = "kaloricke_tabulky"
SERVICE_GET_SUMMARY = "get_summary"
ENERGY_KEYS = (
    "energy",
    "energy_kcal",
    "energykcal",
    "energie",
    "energeticka_hodnota",
    "calorie",
    "calories",
    "kcal",
    "total",
)


def _energy_metric(metrics: dict[str, Any]) -> dict[str, Any] | None:
    """Find the first usable energy metric in a KT summary response."""
    for key in ENERGY_KEYS:
        metric = metrics.get(key)
        if isinstance(metric, dict) and metric.get("value") is not None:
            return metric
    return None


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def fetch(ctx, now: datetime) -> list[Page]:
    """Render one page with the launching user's calories."""
    if not getattr(ctx, "user_id", None):
        return [Page(ctx.lines("CALORIES", "NO USER", ""), delay=5.0)]

    # Imported here so app providers stay importable outside Home Assistant.
    from homeassistant.core import Context

    try:
        response = await ctx.hass.services.async_call(
            KT_DOMAIN,
            SERVICE_GET_SUMMARY,
            {},
            blocking=True,
            return_response=True,
            context=Context(user_id=ctx.user_id),
        )
    except Exception as err:  # noqa: BLE001 - the display must survive a KT outage
        _LOGGER.warning("Calories app could not read KT summary: %s", err)
        return [
            Page(
                ctx.lines("CALORIES", "UNAVAILABLE", str(err)[: ctx.cols].upper()),
                delay=5.0,
            )
        ]

    if not isinstance(response, dict):
        return [Page(ctx.lines("CALORIES", "NO DATA", ""), delay=5.0)]

    metrics = response.get("metrics")
    metrics = metrics if isinstance(metrics, dict) else {}
    metric = _energy_metric(metrics)
    if metric is None:
        return [Page(ctx.lines("CALORIES", "NO DATA", ""), delay=5.0)]

    value = _number(metric.get("value"))
    if value is None:
        return [Page(ctx.lines("CALORIES", "NO DATA", ""), delay=5.0)]

    account = str(response.get("account") or "").strip().upper()[: ctx.cols]
    unit = str(metric.get("unit") or "KCAL").upper()
    goal = _number(metric.get("goal"))

    if goal is not None and goal > 0:
        detail = f"GOAL {int(goal)}" if goal.is_integer() else f"GOAL {goal:g}"
    else:
        percent = metric.get("percent")
        detail = f"{int(percent)}% OF GOAL" if percent is not None else ""

    value_text = f"{int(value)} {unit}" if value.is_integer() else f"{value:g} {unit}"
    return [Page(ctx.lines(account or "TODAY", value_text, detail), delay=5.0)]
