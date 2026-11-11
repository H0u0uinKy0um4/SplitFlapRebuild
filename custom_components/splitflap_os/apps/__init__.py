"""App registry.

Each app is a local directory::

    apps/<id>/manifest.json   # name, icon, requirements and settings schema
    apps/<id>/app.py          # async def fetch(context, now) -> list[Page]

The registry is built from those manifests by :func:`.loader.load_apps`; there
is no hand-maintained list of apps or settings keys.  Only local folders are
loaded, never remote code.  A newly added folder appears after the integration
is reloaded.

Providers receive :class:`~.common.AppContext` (layout, own settings, cache and
HTTP) rather than the engine, so an app cannot touch MQTT, persistence,
calibration or the display loop.
"""

from __future__ import annotations

from .common import AppContext, AppDef, SettingField
from .loader import AppRegistry, load_apps

__all__ = ["AppContext", "AppDef", "AppRegistry", "SettingField", "load_apps"]
