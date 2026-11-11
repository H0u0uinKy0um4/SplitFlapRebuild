"""Crypto app."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ...models import Page
from ..common import compact_number, signed_percent, split_csv

_LOGGER = logging.getLogger(__name__)


async def _crypto_quotes(ctx) -> list[dict[str, Any]]:
    coins = split_csv(ctx.get_setting("crypto_list"))[:8]
    if not coins:
        return []
    data = await ctx.http_json(
        "https://api.coingecko.com/api/v3/simple/price",
        params={
            "ids": ",".join(coins),
            "vs_currencies": "usd",
            "include_24hr_change": "true",
        },
        headers={"User-Agent": "Split-Flap-OS/1.0"},
    )
    results: list[dict[str, Any]] = []
    for coin in coins:
        item = (data or {}).get(coin) or {}
        if not item:
            results.append({"id": coin, "error": True})
            continue
        results.append(
            {
                "id": coin,
                "name": coin.replace("-", " ").upper(),
                "price": item.get("usd"),
                "change": item.get("usd_24h_change"),
            }
        )
    return results


async def fetch(ctx, now: datetime) -> list[Page]:
    try:
        quotes = await ctx.async_cached("crypto", 60, lambda: _crypto_quotes(ctx))
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Crypto fetch failed: %s", err)
        return [Page(ctx.lines("CRYPTO", "DATA ERROR", "CHECK NETWORK"))]

    if not quotes:
        return [Page(ctx.lines("CRYPTO", "SET COINS", "IN SETTINGS"))]

    pages: list[Page] = []
    for quote in quotes:
        if quote.get("error"):
            pages.append(Page(ctx.lines(str(quote["id"]).upper(), "NO DATA", ""), delay=4.0))
            continue
        price = quote.get("price")
        price_text = compact_number(float(price), currency="USD") if price is not None else "--"
        change = quote.get("change")
        change_text = signed_percent(float(change)) if change is not None else ""
        pages.append(
            Page(
                ctx.lines(str(quote.get("name", "?")).upper(), price_text, change_text),
                delay=4.0,
            )
        )
    return pages
