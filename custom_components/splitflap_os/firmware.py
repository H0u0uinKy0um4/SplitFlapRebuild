"""Validate and load a slave application image for the OTA chain.

The master expects the *raw application region* of the slave's
``ATtiny1616_OTA`` build: the bytes as linked at ``0x0800``, with gaps
filled with ``0xFF``. PlatformIO/``avr-objcopy`` emit that as an Intel HEX
file, so the panel hands the file's text to the integration and the
address arithmetic happens here instead of in the browser.

Kept free of Home Assistant imports so ``tests/test_ota.py`` can exercise
it directly.
"""

from __future__ import annotations

import zlib
from typing import Final

try:  # package import (Home Assistant)
    from .ota import OTA_APP_MAX_SIZE, OTA_APP_START
except ImportError:  # direct import in the host tests (component dir on sys.path)
    from ota import OTA_APP_MAX_SIZE, OTA_APP_START

_HEX_DIGITS: Final = frozenset("0123456789abcdefABCDEF")

#: Maximum accepted .hex text: the application region is at most 14 KB, so
#: even a hex file with generous padding stays far below this.
MAX_HEX_CHARS: Final = 512 * 1024


class FirmwareImageError(ValueError):
    """The supplied file is not a usable slave application image."""


def _parse_records(text: str) -> dict[int, int]:
    """Return ``{address: byte}`` parsed from Intel HEX text."""

    if not isinstance(text, str) or not text.strip():
        raise FirmwareImageError("the firmware file is empty")
    if len(text) > MAX_HEX_CHARS:
        raise FirmwareImageError("the firmware file is too large to be a slave image")

    memory: dict[int, int] = {}
    base = 0
    seen_eof = False

    for number, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line:
            continue
        if not line.startswith(":"):
            raise FirmwareImageError(f"line {number}: not an Intel HEX record")
        body = line[1:]
        if len(body) < 10 or len(body) % 2:
            raise FirmwareImageError(f"line {number}: truncated HEX record")
        if not set(body) <= _HEX_DIGITS:
            raise FirmwareImageError(f"line {number}: invalid HEX character")
        record = bytes.fromhex(body)
        if sum(record) & 0xFF:
            raise FirmwareImageError(f"line {number}: HEX checksum mismatch")
        count = record[0]
        if len(record) != count + 5:
            raise FirmwareImageError(f"line {number}: byte count does not match the record")
        offset = (record[1] << 8) | record[2]
        kind = record[3]
        data = record[4 : 4 + count]

        if kind == 0x00:
            address = base + offset
            for index, value in enumerate(data):
                memory[address + index] = value
        elif kind == 0x01:
            seen_eof = True
            break
        elif kind == 0x02:
            if count != 2:
                raise FirmwareImageError(f"line {number}: invalid extended segment address")
            base = (((data[0] << 8) | data[1]) << 4)
        elif kind == 0x04:
            if count != 2:
                raise FirmwareImageError(f"line {number}: invalid extended linear address")
            base = ((data[0] << 8) | data[1]) << 16
        # 0x03 (start segment) and 0x05 (start linear) carry no data; ignore.

    if not seen_eof:
        raise FirmwareImageError("the HEX file has no end-of-file record (truncated upload?)")
    if not memory:
        raise FirmwareImageError("the HEX file contains no data records")
    return memory


def image_from_hex(text: str) -> bytes:
    """Return the application image of an ``ATtiny1616_OTA`` ``firmware.hex``.

    The image starts at the bootloader's ``OTA_APP_START`` (``0x0800``) — a
    plain ``ATtiny1616`` build linked at ``0x0000`` is refused, because the
    master and the bootloader cannot detect that mistake from raw bytes.
    Unwritten addresses inside the image become ``0xFF`` (erased flash), so
    the bytes are exactly what a full-region write needs.
    """

    memory = _parse_records(text)
    start = min(memory)
    end = max(memory) + 1
    size = end - start

    if start != OTA_APP_START:
        raise FirmwareImageError(
            f"the image starts at 0x{start:04X}, expected the application "
            f"region at 0x{OTA_APP_START:04X} (use the ATtiny1616_OTA build)"
        )
    if size > OTA_APP_MAX_SIZE:
        raise FirmwareImageError(
            f"the image is {size} bytes, larger than the {OTA_APP_MAX_SIZE}-byte "
            "application region"
        )
    # No page rounding here: the master pads the tail page for the write but
    # hashes exactly these bytes, and the bootloader re-hashes the same
    # session size after FINISH.
    image = bytearray(b"\xff" * (end - start))
    for address, value in memory.items():
        image[address - start] = value
    return bytes(image)


def image_crc32(image: bytes) -> str:
    """Return the CRC-32 IEEE of ``image`` as the master reports it."""
    return f"{zlib.crc32(image) & 0xFFFFFFFF:08X}"
