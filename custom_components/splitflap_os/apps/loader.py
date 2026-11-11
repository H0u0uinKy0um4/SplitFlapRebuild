"""Local app discovery.

Every app is a directory under this package::

    apps/<id>/manifest.json
    apps/<id>/app.py

Only apps shipped inside the integration are loaded.  Nothing is downloaded
and no third-party code is executed.  App modules are imported off the event
loop (the engine calls :func:`load_apps` in an executor), and each app gets a
narrow :class:`~.common.AppContext` instead of the engine.

A new app appears after reloading the integration, because the registry is
built during ``async_setup_entry``.
"""

from __future__ import annotations

import importlib.util
import json
import logging
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

from .common import AppContext, AppDef, SettingField

_LOGGER = logging.getLogger(__name__)

_APP_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")

PageProvider = Callable[
    [AppContext, datetime], Awaitable[Any]
]


@dataclass(frozen=True)
class AppRegistry:
    """Everything derived from the on-disk app manifests."""

    apps: tuple[AppDef, ...]
    providers: dict[str, PageProvider]
    groups: list[dict[str, Any]]
    defaults: dict[str, Any]
    keys: frozenset[str]

    def app(self, key: str) -> AppDef | None:
        for app in self.apps:
            if app.key == key:
                return app
        return None

    def provider(self, key: str) -> PageProvider | None:
        return self.providers.get(key)

    def app_defs(self) -> list[dict[str, Any]]:
        return [app.as_dict() for app in self.apps]

    def settings_for_ui(self, settings: dict[str, Any]) -> dict[str, Any]:
        """Return merged defaults plus only keys the registry knows."""

        merged = dict(self.defaults)
        merged.update(
            {key: value for key, value in settings.items() if key in self.keys}
        )
        return merged

    def migrate_settings(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Move pre-namespacing global keys into every app that declared them.

        Older releases stored one flat ``clock_format`` or ``weather_entity``
        key shared by all apps.  Each app now owns its own copy, so the legacy
        value is copied to every app whose manifest declares that local key.
        Values already stored under a namespaced key win.
        """

        migrated = dict(raw)
        for app in self.apps:
            for field in app.fields:
                local = field.key.split(".", 1)[-1]
                if field.key not in migrated and local in raw:
                    migrated[field.key] = raw[local]
        return migrated


def _field_from_manifest(app_key: str, data: dict[str, Any]) -> SettingField:
    if not isinstance(data, dict):
        raise ValueError("settings entries must be objects")
    local_key = str(data.get("key") or "").strip()
    if not local_key:
        raise ValueError("setting without a key")

    visible_when: dict[str, Any] | None = None
    raw_visible = data.get("visible_when")
    if isinstance(raw_visible, dict) and raw_visible.get("key"):
        visible_when = {
            "key": f"{app_key}.{raw_visible['key']}",
            # An empty equals value is meaningful ("show when the field is
            # blank"), so do not use ``or`` here.
            "equals": raw_visible.get("equals", ""),
        }

    options = data.get("options") or ()
    if not isinstance(options, (list, tuple)):
        raise ValueError("setting options must be a list")

    def _optional_number(name: str) -> float | None:
        value = data.get(name)
        return float(value) if value is not None else None

    return SettingField(
        key=f"{app_key}.{local_key}",
        label=str(data.get("label") or local_key),
        type=str(data.get("type") or "text"),
        options=tuple(str(option) for option in options),
        placeholder=str(data.get("placeholder") or ""),
        default=data.get("default", ""),
        minimum=_optional_number("min"),
        maximum=_optional_number("max"),
        step=_optional_number("step"),
        domain=str(data["domain"]) if data.get("domain") else None,
        help=str(data.get("help") or ""),
        visible_when=visible_when,
    )


def _app_from_manifest(manifest: dict[str, Any]) -> AppDef:
    key = str(manifest.get("key") or "").strip()
    if not _APP_KEY_RE.match(key):
        raise ValueError(f"invalid app key: {key!r}")

    raw_fields = manifest.get("fields") or []
    if not isinstance(raw_fields, list):
        raise ValueError("fields must be a list")
    fields = tuple(_field_from_manifest(key, item) for item in raw_fields)

    modes = manifest.get("modes") or ()
    if not isinstance(modes, (list, tuple)):
        raise ValueError("modes must be a list")

    translations = manifest.get("translations") or {}
    if not isinstance(translations, dict):
        raise ValueError("translations must be an object")

    return AppDef(
        key=key,
        name=str(manifest.get("name") or key),
        icon=str(manifest.get("icon") or ""),
        description=str(manifest.get("description") or ""),
        fields=fields,
        default_delay=float(manifest.get("default_delay", 5.0)),
        category=str(manifest.get("category") or "data"),
        min_rows=max(1, int(manifest.get("min_rows", 1))),
        min_cols=max(1, int(manifest.get("min_cols", 1))),
        modes=tuple(str(mode) for mode in modes),
        translations=translations,
    )


def _load_provider(app_dir: Path, app_key: str) -> PageProvider:
    module_path = app_dir / "app.py"
    if not module_path.is_file():
        raise ValueError("app.py is missing")

    module_name = f"{__package__}.{app_key}.app"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ValueError("app.py could not be imported")
    module = importlib.util.module_from_spec(spec)
    # Register before exec so relative imports and dataclasses can resolve
    # the module by name during import.
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(module_name, None)
        raise

    provider = getattr(module, "fetch", None)
    if provider is None:
        # Backwards-compatible with the older module layout, where the
        # provider was the module's only public coroutine.
        provider = getattr(module, "provider", None)
    if not callable(provider):
        raise ValueError("app.py must define fetch(context, now)")
    return provider


def load_apps(
    apps_dir: str | Path,
    *,
    global_defaults: dict[str, Any] | None = None,
    display_group: dict[str, Any] | None = None,
) -> AppRegistry:
    """Discover and import every local app.  Intended for an executor job.

    ``global_defaults`` and ``display_group`` come from :mod:`.settings`; the
    engine passes them in so this module does not need to import the settings
    module (which would make the package import order fragile).
    """

    root = Path(apps_dir)
    apps: list[AppDef] = []
    providers: dict[str, PageProvider] = {}

    for app_dir in sorted(root.iterdir()):
        if not app_dir.is_dir() or app_dir.name.startswith(("_", ".")):
            continue
        manifest_path = app_dir / "manifest.json"
        if not manifest_path.is_file():
            continue
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(manifest, dict):
                raise ValueError("manifest must be a JSON object")
            app = _app_from_manifest(manifest)
            if app.key in providers:
                raise ValueError(f"duplicate app key: {app.key}")
            provider = _load_provider(app_dir, app.key)
        except Exception as err:  # noqa: BLE001 - one bad app must not break boot
            _LOGGER.exception("Skipping Split-Flap OS app %s: %s", app_dir.name, err)
            continue
        apps.append(app)
        providers[app.key] = provider

    apps.sort(key=lambda app: app.key)
    groups: list[dict[str, Any]] = [
        display_group
    ] if display_group else []
    groups.extend(
        {
            "key": app.key,
            "name": app.name,
            "icon": app.icon,
            "category": "apps",
            "fields": [field.as_dict() for field in app.fields],
        }
        for app in apps
        if app.fields
    )

    defaults: dict[str, Any] = dict(global_defaults or {})
    for app in apps:
        for field in app.fields:
            defaults[field.key] = field.default

    return AppRegistry(
        apps=tuple(apps),
        providers=providers,
        groups=groups,
        defaults=defaults,
        keys=frozenset(defaults),
    )
