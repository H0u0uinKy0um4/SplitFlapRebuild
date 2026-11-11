"""Weather app.

Home Assistant weather entities are the primary source.  An OpenWeatherMap
fallback is available for installations that do not have a weather entity.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ...models import Page
from ..common import condition_label

_LOGGER = logging.getLogger(__name__)


def _source_unit(attrs: dict[str, Any]) -> str:
    unit = str(attrs.get("temperature_unit") or "°C")
    return "F" if "F" in unit.upper() else "C"


def _format_temp(ctx, value: Any, source_unit: str) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "--"

    target = ctx.unit_system
    if target == "imperial" and source_unit == "C":
        number = number * 9 / 5 + 32
        unit = "F"
    elif target == "metric" and source_unit == "F":
        number = (number - 32) * 5 / 9
        unit = "C"
    else:
        unit = source_unit
    return f"{round(number)}{unit}"


async def _fetch_forecast(ctx, entity_id: str) -> list[dict[str, Any]]:
    try:
        response = await ctx.hass.services.async_call(
            "weather",
            "get_forecasts",
            {"entity_id": entity_id, "type": "daily"},
            blocking=True,
            return_response=True,
        )
    except Exception as err:  # noqa: BLE001 - not every weather entity supports it
        _LOGGER.debug("Weather forecast unavailable for %s: %s", entity_id, err)
        return []

    if not isinstance(response, dict):
        return []
    entry = response.get(entity_id)
    if not isinstance(entry, dict):
        return []
    forecast = entry.get("forecast")
    return forecast if isinstance(forecast, list) else []


async def _ha_weather(ctx) -> dict[str, Any] | None:
    entity_id = str(ctx.get_setting("weather_entity", "")).strip()
    if not entity_id:
        return None
    state = ctx.hass.states.get(entity_id)
    if state is None:
        return None

    attrs = dict(state.attributes)
    forecast = await _fetch_forecast(ctx, entity_id)
    return {
        "source": "ha",
        "name": state.name or entity_id,
        "condition": state.state,
        "attrs": attrs,
        "forecast": forecast,
        "unit": _source_unit(attrs),
    }


async def _openweather(ctx) -> dict[str, Any] | None:
    api_key = str(ctx.get_setting("weather_api_key", "")).strip()
    zip_code = str(ctx.get_setting("zip_code", "")).strip()
    if not api_key or not zip_code:
        return None

    units = "imperial" if ctx.unit_system == "imperial" else "metric"
    current = await ctx.http_json(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"zip": zip_code, "appid": api_key, "units": units},
    )
    if not isinstance(current, dict):
        return None

    main = current.get("main") or {}
    weather = (current.get("weather") or [{}])[0]
    forecast_data = await ctx.http_json(
        "https://api.openweathermap.org/data/2.5/forecast",
        params={"zip": zip_code, "appid": api_key, "units": units},
    )
    high = low = None
    if isinstance(forecast_data, dict):
        values = [
            (item.get("main") or {}).get("temp")
            for item in forecast_data.get("list", [])
            if isinstance(item, dict)
        ]
        values = [value for value in values if isinstance(value, (int, float))]
        if values:
            high, low = max(values), min(values)

    return {
        "source": "openweather",
        "name": str(current.get("name") or zip_code),
        "condition": weather.get("main", "UNKNOWN"),
        "attrs": {
            "temperature": main.get("temp"),
            "apparent_temperature": main.get("feels_like"),
            "humidity": main.get("humidity"),
            "wind_speed": (current.get("wind") or {}).get("speed"),
            "temperature_unit": "F" if units == "imperial" else "C",
        },
        "forecast": [{"temperature": high, "templow": low}] if high is not None else [],
        "unit": "F" if units == "imperial" else "C",
    }


async def _snapshot(ctx) -> dict[str, Any] | None:
    data = await _ha_weather(ctx)
    if data is None:
        data = await _openweather(ctx)
    return data


async def fetch(ctx, now: datetime) -> list[Page]:
    try:
        data = await ctx.async_cached(
            "weather", 15 * 60, lambda: _snapshot(ctx)
        )
    except Exception as err:  # noqa: BLE001 - show an error page, never crash the loop
        _LOGGER.warning("Weather fetch failed: %s", err)
        data = None

    if not data:
        return [
            Page(
                ctx.lines(
                    "WEATHER",
                    "SET ENTITY",
                    "IN SETTINGS",
                ),
                delay=5.0,
            )
        ]

    attrs = data.get("attrs") or {}
    unit = data.get("unit") or "C"
    name = str(data.get("name") or "WEATHER").upper()
    condition = condition_label(data.get("condition"))
    temp = _format_temp(ctx, attrs.get("temperature"), unit)
    feels = _format_temp(ctx, attrs.get("apparent_temperature"), unit)
    high = low = None
    forecast = data.get("forecast") or []
    if forecast and isinstance(forecast[0], dict):
        high = _format_temp(ctx, forecast[0].get("temperature"), unit)
        low = _format_temp(ctx, forecast[0].get("templow"), unit)

    humidity = attrs.get("humidity")
    wind = attrs.get("wind_speed")
    extra: list[str] = []
    if high != "--" and low != "--":
        extra.append(f"H:{high} L:{low}")
    if feels != "--":
        extra.append(f"FEELS {feels}")
    if humidity is not None:
        try:
            extra.append(f"HUM {round(float(humidity))}%")
        except (TypeError, ValueError):
            pass
    if wind is not None:
        try:
            extra.append(f"WIND {round(float(wind))}")
        except (TypeError, ValueError):
            pass

    lines = [name, f"{temp} {condition}"]
    lines.extend(extra)
    return [Page(ctx.lines(*lines), delay=5.0)]
