"""Small data objects shared by the app engine and providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Page:
    """One frame/page to put on the display.

    ``text`` may contain newlines.  ``raw`` pages are complete animation
    frames: they are not upper-cased, wrapped or reflowed.
    """

    text: str = ""
    delay: float | None = None
    raw: bool = False
    style: str | None = None
    speed: int | None = None
    resend: bool = False
    start: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "delay": self.delay,
            "raw": self.raw,
            "style": self.style,
            "speed": self.speed,
            "resend": self.resend,
            "start": self.start,
        }

    @classmethod
    def from_dict(cls, data: Any) -> "Page":
        if isinstance(data, Page):
            return data
        if isinstance(data, str):
            return cls(text=data)
        if not isinstance(data, dict):
            return cls(text=str(data))

        def _float(value: Any, default: float | None = None) -> float | None:
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        def _int(value: Any, default: int | None = None) -> int | None:
            try:
                return int(value)
            except (TypeError, ValueError):
                return default

        delay = data.get("delay")
        speed = _int(data.get("speed"))
        start = _int(data.get("start"), 0) or 0
        return cls(
            text=str(data.get("text", "")),
            delay=_float(delay) if delay is not None else None,
            raw=bool(data.get("raw", False)),
            style=str(data["style"]) if data.get("style") else None,
            speed=speed,
            resend=bool(data.get("resend", False)),
            start=max(0, start),
        )
