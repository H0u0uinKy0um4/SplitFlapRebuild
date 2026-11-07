"""Sports app using ESPN's public scoreboard endpoint."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ..models import Page
from .common import split_csv

_LOGGER = logging.getLogger(__name__)


def _team_name(competitor: dict[str, Any]) -> str:
    team = competitor.get("team") or {}
    return str(
        team.get("abbreviation")
        or team.get("shortDisplayName")
        or team.get("displayName")
        or "?"
    ).upper()


async def _scoreboard(engine) -> dict[str, Any]:
    return await engine.http_json(
        "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
        headers={"User-Agent": "Split-Flap-OS/1.0"},
    )


def _games(data: dict[str, Any], teams: list[str]) -> list[dict[str, str]]:
    wanted = {team.upper() for team in teams}
    results: list[dict[str, str]] = []

    for event in (data or {}).get("events", []):
        competitions = event.get("competitions") or []
        if not competitions:
            continue
        competition = competitions[0]
        competitors = competition.get("competitors") or []
        if len(competitors) < 2:
            continue

        parsed: dict[str, dict[str, Any]] = {}
        for competitor in competitors:
            side = str(competitor.get("homeAway") or "").lower()
            parsed[side or "other"] = competitor
        away = parsed.get("away") or competitors[0]
        home = parsed.get("home") or competitors[1]
        away_name = _team_name(away)
        home_name = _team_name(home)

        if wanted and away_name not in wanted and home_name not in wanted:
            continue

        status = (
            ((competition.get("status") or {}).get("type") or {}).get("shortDetail")
            or "SCHEDULED"
        )
        results.append(
            {
                "away": away_name,
                "home": home_name,
                "away_score": str(away.get("score") or "-"),
                "home_score": str(home.get("score") or "-"),
                "status": str(status).upper(),
            }
        )
    return results


async def sports(engine, now: datetime) -> list[Page]:
    teams = split_csv(engine.get_setting("sports_teams"))
    try:
        data = await engine.async_cached("sports", 120, lambda: _scoreboard(engine))
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Sports fetch failed: %s", err)
        return [Page(engine.lines("SPORTS", "DATA ERROR", "CHECK NETWORK"))]

    games = _games(data, teams)
    if not games:
        subject = teams[0].upper() if teams else "GAMES"
        return [Page(engine.lines(subject, "NO GAME", "TODAY"))]

    pages: list[Page] = []
    for game in games:
        pages.append(
            Page(
                engine.lines(
                    f"{game['away']} {game['away_score']}",
                    f"{game['home']} {game['home_score']}",
                    game["status"],
                ),
                delay=5.0,
            )
        )
    return pages
