"""App registry.

Adding an app is intentionally small:

1. Write an ``async def provider(engine, now) -> list[Page]`` in a module in
   this package.
2. Describe it with :class:`AppDef` below.
3. Add it to :data:`APP_PROVIDERS`.

The engine calls the provider once per display cycle.  Providers may return
one or more pages, and may use ``engine.async_cached`` for slow network calls.
"""

from __future__ import annotations

from .animations import animations
from .common import AppDef, SettingField
from .iss import iss
from .markets import crypto, stocks
from .metro import metro
from .sports import sports
from .time_apps import clock, countdown, dashboard, date, world_clock
from .weather import weather

WEATHER_FIELDS = (
    SettingField(
        key="weather_entity",
        label="Weather entity",
        type="entity",
        domain="weather",
        placeholder="weather.home",
        help="Preferred source. Uses Home Assistant's own weather data.",
    ),
    SettingField(
        key="zip_code",
        label="ZIP code (OpenWeather fallback)",
        type="text",
        placeholder="02118",
    ),
    SettingField(
        key="weather_api_key",
        label="OpenWeather API key (fallback)",
        type="password",
        placeholder="optional",
    ),
)

STOCK_FIELDS = (
    SettingField(
        key="stocks_list",
        label="Stock symbols",
        type="text",
        placeholder="MSFT,GOOG,NVDA",
        help="Comma-separated Yahoo Finance symbols.",
    ),
)

CRYPTO_FIELDS = (
    SettingField(
        key="crypto_list",
        label="CoinGecko coin ids",
        type="text",
        placeholder="bitcoin,ethereum,solana",
    ),
)

SPORTS_FIELDS = (
    SettingField(
        key="sports_teams",
        label="NHL teams",
        type="text",
        placeholder="BOS,DAL",
        help="Comma-separated abbreviations. Empty shows every game.",
    ),
)

METRO_FIELDS = (
    SettingField(
        key="metro_stop",
        label="MBTA stop id",
        type="text",
        placeholder="place-bbsta",
    ),
    SettingField(
        key="metro_route",
        label="MBTA route",
        type="text",
        placeholder="Orange",
    ),
    SettingField(
        key="mbta_api_key",
        label="MBTA API key",
        type="password",
        placeholder="optional",
    ),
)

COUNTDOWN_FIELDS = (
    SettingField(
        key="countdown_event",
        label="Event name",
        type="text",
        placeholder="NEW YEAR",
    ),
    SettingField(
        key="countdown_target",
        label="Target date/time",
        type="datetime-local",
        help="Local time in the configured timezone.",
    ),
    SettingField(
        key="clock_format",
        label="Clock format",
        type="select",
        options=("12h", "24h"),
    ),
)

WORLD_CLOCK_FIELDS = (
    SettingField(
        key="world_clock_zones",
        label="Time zones",
        type="text",
        placeholder="US/Eastern,US/Pacific,Europe/London",
        help="Comma-separated IANA zone names.",
    ),
)

ANIMATION_FIELDS = (
    SettingField(
        key="anim_effect",
        label="Effect",
        type="select",
        options=("rainbow", "sweep", "checker", "twinkle"),
    ),
    SettingField(
        key="anim_style",
        label="Send order",
        type="select",
        options=(
            "ltr",
            "rtl",
            "columns",
            "center_out",
            "outside_in",
            "diagonal",
            "random",
            "rain",
            "spiral",
        ),
    ),
    SettingField(
        key="anim_speed",
        label="Frame delay (s)",
        type="number",
        default="0.4",
        minimum=0.1,
        maximum=5,
        step=0.1,
    ),
)

APP_DEFS: tuple[AppDef, ...] = (
    AppDef(
        key="clock",
        name="Clock",
        icon="🕒",
        description="Local time",
        fields=(
            SettingField(
                key="clock_format",
                label="Clock format",
                type="select",
                options=("12h", "24h"),
            ),
        ),
        default_delay=1.0,
        category="time",
        min_rows=3,
        min_cols=9,
        modes=("full", "time", "date"),
    ),
    AppDef(
        key="date",
        name="Date",
        icon="📅",
        description="Day, date and time",
        default_delay=1.0,
        category="time",
        min_rows=3,
        min_cols=11,
    ),
    AppDef(
        key="dashboard",
        name="Dashboard",
        icon="📊",
        description="Date then weather",
        fields=WEATHER_FIELDS,
        default_delay=4.0,
        category="time",
        min_rows=3,
        min_cols=11,
    ),
    AppDef(
        key="weather",
        name="Weather",
        icon="🌤️",
        description="Current conditions",
        fields=WEATHER_FIELDS,
        default_delay=5.0,
        category="data",
        min_rows=3,
        min_cols=10,
    ),
    AppDef(
        key="stocks",
        name="Stocks",
        icon="📈",
        description="Live prices",
        fields=STOCK_FIELDS,
        default_delay=4.0,
        category="data",
        min_rows=3,
        min_cols=7,
    ),
    AppDef(
        key="crypto",
        name="Crypto",
        icon="₿",
        description="Coin prices",
        fields=CRYPTO_FIELDS,
        default_delay=4.0,
        category="data",
        min_rows=3,
        min_cols=8,
    ),
    AppDef(
        key="sports",
        name="Sports",
        icon="🏒",
        description="NHL scores",
        fields=SPORTS_FIELDS,
        default_delay=5.0,
        category="data",
        min_rows=3,
        min_cols=8,
    ),
    AppDef(
        key="metro",
        name="Metro",
        icon="🚇",
        description="Transit arrivals",
        fields=METRO_FIELDS,
        default_delay=5.0,
        category="data",
        min_rows=3,
        min_cols=10,
    ),
    AppDef(
        key="countdown",
        name="Countdown",
        icon="⏳",
        description="Timer to an event",
        fields=COUNTDOWN_FIELDS,
        default_delay=1.0,
        category="time",
        min_rows=3,
        min_cols=12,
    ),
    AppDef(
        key="world_clock",
        name="World Clock",
        icon="🌍",
        description="Multiple time zones",
        fields=WORLD_CLOCK_FIELDS,
        default_delay=1.0,
        category="time",
        min_rows=1,
        min_cols=10,
    ),
    AppDef(
        key="iss",
        name="ISS",
        icon="🛸",
        description="Space station position",
        default_delay=5.0,
        category="data",
        min_rows=3,
        min_cols=10,
    ),
    AppDef(
        key="animations",
        name="Animations",
        icon="🎨",
        description="Colour effects",
        fields=ANIMATION_FIELDS,
        default_delay=0.4,
        category="animation",
        min_rows=1,
        min_cols=1,
    ),
)

APP_DEFS_BY_KEY: dict[str, AppDef] = {app.key: app for app in APP_DEFS}

APP_PROVIDERS = {
    "clock": clock,
    "date": date,
    "dashboard": dashboard,
    "weather": weather,
    "stocks": stocks,
    "crypto": crypto,
    "sports": sports,
    "metro": metro,
    "countdown": countdown,
    "world_clock": world_clock,
    "iss": iss,
    "animations": animations,
}


def app_defs() -> list[dict]:
    return [app.as_dict() for app in APP_DEFS]
