"""Config and options flow for Split-Flap OS."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import (
    CONF_NAME,
    CONF_TOPIC_PREFIX,
    DEFAULT_DEVICE_NAME,
    DEFAULT_TOPIC_PREFIX,
    DOMAIN,
)


def _clean_prefix(value: Any) -> str:
    cleaned = str(value or "").strip().strip("/")
    if not cleaned:
        raise vol.Invalid("invalid_prefix")
    if any(char in cleaned for char in "+#"):
        raise vol.Invalid("invalid_prefix")
    return cleaned


def _clean_name(value: Any) -> str:
    cleaned = str(value or "").strip()
    return cleaned[:64] or DEFAULT_DEVICE_NAME


def _schema(defaults: dict[str, str]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_TOPIC_PREFIX,
                default=defaults.get(CONF_TOPIC_PREFIX, DEFAULT_TOPIC_PREFIX),
            ): vol.All(str, _clean_prefix),
            vol.Optional(
                CONF_NAME,
                default=defaults.get(CONF_NAME, DEFAULT_DEVICE_NAME),
            ): vol.All(str, _clean_name),
        }
    )


class SplitFlapOSConfigFlow(ConfigFlow, domain=DOMAIN):
    """Create the single Split-Flap OS entry."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data={
                    CONF_TOPIC_PREFIX: user_input[CONF_TOPIC_PREFIX],
                    CONF_NAME: user_input[CONF_NAME],
                },
            )

        return self.async_show_form(step_id="user", data_schema=_schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return SplitFlapOSOptionsFlow()


class SplitFlapOSOptionsFlow(OptionsFlow):
    """Change the MQTT prefix or device name."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        entry = self.config_entry

        if user_input is not None:
            name = user_input[CONF_NAME]
            self.hass.config_entries.async_update_entry(entry, title=name)
            return self.async_create_entry(
                title="",
                data={
                    CONF_TOPIC_PREFIX: user_input[CONF_TOPIC_PREFIX],
                    CONF_NAME: name,
                },
            )

        defaults = {
            CONF_TOPIC_PREFIX: entry.options.get(
                CONF_TOPIC_PREFIX,
                entry.data.get(CONF_TOPIC_PREFIX, DEFAULT_TOPIC_PREFIX),
            ),
            CONF_NAME: entry.options.get(
                CONF_NAME, entry.data.get(CONF_NAME, entry.title)
            ),
        }
        return self.async_show_form(step_id="init", data_schema=_schema(defaults))
