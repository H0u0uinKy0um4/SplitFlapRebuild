"""App registry checks without Home Assistant."""

from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPONENT_DIR = ROOT / "custom_components" / "splitflap_os"


def _install_fake_package() -> None:
    if "splitflap_os" in sys.modules:
        return
    pkg = types.ModuleType("splitflap_os")
    pkg.__path__ = [str(COMPONENT_DIR)]
    sys.modules["splitflap_os"] = pkg


_install_fake_package()

from splitflap_os.apps.common import AppContext  # noqa: E402
from splitflap_os.apps.loader import load_apps  # noqa: E402
from splitflap_os.settings import display_group, global_defaults  # noqa: E402


class AppRegistryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.registry = load_apps(
            COMPONENT_DIR / "apps",
            global_defaults=global_defaults(),
            display_group=display_group(),
        )

    def test_twelve_apps_load(self) -> None:
        self.assertEqual(len(self.registry.apps), 12)
        self.assertEqual(
            {app.key for app in self.registry.apps},
            {
                "animations",
                "clock",
                "countdown",
                "crypto",
                "dashboard",
                "date",
                "iss",
                "metro",
                "sports",
                "stocks",
                "weather",
                "world_clock",
            },
        )

    def test_every_app_has_provider(self) -> None:
        for app in self.registry.apps:
            self.assertIsNotNone(self.registry.provider(app.key))

    def test_settings_are_namespaced(self) -> None:
        self.assertIn("clock.clock_format", self.registry.keys)
        self.assertIn("weather.weather_entity", self.registry.keys)
        self.assertNotIn("clock_format", self.registry.keys)

    def test_visible_when_is_namespaced(self) -> None:
        weather_group = next(
            group for group in self.registry.groups if group["key"] == "weather"
        )
        field = next(
            field
            for field in weather_group["fields"]
            if field["key"] == "weather.zip_code"
        )
        self.assertEqual(
            field["visible_when"],
            {"key": "weather.weather_entity", "equals": ""},
        )

    def test_legacy_flat_keys_migrate(self) -> None:
        migrated = self.registry.migrate_settings(
            {"clock_format": "24h", "weather_entity": "weather.home"}
        )
        self.assertEqual(migrated["clock.clock_format"], "24h")
        self.assertEqual(migrated["weather.weather_entity"], "weather.home")

    def test_display_group_present(self) -> None:
        self.assertEqual(self.registry.groups[0]["key"], "display")

    def test_translations_are_present_in_manifests(self) -> None:
        for app in self.registry.apps:
            self.assertIn("cs", app.translations)
            cs = app.translations["cs"]
            self.assertTrue(cs.get("name"))
            self.assertTrue(cs.get("description"))

    def test_select_field_options_have_translations(self) -> None:
        for app in self.registry.apps:
            cs = app.translations.get("cs", {})
            cs_fields = cs.get("fields", {})
            for field in app.fields:
                if field.options:
                    local_key = field.key.removeprefix(f"{app.key}.")
                    cs_field = cs_fields.get(local_key, {})
                    cs_options = cs_field.get("options", {})
                    for opt in field.options:
                        self.assertIn(
                            opt,
                            cs_options,
                            f"{app.key}.{local_key} option {opt!r} missing in cs translation",
                        )

    def test_as_dict_includes_translations(self) -> None:
        app_dicts = self.registry.app_defs()
        for app_dict in app_dicts:
            self.assertIn("translations", app_dict)
            self.assertIn("cs", app_dict["translations"])

    async def test_app_context_fetch_app(self) -> None:
        class DummyEngine:
            def __init__(self, registry: Any) -> None:
                self.registry = registry
                self.tz = None
                self.board = (3, 9)
                self.rows = 3
                self.cols = 9
                self.layout = None
                self.unit_system = "metric"
                self.active_app_mode = None
                self.session = None
                self.http_timeout = 10
                self.hass = None

            def get_setting(self, key: str, default: Any = None, app: str = "") -> Any:
                return default

            def lines(self, *values: object) -> str:
                return "\n".join(str(v) for v in values)

        engine = DummyEngine(self.registry)
        ctx = AppContext(engine, "dashboard")
        pages = await ctx.fetch_app("clock")
        self.assertTrue(len(pages) > 0)
        with self.assertRaises(KeyError):
            await ctx.fetch_app("nonexistent_app")


if __name__ == "__main__":
    unittest.main(verbosity=2)
