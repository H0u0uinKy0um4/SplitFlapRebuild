"""Pure-Python tests for position-map normalization.

Run with ``python3 tests/test_positions.py`` (Home Assistant is not required).
"""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import positions  # noqa: E402  (path is prepared above)


class NormalizePositionMapTests(unittest.TestCase):
    def test_unset_sentinel_is_omitted(self) -> None:
        self.assertEqual(
            positions.normalize_position_map("0=2832,1=65535,2=0"),
            {"0": 2832, "2": 0},
        )

    def test_all_unset_returns_none(self) -> None:
        self.assertIsNone(positions.normalize_position_map("0=65535,1=65535"))

    def test_json_string(self) -> None:
        self.assertEqual(
            positions.normalize_position_map('{"0": 2832, "1": 65535}'),
            {"0": 2832},
        )

    def test_dict_values_are_coerced(self) -> None:
        self.assertEqual(
            positions.normalize_position_map({"0": "2832", "1": 65535}),
            {"0": 2832},
        )

    def test_nested_dict_value(self) -> None:
        self.assertEqual(
            positions.normalize_position_map({"0": {"position": 2832}}),
            {"0": 2832},
        )

    def test_list_and_nested_index(self) -> None:
        self.assertEqual(
            positions.normalize_position_map(
                [{"index": 0, "position": 2832}, {"index": 1, "position": 65535}]
            ),
            {"0": 2832},
        )

    def test_out_of_range_is_omitted(self) -> None:
        self.assertEqual(
            positions.normalize_position_map(
                {"0": -1, "1": 65536, "2": 3000, "3": "unknown"}
            ),
            {"2": 3000},
        )

    def test_empty_values(self) -> None:
        self.assertIsNone(positions.normalize_position_map(None))
        self.assertIsNone(positions.normalize_position_map(""))
        self.assertIsNone(positions.normalize_position_map({}))

    def test_constant(self) -> None:
        self.assertEqual(positions.POSITION_MAP_UNSET, 0xFFFF)


if __name__ == "__main__":
    unittest.main(verbosity=2)
