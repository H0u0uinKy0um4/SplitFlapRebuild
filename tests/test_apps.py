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

from splitflap_os.apps.loader import load_apps  # noqa: E402
from splitflap_os.settings import display_group, global_defaults  # noqa: E402


class AppRegistryTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main(verbosity=2)
