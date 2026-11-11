"""Version lockstep checks for the Home Assistant integration.

Run with ``python3 tests/test_versions.py``.  Home Assistant is not needed: the
files are read as text and parsed with regular expressions.

The cross-repo version model (shared compatibility generation plus per-repo
release) is specified in the slave repository's ``docs/VERSIONING.md``.  This
test only enforces the local half of it: every Home Assistant file must carry
the same ``VERSION``, and its major number must equal ``COMPAT_VERSION``.
"""

from __future__ import annotations

import json
import os
import re
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
COMPONENT_DIR = HERE.parent / "custom_components" / "splitflap_os"
FRONTEND_DIR = COMPONENT_DIR / "frontend"

CONST_FILE = COMPONENT_DIR / "const.py"
MANIFEST_FILE = COMPONENT_DIR / "manifest.json"
CONSTANTS_FILE = FRONTEND_DIR / "constants.js"

# Every ES module import carries ``?v=<version>`` to bust the Home Assistant
# and browser caches.  A stale parameter serves an old module, so all of them
# must match the current version.
IMPORT_PATTERN = re.compile(r'"\.{1,2}/[^"\n]+?\?v=([^"\s]+)"')


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def const_version(text: str) -> str:
    match = re.search(r'^VERSION:\s*Final\s*=\s*"([^"]+)"', text, re.MULTILINE)
    if not match:
        raise AssertionError("const.py: VERSION: Final = \"...\" not found")
    return match.group(1)


def const_compat(text: str) -> int:
    match = re.search(r"^COMPAT_VERSION:\s*Final\s*=\s*(\d+)", text, re.MULTILINE)
    if not match:
        raise AssertionError("const.py: COMPAT_VERSION: Final = <int> not found")
    return int(match.group(1))


def manifest_version(text: str) -> str:
    return str(json.loads(text)["version"])


def constants_version(text: str) -> str:
    match = re.search(r'^export const VERSION = "([^"]+)";', text, re.MULTILINE)
    if not match:
        raise AssertionError("frontend/constants.js: export const VERSION not found")
    return match.group(1)


class VersionLockstepTests(unittest.TestCase):
    def setUp(self) -> None:
        self.const_text = read(CONST_FILE)
        self.version = const_version(self.const_text)
        self.compat = const_compat(self.const_text)

    def test_version_is_compatible_with_compat(self) -> None:
        match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", self.version)
        self.assertIsNotNone(
            match,
            f"VERSION {self.version!r} is not MAJOR.MINOR.PATCH",
        )
        major = int(match.group(1))
        self.assertEqual(
            major,
            self.compat,
            f"VERSION major {major} != COMPAT_VERSION {self.compat}",
        )

    def test_manifest_matches_const(self) -> None:
        self.assertEqual(manifest_version(read(MANIFEST_FILE)), self.version)

    def test_frontend_constants_match_const(self) -> None:
        self.assertEqual(constants_version(read(CONSTANTS_FILE)), self.version)

    def test_import_query_parameters_match_const(self) -> None:
        stale: list[str] = []
        for path in sorted(FRONTEND_DIR.rglob("*.js")):
            for line_number, line in enumerate(read(path).splitlines(), 1):
                for found in IMPORT_PATTERN.findall(line):
                    if found != self.version:
                        stale.append(f"{path.relative_to(HERE.parent)}:{line_number}: ?v={found}")
        self.assertEqual(stale, [], "stale ES module versions:\n" + "\n".join(stale))

    def test_compat_is_one_digit(self) -> None:
        # The slave EEPROM slot composes "<compat>.<release>" and is 8 bytes,
        # so a two-digit generation would no longer fit.
        self.assertTrue(1 <= self.compat <= 9, "COMPAT_VERSION must be 1..9")


if __name__ == "__main__":
    unittest.main(verbosity=2)
