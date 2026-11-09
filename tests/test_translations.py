"""Translation parity checks for the Home Assistant JSON files.

Run with ``python3 tests/test_translations.py``.  Home Assistant is not needed;
the files are plain JSON.  The panel keeps its own dictionaries in
``frontend/splitflap-os-panel.js`` and mirrors the same key structure there.
"""

from __future__ import annotations

import json
import os
import unittest
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
FILES = {
    "strings.json": os.path.join(COMPONENT_DIR, "strings.json"),
    "en.json": os.path.join(COMPONENT_DIR, "translations", "en.json"),
    "cs.json": os.path.join(COMPONENT_DIR, "translations", "cs.json"),
}


def flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    """Return dotted leaf paths so two documents can be compared by shape."""

    out: dict[str, Any] = {}
    if isinstance(value, dict):
        for key, child in value.items():
            out.update(flatten(child, f"{prefix}.{key}" if prefix else key))
    else:
        out[prefix] = value
    return out


class TranslationParityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.documents = {}
        for name, path in FILES.items():
            with open(path, encoding="utf-8") as handle:
                self.documents[name] = flatten(json.load(handle))

    def test_all_files_have_the_same_keys(self) -> None:
        reference = set(self.documents["strings.json"])
        for name, document in self.documents.items():
            details = sorted(reference - set(document))
            extra = sorted(set(document) - reference)
            self.assertEqual(
                details,
                [],
                f"{name} is missing keys: {details}",
            )
            self.assertEqual(
                extra,
                [],
                f"{name} has extra keys: {extra}",
            )

    def test_every_service_field_has_a_name(self) -> None:
        for name, document in self.documents.items():
            for key, value in document.items():
                if ".services." in f".{key}" and key.endswith(".name"):
                    self.assertTrue(value, f"{name}: {key} is empty")

    def test_english_and_czech_have_no_empty_values(self) -> None:
        for name in ("en.json", "cs.json"):
            for key, value in self.documents[name].items():
                self.assertNotIn(
                    value,
                    (None, ""),
                    f"{name}: {key} is empty",
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
