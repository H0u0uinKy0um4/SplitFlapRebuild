"""Resolve the user behind a control request across Home Assistant versions."""

from __future__ import annotations

from typing import Any, Mapping


def resolve_user_id(source: Any, msg: Mapping[str, Any] | None = None) -> str | None:
    """Return the user id from a connection, call context or entity context.

    Current WebSocket connections expose ``user`` (with an ``id``) and a
    ``context(msg)`` factory; older releases exposed ``user_id`` directly.
    Service calls and entities carry a plain context with ``user_id``.
    """

    user = getattr(source, "user", None)
    user_id = getattr(user, "id", None)
    if user_id is not None:
        return str(user_id)

    legacy_user_id = getattr(source, "user_id", None)
    if legacy_user_id is not None:
        return str(legacy_user_id)

    context = getattr(source, "context", None)
    if callable(context):
        try:
            context = context(msg if msg is not None else {})
        except Exception:  # noqa: BLE001 - an unavailable user is not fatal
            return None

    user_id = getattr(context, "user_id", None)
    return str(user_id) if user_id is not None else None
