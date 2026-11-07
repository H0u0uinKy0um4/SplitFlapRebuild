"""Pure helpers for the slave's flap position map.

The map is published by the master as an ``index=position,...`` string.  A
position of ``0xFFFF`` means "this flap has never been tuned"; such entries
must not be treated as stored coordinates.  Keeping this parsing free of Home
Assistant imports lets it be unit tested without a running instance.
"""

from __future__ import annotations

import json
from typing import Any

#: Sentinel used by the slave firmware for an unset map entry.
POSITION_MAP_UNSET = 0xFFFF


def _coerce_optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _valid_position(value: Any) -> int | None:
    position = _coerce_optional_int(value)
    if position is None or not 0 <= position < POSITION_MAP_UNSET:
        return None
    return position


def normalize_position_map(value: Any) -> dict[str, int] | None:
    """Normalize ``index=pos`` text or a JSON/dict map.

    Unset (``0xFFFF``), negative and out-of-range positions are omitted so the
    UI and the display engine fall back to the estimated flap position instead
    of treating a sentinel as a real coordinate.
    """

    if value is None:
        return None

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.startswith("{"):
            try:
                return normalize_position_map(json.loads(text))
            except json.JSONDecodeError:
                return None
        result: dict[str, int] = {}
        for pair in text.split(","):
            key, separator, position = pair.partition("=")
            if not separator:
                continue
            index = _coerce_optional_int(key)
            pos = _valid_position(position)
            if index is not None and pos is not None:
                result[str(index)] = pos
        return result or None

    if isinstance(value, dict):
        result: dict[str, int] = {}
        for key, item in value.items():
            if isinstance(item, dict):
                item = item.get("position", item.get("pos", item.get("step")))
            index = _coerce_optional_int(key)
            pos = _valid_position(item)
            if index is not None and pos is not None:
                result[str(index)] = pos
        return result or None

    if isinstance(value, (list, tuple)):
        result: dict[str, int] = {}
        for fallback_index, item in enumerate(value):
            if isinstance(item, dict):
                index = item.get("index", item.get("flap", fallback_index))
                item = item.get("position", item.get("pos", item.get("step")))
            else:
                index = fallback_index
            index = _coerce_optional_int(index)
            pos = _valid_position(item)
            if index is not None and pos is not None:
                result[str(index)] = pos
        return result or None

    return None
