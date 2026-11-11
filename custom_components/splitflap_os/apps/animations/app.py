"""Colour animations, generated as complete raw frames."""

from __future__ import annotations

import random
from datetime import datetime

from ...layout import COLOR_CODES
from ...models import Page
from ..common import as_float


def _rainbow(rows: int, cols: int) -> list[str]:
    pages: list[str] = []
    for offset in range(len(COLOR_CODES)):
        board = "".join(
            COLOR_CODES[(column + row + offset) % len(COLOR_CODES)]
            for row in range(rows)
            for column in range(cols)
        )
        pages.append(board)
    return pages


def _sweep(rows: int, cols: int) -> list[str]:
    pages: list[str] = []
    steps = list(range(1, cols + 1)) + list(range(cols - 1, 0, -1))
    for step in steps:
        colour = COLOR_CODES[step % len(COLOR_CODES)]
        board = "".join(
            colour if column < step else " "
            for _row in range(rows)
            for column in range(cols)
        )
        pages.append(board)
    return pages


def _checker(rows: int, cols: int) -> list[str]:
    pages: list[str] = []
    pairs = [
        ("r", "b"),
        ("o", "p"),
        ("y", "g"),
        ("r", "w"),
        ("g", "b"),
    ]
    for first, second in pairs:
        for flip in (0, 1):
            board = "".join(
                (first if (row + column + flip) % 2 == 0 else second)
                for row in range(rows)
                for column in range(cols)
            )
            pages.append(board)
    return pages


def _twinkle(rows: int, cols: int, count: int = 12) -> list[str]:
    palette = COLOR_CODES + "     "
    return [
        "".join(random.choice(palette) for _ in range(rows * cols))
        for _ in range(count)
    ]


async def fetch(ctx, now: datetime) -> list[Page]:
    rows, cols = ctx.board
    effect = str(ctx.get_setting("anim_effect", "rainbow")).lower()
    style = str(ctx.get_setting("anim_style", "ltr"))
    speed = max(0.1, as_float(ctx.get_setting("anim_speed", "0.4"), 0.4))

    if effect in {"sweep", "wave"}:
        frames = _sweep(rows, cols)
    elif effect in {"checker", "checkerboard"}:
        frames = _checker(rows, cols)
    elif effect in {"twinkle", "sparkle"}:
        frames = _twinkle(rows, cols)
    else:
        frames = _rainbow(rows, cols)

    return [
        Page(
            frame,
            raw=True,
            resend=True,
            delay=speed,
            style=style,
        )
        for frame in frames
    ]
