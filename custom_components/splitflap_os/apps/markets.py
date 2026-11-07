"""Stocks and crypto apps."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ..models import Page
from .common import compact_number, signed_percent, split_csv

_LOGGER = logging.getLogger(__name__)


async def _yahoo_quote(engine, symbol: str) -> dict[str, Any]:
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{symbol}?range=1d&interval=5m"
    )
    data = await engine.http_json(url, headers={"User-Agent": "Mozilla/5.0"})
    result = ((data or {}).get("chart") or {}).get("result") or []
    if not result:
        raise ValueError(f"No quote for {symbol}")
    meta = result[0].get("meta") or {}
    price = meta.get("regularMarketPrice")
    previous = meta.get("chartPreviousClose") or meta.get("previousClose")
    if price is None:
        indicators = result[0].get("indicators") or {}
        quotes = indicators.get("quote") or [{}]
        closes = [v for v in (quotes[0].get("close") or []) if v is not None]
        if closes:
            price = closes[-1]
            previous = previous or closes[0]
    if price is None:
        raise ValueError(f"No price for {symbol}")
    return {
        "symbol": symbol.upper(),
        "price": float(price),
        "previous": float(previous) if previous is not None else None,
        "currency": meta.get("currency", "USD"),
        "name": meta.get("shortName") or symbol.upper(),
    }


async def _stooq_quote(engine, symbol: str) -> dict[str, Any]:
    ticker = symbol.lower()
    if "." not in ticker:
        ticker = f"{ticker}.us"
    url = f"https://stooq.com/q/l/?s={ticker}&f=sd2t2ohlcv&h&e=csv"
    session = engine.session
    async with session.get(url, timeout=engine.http_timeout) as response:
        response.raise_for_status()
        text = await response.text()
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        raise ValueError(f"No Stooq quote for {symbol}")
    header = [part.strip() for part in lines[0].split(",")]
    values = [part.strip() for part in lines[1].split(",")]
    row = dict(zip(header, values))
    close = float(row["Close"])
    open_price = float(row["Open"]) if row.get("Open") not in (None, "", "N/A") else None
    return {
        "symbol": symbol.upper(),
        "price": close,
        "previous": open_price,
        "currency": "USD",
        "name": symbol.upper(),
    }


async def _quote(engine, symbol: str) -> dict[str, Any]:
    try:
        return await _yahoo_quote(engine, symbol)
    except Exception as err:  # noqa: BLE001 - fall back to Stooq
        _LOGGER.debug("Yahoo quote failed for %s: %s", symbol, err)
        return await _stooq_quote(engine, symbol)


async def stocks(engine, now: datetime) -> list[Page]:
    symbols = split_csv(engine.get_setting("stocks_list"))[:8]
    if not symbols:
        return [Page(engine.lines("STOCKS", "SET SYMBOLS", "IN SETTINGS"))]

    async def fetch() -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for symbol in symbols:
            try:
                results.append(await _quote(engine, symbol))
            except Exception as err:  # noqa: BLE001 - keep the other symbols
                _LOGGER.warning("Stock quote failed for %s: %s", symbol, err)
                results.append({"symbol": symbol.upper(), "error": True})
        return results

    try:
        quotes = await engine.async_cached("stocks", 60, fetch)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Stock fetch failed: %s", err)
        return [Page(engine.lines("STOCKS", "DATA ERROR", "CHECK NETWORK"))]

    pages: list[Page] = []
    for quote in quotes:
        if quote.get("error"):
            pages.append(Page(engine.lines(quote["symbol"], "NO DATA", ""), delay=4.0))
            continue
        price = compact_number(float(quote["price"]), currency=quote.get("currency", ""))
        change_text = ""
        previous = quote.get("previous")
        if previous:
            change = (float(quote["price"]) - float(previous)) / float(previous) * 100
            change_text = signed_percent(change)
        pages.append(
            Page(
                engine.lines(
                    quote.get("symbol", "?"),
                    price,
                    change_text,
                ),
                delay=4.0,
            )
        )
    return pages or [Page(engine.lines("STOCKS", "NO DATA", ""))]


async def _crypto_quotes(engine) -> list[dict[str, Any]]:
    coins = split_csv(engine.get_setting("crypto_list"))[:8]
    if not coins:
        return []
    data = await engine.http_json(
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


async def crypto(engine, now: datetime) -> list[Page]:
    try:
        quotes = await engine.async_cached("crypto", 60, lambda: _crypto_quotes(engine))
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Crypto fetch failed: %s", err)
        return [Page(engine.lines("CRYPTO", "DATA ERROR", "CHECK NETWORK"))]

    if not quotes:
        return [Page(engine.lines("CRYPTO", "SET COINS", "IN SETTINGS"))]

    pages: list[Page] = []
    for quote in quotes:
        if quote.get("error"):
            pages.append(Page(engine.lines(str(quote["id"]).upper(), "NO DATA", ""), delay=4.0))
            continue
        price = quote.get("price")
        price_text = compact_number(float(price), currency="USD") if price is not None else "--"
        change = quote.get("change")
        change_text = signed_percent(float(change)) if change is not None else ""
        pages.append(
            Page(
                engine.lines(str(quote.get("name", "?")).upper(), price_text, change_text),
                delay=4.0,
            )
        )
    return pages
