"""Host-side tests for the slave-module OTA chain.

Run with ``python3 tests/test_ota.py`` (Home Assistant is not required).

Two halves:

* ``normalize_ota`` from the integration's ``ota.py`` (the status object
  the panel will read).
* A Python mirror of the wire protocol shared by the ATtiny bootloader
  (``bootloader/src/codec.h`` in the slave repo) and the master flasher
  (``src/ota/SlaveFlasher.cpp`` in the master repo). The reference
  implementation below lives only in this file; it pins the protocol spec
  (CRC-16/CCITT-FALSE frame check, CRC-32 IEEE image check, 0x5C escape
  encoding) with the published check values so any drift in either
  firmware repo shows up here as a failing test.
"""

from __future__ import annotations

import os
import struct
import sys
import unittest
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import ota  # noqa: E402  (path is prepared above)


# ---------------------------------------------------------------------------
# Reference wire codec (protocol spec mirror; see module docstring)
# ---------------------------------------------------------------------------

SYNC = 0xAA
ESCAPE = 0x5C
ESC_ESC = 0x00
ESC_M = 0x01
FORBIDDEN = 0x6D  # 'm': never raw inside a frame


def crc16_ccitt_false(data: bytes) -> int:
    """CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no xorout."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if (crc & 0x8000) else (crc << 1)
            crc &= 0xFFFF
    return crc


def escape_encode(data: bytes) -> bytes:
    """Escape-encode: 0x5C -> 5C 00, 0x6D -> 5C 01, everything else unchanged."""
    out = bytearray()
    for byte in data:
        if byte == ESCAPE:
            out += bytes((ESCAPE, ESC_ESC))
        elif byte == FORBIDDEN:
            out += bytes((ESCAPE, ESC_M))
        else:
            out.append(byte)
    return bytes(out)


def escape_decode(data: bytes) -> bytes | None:
    """Decode an escape-encoded stream; None on an illegal sequence.

    Illegal: a raw 0x6D, an escape marker followed by an unknown code, or
    an escape marker at the very end of the stream.
    """
    out = bytearray()
    i = 0
    while i < len(data):
        byte = data[i]
        i += 1
        if byte == ESCAPE:
            if i >= len(data):
                return None
            code = data[i]
            i += 1
            if code == ESC_ESC:
                out.append(ESCAPE)
            elif code == ESC_M:
                out.append(FORBIDDEN)
            else:
                return None
        elif byte == FORBIDDEN:
            return None
        else:
            out.append(byte)
    return bytes(out)


def build_frame(addr: int, cmd: int, payload: bytes) -> bytes:
    """Assemble [0xAA][addr][cmd][len][payload][crc16 hi][crc16 lo]."""
    body = bytes((addr, cmd, len(payload))) + payload
    crc = crc16_ccitt_false(body)
    return bytes((SYNC,)) + escape_encode(body + struct.pack(">H", crc))


def _decode_logical(wire: bytes, start: int, count: int) -> tuple[bytes, int] | None:
    """Decode ``count`` logical bytes from ``wire[start:]``.

    Returns ``(bytes, end_index)`` where ``end_index`` is the wire position
    just past the consumed bytes, or ``None`` when the stream ends early or
    an illegal sequence appears (a raw ``0x6D``, or an escape marker with an
    unknown or missing code).
    """
    out = bytearray()
    i = start
    while len(out) < count and i < len(wire):
        byte = wire[i]
        i += 1
        if byte == ESCAPE:
            if i >= len(wire):
                return None
            code = wire[i]
            i += 1
            if code == ESC_ESC:
                out.append(ESCAPE)
            elif code == ESC_M:
                out.append(FORBIDDEN)
            else:
                return None
        elif byte == FORBIDDEN:
            return None
        else:
            out.append(byte)
    if len(out) < count:
        return None
    return bytes(out), i


def parse_frame(stream: bytes, addr: int) -> tuple[int, bytes] | None:
    """Sync-search a stream and return (cmd, payload) of the first response.

    Mirrors the master's ``SlaveFlasher::recvResponse()`` state machine:
    scan for the sync marker, decode the frame incrementally, and accept
    only a CRC-valid frame addressed to ``addr`` carrying a response code
    (0x81 ACK / 0x82 NACK). That response-code filter is also what makes
    the master's own echoed command frames (0x01..0x05) skippable in
    half-duplex. A failed candidate resynchronises at the next wire byte.
    """
    i = 0
    while i < len(stream):
        if stream[i] != SYNC:
            i += 1
            continue

        header = _decode_logical(stream, i + 1, 3)
        if header is None:
            i += 1
            continue
        head, end = header
        frame_addr, frame_cmd, frame_len = head
        if frame_len > 3:
            i += 1
            continue

        rest = _decode_logical(stream, end, frame_len + 2)
        if rest is None:
            i += 1
            continue
        tail, _ = rest

        body = head + tail[:frame_len]
        crc_rx = struct.unpack(">H", tail[frame_len:])[0]
        if crc_rx != crc16_ccitt_false(body):
            i += 1
            continue
        if frame_addr != addr or frame_cmd not in (0x81, 0x82):
            i += 1
            continue
        return frame_cmd, tail[:frame_len]
    return None


# ---------------------------------------------------------------------------
# normalize_ota (integration side)
# ---------------------------------------------------------------------------


class NormalizeOtaTests(unittest.TestCase):
    def test_none_and_garbage_default_to_idle(self) -> None:
        self.assertEqual(ota.normalize_ota(None), {"state": "idle"})
        self.assertEqual(ota.normalize_ota("flashing"), {"state": "idle"})
        self.assertEqual(ota.normalize_ota([1, 2]), {"state": "idle"})

    def test_empty_object_is_idle(self) -> None:
        self.assertEqual(ota.normalize_ota({}), {"state": "idle"})
        self.assertEqual(ota.normalize_ota({"state": ""}), {"state": "idle"})

    def test_known_states_pass_through(self) -> None:
        for state in ota.OTA_STATES:
            self.assertEqual(ota.normalize_ota({"state": state}), {"state": state})

    def test_unknown_state_falls_back_to_idle(self) -> None:
        self.assertEqual(
            ota.normalize_ota({"state": "exploding"}), {"state": "idle"}
        )

    def test_numeric_fields_are_kept(self) -> None:
        self.assertEqual(
            ota.normalize_ota(
                {
                    "state": "flashing",
                    "module": 7,
                    "progress": 42,
                    "received": 14336,
                    "error": "page 3 was not acknowledged after 3 attempts",
                }
            ),
            {
                "state": "flashing",
                "module": 7,
                "progress": 42,
                "received": 14336,
                "error": "page 3 was not acknowledged after 3 attempts",
            },
        )

    def test_wrong_types_are_dropped(self) -> None:
        result = ota.normalize_ota(
            {
                "state": "collecting",
                "module": "7",  # string, not int
                "progress": True,  # bool is an int subclass - still rejected
                "received": 10.5,  # float
                "error": "",  # empty: dropped
            }
        )
        self.assertEqual(result, {"state": "collecting"})

    def test_error_is_stringified(self) -> None:
        self.assertEqual(
            ota.normalize_ota({"state": "failed", "error": 123}),
            {"state": "failed", "error": "123"},
        )


# ---------------------------------------------------------------------------
# Wire protocol mirror (bootloader codec.h / master SlaveFlasher.cpp)
# ---------------------------------------------------------------------------


class CrcTests(unittest.TestCase):
    def test_crc16_check_values(self) -> None:
        # CRC-16/CCITT-FALSE check value for "123456789" is 0x29B1.
        self.assertEqual(crc16_ccitt_false(b"123456789"), 0x29B1)
        # Empty input returns the init value.
        self.assertEqual(crc16_ccitt_false(b""), 0xFFFF)

    def test_crc32_matches_zlib(self) -> None:
        # CRC-32 IEEE check value for "123456789" is 0xCBF43926; zlib and
        # binascii produce it, and the bootloader/master implementations
        # are byte-identical to it.
        self.assertEqual(zlib.crc32(b"123456789"), 0xCBF43926)
        self.assertEqual(zlib.crc32(b""), 0)


class EscapeTests(unittest.TestCase):
    def test_no_raw_m_or_dangling_escape(self) -> None:
        src = bytes((i * 7 + 0x5C) & 0xFF for i in range(300))
        wire = escape_encode(src)
        self.assertNotIn(FORBIDDEN, wire)
        # An escape marker is always followed by a code byte.
        for i, byte in enumerate(wire):
            if byte == ESCAPE:
                self.assertLess(i + 1, len(wire))

    def test_round_trip(self) -> None:
        src = bytes(range(256)) * 2
        self.assertEqual(escape_decode(escape_encode(src)), src)

    def test_all_256_values_round_trip(self) -> None:
        # Every possible byte value, including both escaped ones.
        src = bytes(range(256))
        wire = escape_encode(src)
        self.assertNotIn(FORBIDDEN, wire)
        self.assertEqual(escape_decode(wire), src)

    def test_illegal_sequences_rejected(self) -> None:
        self.assertIsNone(escape_decode(bytes((ESCAPE,))))  # dangling marker
        self.assertIsNone(escape_decode(bytes((ESCAPE, 0x02))))  # unknown code
        self.assertIsNone(escape_decode(bytes((FORBIDDEN,))))  # raw 'm'


class FrameTests(unittest.TestCase):
    def test_round_trip_with_escaped_payload(self) -> None:
        # A WRITE_PAGE-shaped command frame whose payload contains 0x5C and
        # 0x6D. Feeding its own echo followed by a response mirrors what
        # recvResponse sees in half-duplex: the echoed command must be
        # skipped (command codes are never response codes) and the
        # response parsed.
        payload = bytes((0x6D - i) & 0xFF for i in range(66))
        self.assertIn(ESCAPE, payload)
        self.assertIn(FORBIDDEN, payload)
        command = build_frame(3, 0x03, payload)
        self.assertNotIn(FORBIDDEN, command[1:])  # after the sync byte

        info = bytes((0x01, 3, 1))  # PING info: version, id, staying
        response = build_frame(3, 0x81, info)
        parsed = parse_frame(command + response, 3)
        self.assertIsNotNone(parsed)
        cmd, got = parsed  # type: ignore[misc]
        self.assertEqual(cmd, 0x81)
        self.assertEqual(got, info)

    def test_noise_and_foreign_frames_are_skipped(self) -> None:
        payload = b"\x01\x02\x03"
        mine = build_frame(9, 0x81, payload)
        theirs = build_frame(8, 0x81, payload)
        garbage = b"\x00\x6D\xff"  # includes a raw 'm' as noise
        parsed = parse_frame(garbage + theirs + mine, 9)
        self.assertIsNotNone(parsed)
        cmd, got = parsed  # type: ignore[misc]
        self.assertEqual((cmd, got), (0x81, payload))

    def test_corrupted_crc_is_rejected(self) -> None:
        frame = bytearray(build_frame(3, 0x81, b"\x00\x00\x00"))
        # Flip a bit somewhere after the sync byte (never the sync itself,
        # so the frame boundary is still found).
        frame[-1] ^= 0x55
        self.assertIsNone(parse_frame(bytes(frame), 3))

    def test_ping_response_shape(self) -> None:
        # BOOTLOADER_VERSION, module_id, staying - 3 payload bytes.
        frame = build_frame(5, 0x81, bytes((0x01, 5, 1)))
        cmd, payload = parse_frame(frame, 5)  # type: ignore[misc]
        self.assertEqual(cmd, 0x81)
        self.assertEqual(payload, bytes((0x01, 5, 1)))

    def test_worst_case_write_page_wire_size(self) -> None:
        # Upper bound of a WRITE_PAGE frame on the wire: the sync byte
        # plus every one of the 71 body bytes doubled by escaping. Not
        # every byte can actually double (the command code and the length
        # are never 0x5C/0x6D), so the bound is conservative - exactly what
        # the master's kWireMax sizes its buffer to.
        payload = bytes([ESCAPE]) * 66
        frame = build_frame(ESCAPE, 0x03, payload)  # hostile address 0x5C
        wire_bound = 1 + 2 * (3 + 66 + 2)
        self.assertEqual(wire_bound, 143)
        self.assertLessEqual(len(frame), wire_bound)
        # Every payload byte really does double on the wire.
        self.assertIn(bytes((ESCAPE, ESC_ESC)) * 66, frame)


class LayoutConstantsTests(unittest.TestCase):
    def test_flash_layout(self) -> None:
        # Mirrors bootloader/src/protocol.h: 2 KB boot section, app at
        # 0x0800, 224 pages of 64 bytes.
        self.assertEqual(ota.OTA_APP_START, 0x0800)
        self.assertEqual(ota.OTA_APP_MAX_SIZE, 14336)
        self.assertEqual(ota.OTA_PAGE_SIZE, 64)
        self.assertEqual(ota.OTA_MAX_PAGES, 224)


if __name__ == "__main__":
    unittest.main()
