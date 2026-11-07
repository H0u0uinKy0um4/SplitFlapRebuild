"""Pure text and board-layout helpers for Split-Flap OS.

This module intentionally has **no** Home Assistant imports.  It is the single
place where text becomes a board of flap characters, so the same rules are used
by the app engine, the services and the tests.
"""

from __future__ import annotations

import math
import random
import textwrap
from typing import Iterable, Sequence

#: The stock 64-character drum.  The first character is a real blank flap.
DEFAULT_DRUM = (
    " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw"
)
FLAP_COUNT = len(DEFAULT_DRUM)

#: Lower-case flaps that are physically coloured tiles on the stock drum.
COLOR_CODES = "roygbpw"

#: Emoji palette from Adam's UI -> firmware colour flap.
COLOR_MAP = {
    "\U0001f7e5": "r",  # red square
    "\U0001f7e7": "o",  # orange square
    "\U0001f7e8": "y",  # yellow square
    "\U0001f7e9": "g",  # green square
    "\U0001f7e6": "b",  # blue square
    "\U0001f7ea": "p",  # purple square
    "\u2b1c": "w",      # white square
    "\u2b1b": " ",      # black square
}

#: Sensible defaults for common board sizes.  Everything else is derived.
_KNOWN_BOARDS: dict[int, tuple[int, int]] = {
    24: (2, 12),
    30: (2, 15),
    32: (2, 16),
    36: (3, 12),
    40: (4, 10),
    42: (3, 14),
    45: (3, 15),
    48: (4, 12),
    50: (5, 10),
    54: (3, 18),
    56: (4, 14),
    60: (4, 15),
    63: (3, 21),
    64: (4, 16),
    70: (5, 14),
    72: (4, 18),
    80: (5, 16),
    96: (6, 16),
    100: (5, 20),
    128: (8, 16),
}


def normalize_text(text: object, *, raw: bool = False) -> str:
    """Apply the character rules shared by every display path.

    Normal text is upper-cased and emoji colour tokens are replaced with the
    firmware's lower-case colour flaps.  ``raw`` pages (animations) keep their
    case so colour codes are not turned into letters.
    """

    value = "" if text is None else str(text)
    if not raw:
        value = value.upper()
    for emoji, code in COLOR_MAP.items():
        value = value.replace(emoji, code)
    # The stock drum addresses a double quote as 'q'.
    return value.replace('"', "q")


def auto_board(
    module_count: int,
    rows: int | str | None = 0,
    cols: int | str | None = 0,
) -> tuple[int, int]:
    """Return a usable ``(rows, columns)`` for the detected module count.

    Either dimension can be fixed by the user.  ``0`` means "choose it".
    """

    try:
        count = max(1, int(module_count))
    except (TypeError, ValueError):
        count = 1

    try:
        want_rows = max(0, int(rows or 0))
    except (TypeError, ValueError):
        want_rows = 0
    try:
        want_cols = max(0, int(cols or 0))
    except (TypeError, ValueError):
        want_cols = 0

    if want_rows and want_cols:
        return want_rows, want_cols
    if want_rows:
        return want_rows, max(1, math.ceil(count / want_rows))
    if want_cols:
        return max(1, math.ceil(count / want_cols)), want_cols

    if count in _KNOWN_BOARDS:
        return _KNOWN_BOARDS[count]

    # Aim for a wide 3-5 row board, which is what split-flap displays usually
    # look like.  The exact size does not matter: unused slots stay blank.
    cols = 15 if count <= 45 else 16
    return max(1, math.ceil(count / cols)), cols


def format_lines(lines: Sequence[object], rows: int, cols: int) -> list[str]:
    """Centre already-short lines into a fixed ``rows x cols`` board.

    This is the helper app providers use for their three (or more) output
    lines.  Long lines are truncated to one row; use :func:`wrap_lines` for
    free-form user text.
    """

    out: list[str] = []
    for value in lines:
        for part in str(value).split("\n"):
            text = normalize_text(part)[:cols]
            out.append(text.center(cols))

    if len(out) > rows:
        out = out[:rows]

    top = (rows - len(out)) // 2
    board = [" " * cols] * top + out
    board.extend([" " * cols] * (rows - len(board)))
    return board[:rows]


def _wrap_paragraph(paragraph: str, cols: int) -> list[str]:
    """Wrap one paragraph without destroying deliberate runs of spaces."""

    if len(paragraph) <= cols:
        return [paragraph]

    # If the paragraph contains deliberate padding runs (Adam's layouts use
    # many spaces) hard-wrap it so those runs survive.  Otherwise use normal
    # word wrapping, which is much friendlier for prose.
    if "  " in paragraph:
        return [paragraph[i : i + cols] for i in range(0, len(paragraph), cols)]

    return textwrap.wrap(
        paragraph,
        width=cols,
        break_long_words=True,
        break_on_hyphens=False,
        replace_whitespace=False,
        drop_whitespace=True,
    ) or [""]


