"""Pure text and board-layout helpers for Split-Flap OS.

This module intentionally has **no** Home Assistant imports.  It is the single
place where text becomes a board of flap characters, so the same rules are used
by the app engine, the services and the tests.
"""

from __future__ import annotations

import math
import random
import re
import textwrap
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

#: The stock 64-character drum.  The first character is a real blank flap.
DEFAULT_DRUM = (
    " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw"
)
FLAP_COUNT = len(DEFAULT_DRUM)

#: Lower-case flaps that are physically coloured tiles on the stock drum.
PHYSICAL_COLOR_CODES = "roygbpw"
#: All colour codes including software-only additions for custom drums.
COLOR_CODES = "roygbpwcm"

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
    "\U0001fa75": "c",  # cyan (light blue heart)
    "\U0001fa77": "m",  # magenta (pink heart)
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


@dataclass(frozen=True)
class Layout:
    """A resolved physical module layout.

    ``cell_slots`` is a flat ``rows * cols`` tuple.  Each entry is either the
    0-based module slot that lives in that frame cell, or ``None`` for a blank
    frame cell.  Module slots are assigned left-to-right, top-to-bottom.
    """

    rows: int
    cols: int
    row_counts: tuple[int, ...]
    cell_slots: tuple[int | None, ...]
    error: str | None = None

    @property
    def valid(self) -> bool:
        return self.error is None

    @property
    def module_count(self) -> int:
        return sum(self.row_counts)

    @property
    def min_cols(self) -> int:
        """Width of the narrowest non-empty row."""

        counts = [count for count in self.row_counts if count > 0]
        return min(counts) if counts else 0

    @property
    def row_offsets(self) -> tuple[int, ...]:
        """Left offsets that centre each row in the physical frame."""

        return tuple((self.cols - count) // 2 for count in self.row_counts)

    def slot_at(self, row: int, col: int) -> int | None:
        if not (0 <= row < self.rows and 0 <= col < self.cols):
            return None
        return self.cell_slots[row * self.cols + col]

    def slots(self) -> list[int]:
        return [slot for slot in self.cell_slots if slot is not None]

    def as_board_dict(self) -> dict[str, object]:
        return {
            "rows": self.rows,
            "cols": self.cols,
            "row_counts": list(self.row_counts),
            "row_offsets": list(self.row_offsets),
            "min_cols": self.min_cols,
            "layout_module_count": self.module_count,
            "error": self.error,
        }


def _as_dimension(value: int | str | None) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def parse_row_counts(value: object) -> tuple[int, ...]:
    """Parse ``"3,3,1"`` into ``(3, 3, 1)``.

    Blank input means "use automatic layout".  Non-empty input must contain
    positive whole numbers; anything else raises :class:`ValueError` so the
    panel can show a useful message.
    """

    if value is None:
        return ()
    if isinstance(value, (list, tuple)):
        parts = [str(part).strip() for part in value]
    else:
        text = str(value).strip()
        if not text:
            return ()
        parts = [part for part in re.split(r"[,;\s]+", text) if part]

    counts: list[int] = []
    for part in parts:
        try:
            count = int(part)
        except (TypeError, ValueError) as err:
            raise ValueError(
                f"Row layout must contain whole numbers, not {part!r}"
            ) from err
        if count <= 0:
            raise ValueError("Row layout counts must be greater than zero")
        counts.append(count)
    return tuple(counts)


def _build_layout(
    rows: int,
    cols: int,
    row_counts: Sequence[int],
    error: str | None = None,
) -> Layout:
    rows = max(1, rows)
    cols = max(1, cols)
    counts = tuple(max(0, min(cols, int(count))) for count in row_counts)
    if len(counts) < rows:
        counts = counts + (0,) * (rows - len(counts))
    elif len(counts) > rows:
        counts = counts[:rows]

    cells: list[int | None] = [None] * (rows * cols)
    slot = 0
    for row, count in enumerate(counts):
        offset = (cols - count) // 2
        for col in range(offset, offset + count):
            cells[row * cols + col] = slot
            slot += 1

    return Layout(
        rows=rows,
        cols=cols,
        row_counts=counts,
        cell_slots=tuple(cells),
        error=error,
    )


def _filled_row_counts(count: int, rows: int, cols: int) -> tuple[int, ...]:
    """Fill a frame row-by-row, leaving the last row short when needed."""

    if count <= 0:
        return (cols,) * rows
    counts: list[int] = []
    remaining = count
    for _ in range(rows):
        take = min(cols, remaining)
        counts.append(take)
        remaining -= take
    return tuple(counts)


def resolve_layout(
    module_count: int,
    rows: int | str | None = 0,
    cols: int | str | None = 0,
    row_counts: object = "",
) -> Layout:
    """Resolve the physical frame and per-cell module mapping.

    ``module_count`` may be ``0`` when the bus has not been scanned yet.  In
    that case the structure is still validated, but the detected count is not
    compared with the configured layout.
    """

    try:
        count = max(0, int(module_count))
    except (TypeError, ValueError):
        count = 0
    known_count = count > 0

    want_rows = _as_dimension(rows)
    want_cols = _as_dimension(cols)

    try:
        explicit = parse_row_counts(row_counts)
    except ValueError as err:
        fallback_rows, fallback_cols = auto_board(count or 1)
        return _build_layout(
            fallback_rows,
            fallback_cols,
            _filled_row_counts(count, fallback_rows, fallback_cols),
            str(err),
        )

    if explicit:
        counts = list(explicit)
        frame_rows = want_rows or len(counts)
        frame_cols = want_cols or max(counts)
        errors: list[str] = []

        if want_rows and want_rows != len(counts):
            errors.append(
                f"Row layout has {len(counts)} row(s) but the frame is "
                f"{want_rows} row(s)"
            )
            frame_rows = len(counts)
        if want_cols and want_cols < max(counts):
            errors.append(
                f"Row layout needs at least {max(counts)} columns but the "
                f"frame has {want_cols}"
            )

        total = sum(counts)
        if known_count and total != count:
            errors.append(
                f"Row layout describes {total} module(s) but {count} were "
                "detected"
            )

        blank = frame_rows * frame_cols - total
        if blank < 0:
            errors.append("Row layout does not fit inside the frame")
        elif blank > frame_cols:
            errors.append(
                f"Layout leaves {blank} blank cell(s); at most one row "
                f"({frame_cols}) is allowed"
            )

        return _build_layout(
            frame_rows,
            frame_cols,
            counts,
            "; ".join(errors) if errors else None,
        )

    if not want_rows and not want_cols:
        frame_rows, frame_cols = auto_board(count or 1)
    elif want_rows and not want_cols:
        frame_rows = want_rows
        frame_cols = max(1, math.ceil(count / frame_rows)) if known_count else 1
    elif want_cols and not want_rows:
        frame_cols = want_cols
        frame_rows = max(1, math.ceil(count / frame_cols)) if known_count else 1
    else:
        frame_rows, frame_cols = want_rows, want_cols

    capacity = frame_rows * frame_cols
    errors = []
    if known_count and count > capacity:
        errors.append(
            f"The {frame_rows}×{frame_cols} frame only fits {capacity} of "
            f"{count} detected module(s)"
        )

    counts = _filled_row_counts(count, frame_rows, frame_cols)
    blank = capacity - min(count, capacity)
    # With an unscanned bus (count 0) the board is assumed full, so the blank
    # comparison is meaningless until modules are actually detected.
    if known_count and blank > frame_cols:
        errors.append(
            f"Layout leaves {blank} blank cell(s); at most one row "
            f"({frame_cols}) is allowed. Set a row layout such as 3,3,1."
        )

    return _build_layout(
        frame_rows,
        frame_cols,
        counts,
        "; ".join(errors) if errors else None,
    )


def app_fits(
    layout: Layout,
    min_rows: int = 1,
    min_cols: int = 1,
) -> tuple[bool, str]:
    """Return whether an app fits the physical layout, and why not."""

    need_rows = max(1, int(min_rows or 1))
    need_cols = max(1, int(min_cols or 1))
    if need_rows == 1 and need_cols == 1:
        return True, ""
    if layout.rows < need_rows:
        return (
            False,
            f"Needs {need_rows} rows; this layout has {layout.rows}",
        )
    if layout.min_cols < need_cols:
        return (
            False,
            f"Needs every row to be at least {need_cols} columns; the "
            f"narrowest row has {layout.min_cols}",
        )
    return True, ""


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

    want_rows = _as_dimension(rows)
    want_cols = _as_dimension(cols)

    if want_rows and want_cols:
        return want_rows, want_cols
    if want_rows:
        return want_rows, max(1, math.ceil(count / want_rows))
    if want_cols:
        return max(1, math.ceil(count / want_cols)), want_cols

    if count in _KNOWN_BOARDS:
        return _KNOWN_BOARDS[count]

    # Small displays are physically one row.  Larger unknown counts aim for a
    # wide banner-like frame instead of defaulting to a 15-column canvas.
    if count <= 12:
        return 1, count
    frame_rows = max(1, round(math.sqrt(count / 4)))
    frame_cols = max(1, math.ceil(count / frame_rows))
    return frame_rows, frame_cols


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


def unknown_characters(
    char_by_id: Mapping[str, object],
    drums: Mapping[str, str | Sequence[str] | None],
) -> dict[str, list[str]]:
    """Return characters that the target module's drum cannot show.

    Modules whose drum is unknown (empty or not reported) are skipped: there
    is nothing to validate against, and rejecting them would break boards
    whose firmware does not publish a ``flap_list``.  Blank characters are
    ignored because centring and padding add spaces that are not meant to be
    visible flaps.
    """

    missing: dict[str, list[str]] = {}
    for module_id, char in char_by_id.items():
        drum = drums.get(module_id)
        if not drum:
            continue
        value = str(char or " ")[:1] or " "
        if value == " ":
            continue
        if _flap_index(value, drum) is not None:
            continue
        chars = missing.setdefault(str(module_id), [])
        if value not in chars:
            chars.append(value)
    return missing


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
    worst_fraction = 0.0
    for module_id, target_char in target.items():
        drum = drums.get(module_id) or DEFAULT_DRUM
        length = len(list(drum))
        if length <= 0:
            continue
        target_index = _flap_index(target_char, drum)
        if target_index is None:
            continue
        previous_char = previous.get(module_id)
        previous_index = _flap_index(previous_char, drum)
        if previous_index is None:
            distance = length
        else:
            distance = (target_index - previous_index) % length
        # Each module may have a different drum length, so compare the
        # fraction of a revolution rather than raw flap counts.
        worst_fraction = max(worst_fraction, distance / length)

    seconds = worst_fraction * seconds_per_revolution
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
        "c": "#00bcd4",
        "m": "#e91e63",
    }.get(char)


def flatten_lines(lines: Iterable[str]) -> str:
    """Join board lines into the single string sent to the master."""

    return "".join(lines)
