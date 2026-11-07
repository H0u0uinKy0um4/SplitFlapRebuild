"""Serve and register the Split-Flap OS sidebar panel."""

from __future__ import annotations

import logging
import os

from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    FRONTEND_DIR,
    FRONTEND_FILENAME,
    FRONTEND_URL_PATH,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)


def _panel_path() -> str:
    return os.path.join(
        os.path.dirname(__file__), FRONTEND_DIR, FRONTEND_FILENAME
    )


async def _async_register_static_path(hass: HomeAssistant) -> bool:
    """Serve the panel JavaScript from the integration directory."""

    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("_static_registered"):
        return True

    path = _panel_path()
    if not os.path.isfile(path):
        _LOGGER.error("Split-Flap OS panel file not found: %s", path)
        return False

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_PATH, path, cache_headers=False)]
        )
    except (ImportError, AttributeError):
        register = getattr(hass.http, "register_static_path", None)
        if register is None:
            _LOGGER.warning("Could not register the Split-Flap OS panel path")
            return False
        register(FRONTEND_URL_PATH, path, cache_headers=False)
    except RuntimeError:
        # The path is already registered, which happens when Home Assistant is
        # reloading this integration in place.
        _LOGGER.debug("Panel static path was already registered")

    domain_data["_static_registered"] = True
    return True


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the sidebar panel once per Home Assistant process."""

    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get("_panel_registered"):
        return

    if not await _async_register_static_path(hass):
        return

    try:
        from homeassistant.components import panel_custom

        await panel_custom.async_register_panel(
            hass,
            webcomponent_name=PANEL_ELEMENT,
            frontend_url_path=PANEL_URL_PATH,
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=f"{FRONTEND_URL_PATH}?v={VERSION}",
            embed_iframe=False,
            require_admin=False,
            config={"domain": DOMAIN, "version": VERSION},
        )
        domain_data["_panel_registered"] = True
        _LOGGER.debug("Registered Split-Flap OS panel")
    except ValueError as err:
        # A panel with this path already exists.  Do not fail integration setup
        # because of a stale panel from an earlier reload.
        _LOGGER.warning("Could not register Split-Flap OS panel: %s", err)
    except Exception:  # noqa: BLE001 - the integration must still load
        _LOGGER.exception("Unexpected error registering Split-Flap OS panel")


async def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove the sidebar panel when the integration is deleted."""

    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get("_panel_registered"):
        return

    try:
        from homeassistant.components import frontend

        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    except Exception:  # noqa: BLE001 - removal is best effort
        _LOGGER.debug("Could not remove Split-Flap OS panel", exc_info=True)

    domain_data["_panel_registered"] = False