def wrap_lines(
    text: object,
    rows: int,
    cols: int,
    *,
    raw: bool = False,
) -> list[str]:
    """Turn free-form text into a vertically centred, wrapped board."""

    value = normalize_text(text, raw=raw)
    if raw:
        # Animation frames are already a complete board.  Never reflow them.
        value = value.replace("\n", "")
        value = value.ljust(rows * cols)[: rows * cols]
        return [value[i * cols : (i + 1) * cols] for i in range(rows)]

    paragraphs = value.split("\n")
    wrapped: list[str] = []
    for paragraph in paragraphs:
        wrapped.extend(_wrap_paragraph(paragraph.rstrip(), cols))

    if not wrapped:
        wrapped = [""]
    if len(wrapped) > rows:
        wrapped = wrapped[:rows]

    top = (rows - len(wrapped)) // 2
    out = [""] * top + wrapped
    out.extend([""] * (rows - len(out)))
    return [line.center(cols) for line in out[:rows]]


def compose_board(
    text: object,
    rows: int,
    cols: int,
    *,
    raw: bool = False,
) -> tuple[list[str], str]:
    """Return ``(lines, one_string_board)`` for a page of text."""

    lines = wrap_lines(text, rows, cols, raw=raw)
    return lines, "".join(lines)


def _spiral(rows: int, cols: int) -> list[int]:
    """Return board indices in an outside-to-inside spiral."""

    result: list[int] = []
    top, bottom = 0, rows - 1
    left, right = 0, cols - 1
    while top <= bottom and left <= right:
        for c in range(left, right + 1):
            result.append(top * cols + c)
        top += 1
        for r in range(top, bottom + 1):
            result.append(r * cols + right)
        right -= 1
        if top <= bottom:
            for c in range(right, left - 1, -1):
                result.append(bottom * cols + c)
            bottom -= 1
        if left <= right:
            for r in range(bottom, top - 1, -1):
                result.append(r * cols + left)
            left += 1
    return result


def order_indices(style: str | None, rows: int, cols: int) -> list[int]:
    """Return the order in which slots should be sent to the modules.

    The ESP32 master forwards the ``modules`` array in the order it receives
    it, so the array order doubles as the animation order.
    """

    count = rows * cols
    indices = list(range(count))
    key = (style or "ltr").lower().replace("-", "_")

    if key in {"rtl", "right_to_left"}:
        return indices[::-1]
    if key in {"columns", "column", "top_to_bottom"}:
        return [r * cols + c for c in range(cols) for r in range(rows)]
    if key in {"center_out", "centre_out", "outside_in_reverse"}:
        centre_r = (rows - 1) / 2
        centre_c = (cols - 1) / 2
        return sorted(
            indices,
            key=lambda i: (
                ((i // cols) - centre_r) ** 2 + ((i % cols) - centre_c) ** 2,
                i,
            ),
        )
    if key in {"outside_in", "edges_in"}:
        return order_indices("center_out", rows, cols)[::-1]
    if key in {"diagonal", "diag"}:
        return sorted(indices, key=lambda i: (i // cols + i % cols, i // cols, i % cols))
    if key in {"random", "shuffle"}:
        random.shuffle(indices)
        return indices
    if key in {"rain", "rainfall"}:
        columns = list(range(cols))
        random.shuffle(columns)
        return [r * cols + c for c in columns for r in range(rows)]
    if key == "spiral":
        return _spiral(rows, cols)
    return indices


def _flap_index(char: str, drum: str | Sequence[str] | None) -> int | None:
    if not drum:
        drum = DEFAULT_DRUM
    try:
        return list(drum).index(char)
    except ValueError:
        return None


def estimate_rotation_seconds(
    previous: dict[str, str],
    target: dict[str, str],
    drums: dict[str, str | Sequence[str] | None] | None = None,
    *,
    seconds_per_revolution: float = 4.0,
    maximum: float = 8.0,
) -> float:
    """Estimate the time until the slowest module reaches its target.

    Motion is forward-only in the slave firmware, so distance is computed
    modulo the drum length.  Unknown previous positions are charged a full
    revolution; a page must never be changed before the motors have settled.
    """

    drums = drums or {}
    worst = 0
    for module_id, target_char in target.items():
        drum = drums.get(module_id) or DEFAULT_DRUM
        target_index = _flap_index(target_char, drum)
        if target_index is None:
            continue
        previous_char = previous.get(module_id)
        previous_index = _flap_index(previous_char, drum)
        if previous_index is None:
            distance = len(list(drum))
        else:
            distance = (target_index - previous_index) % len(list(drum))
        worst = max(worst, distance)

    seconds = (worst / max(1, len(DEFAULT_DRUM))) * seconds_per_revolution
    return min(maximum, max(0.0, seconds))


def split_csv(value: object) -> list[str]:
    """Split a comma-separated setting into clean, non-empty values."""

    if value is None:
        return []
    return [part.strip() for part in str(value).split(",") if part.strip()]


def board_from_settings(
    module_count: int,
    rows: int | str | None,
    cols: int | str | None,
) -> tuple[int, int]:
    """Backwards-compatible alias used by the engine."""

    return auto_board(module_count, rows, cols)


def color_css(char: str) -> str | None:
    """Return a CSS colour for a firmware colour flap, else ``None``."""

    return {
        "r": "#e53935",
        "o": "#fb8c00",
        "y": "#fdd835",
        "g": "#43a047",
        "b": "#1e88e5",
        "p": "#8e24aa",
        "w": "#f5f5f5",
    }.get(char)


def flatten_lines(lines: Iterable[str]) -> str:
    """Join board lines into the single string sent to the master."""

    return "".join(lines)
