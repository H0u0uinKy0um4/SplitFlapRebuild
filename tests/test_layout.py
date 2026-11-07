"""Pure-Python tests for the board layout helpers.

Run with ``python3 tests/test_layout.py`` (Home Assistant is not required).
"""

from __future__ import annotations

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENT_DIR = os.path.join(os.path.dirname(HERE), "custom_components", "splitflap_os")
sys.path.insert(0, COMPONENT_DIR)

import layout  # noqa: E402  (path is prepared above)


class NormalizeTextTests(unittest.TestCase):
    def test_uppercases_and_maps_quote(self) -> None:
        # The physical double-quote flap is addressed as lower-case ``q`` by
        # the firmware (see Adam's reference implementation).
        self.assertEqual(layout.normalize_text('hello "world"'), "HELLO qWORLDq")

    def test_maps_colour_emoji(self) -> None:
        self.assertEqual(layout.normalize_text("\U0001f7e5\U0001f7e6X"), "rbX")

    def test_raw_keeps_case(self) -> None:
        self.assertEqual(layout.normalize_text("aBc", raw=True), "aBc")

    def test_none_becomes_blank(self) -> None:
        self.assertEqual(layout.normalize_text(None), "")


class AutoBoardTests(unittest.TestCase):
    def test_known_sizes(self) -> None:
        self.assertEqual(layout.auto_board(45), (3, 15))
        self.assertEqual(layout.auto_board(64), (4, 16))

    def test_rows_override(self) -> None:
        self.assertEqual(layout.auto_board(45, rows=5), (5, 9))

    def test_columns_override(self) -> None:
        self.assertEqual(layout.auto_board(45, cols=20), (3, 20))

    def test_both_overrides(self) -> None:
        self.assertEqual(layout.auto_board(45, rows=2, cols=8), (2, 8))

    def test_unknown_count_is_wide(self) -> None:
        rows, cols = layout.auto_board(41)
        self.assertEqual(cols, 15)
        self.assertEqual(rows, 3)

    def test_zero_modules_still_has_a_board(self) -> None:
        rows, cols = layout.auto_board(0)
        self.assertGreaterEqual(rows, 1)
        self.assertGreaterEqual(cols, 1)


class FormattingTests(unittest.TestCase):
    def test_format_lines_centres_and_pads(self) -> None:
        lines = layout.format_lines(["HI"], rows=3, cols=5)
        self.assertEqual(lines, ["     ", "  HI ", "     "])

    def test_format_lines_truncates(self) -> None:
        lines = layout.format_lines(["ABCDEFGH"], rows=1, cols=4)
        self.assertEqual(lines, ["ABCD"])

    def test_wrap_lines_words(self) -> None:
        lines = layout.wrap_lines("one two three four", rows=3, cols=9)
        self.assertEqual(len(lines), 3)
        self.assertTrue(all(len(line) == 9 for line in lines))
        self.assertEqual("".join(lines).replace(" ", ""), "ONETWOTHREEFOUR")

    def test_wrap_lines_centres(self) -> None:
        lines = layout.wrap_lines("HELLO", rows=3, cols=5)
        self.assertEqual(lines, ["     ", "HELLO", "     "])

    def test_raw_is_not_reflowed(self) -> None:
        lines = layout.wrap_lines("aBcDeF", rows=2, cols=3, raw=True)
        self.assertEqual(lines, ["aBc", "DeF"])

    def test_compose_board_joins(self) -> None:
        lines, board = layout.compose_board("HI", rows=1, cols=4)
        self.assertEqual(board, "".join(lines))
        self.assertEqual(board, " HI ")


class OrderTests(unittest.TestCase):
    def test_ltr_is_identity(self) -> None:
        self.assertEqual(layout.order_indices("ltr", 2, 3), list(range(6)))

    def test_rtl_is_reversed(self) -> None:
        self.assertEqual(layout.order_indices("rtl", 2, 3), [5, 4, 3, 2, 1, 0])

    def test_columns(self) -> None:
        self.assertEqual(layout.order_indices("columns", 2, 3), [0, 3, 1, 4, 2, 5])

    def test_spiral_is_a_permutation(self) -> None:
        order = layout.order_indices("spiral", 4, 5)
        self.assertEqual(sorted(order), list(range(20)))

    def test_random_is_a_permutation(self) -> None:
        order = layout.order_indices("random", 4, 5)
        self.assertEqual(sorted(order), list(range(20)))

    def test_unknown_style_falls_back_to_ltr(self) -> None:
        self.assertEqual(layout.order_indices("nonsense", 2, 2), [0, 1, 2, 3])


class RotationTests(unittest.TestCase):
    def test_no_movement(self) -> None:
        drums = {"1": layout.DEFAULT_DRUM}
        self.assertEqual(
            layout.estimate_rotation_seconds({"1": "A"}, {"1": "A"}, drums), 0.0
        )

    def test_one_flap_moves_quickly(self) -> None:
        drums = {"1": layout.DEFAULT_DRUM}
        seconds = layout.estimate_rotation_seconds({"1": "A"}, {"1": "B"}, drums)
        self.assertGreater(seconds, 0)
        self.assertLess(seconds, 0.2)

    def test_wraps_forward_only(self) -> None:
        drums = {"1": "ABC"}
        seconds = layout.estimate_rotation_seconds({"1": "C"}, {"1": "A"}, drums)
        self.assertGreater(seconds, 0)

    def test_unknown_previous_charges_a_revolution(self) -> None:
        drums = {"1": layout.DEFAULT_DRUM}
        seconds = layout.estimate_rotation_seconds({}, {"1": "A"}, drums)
        self.assertAlmostEqual(seconds, 4.0, places=5)

    def test_maximum_is_capped(self) -> None:
        drums = {"1": layout.DEFAULT_DRUM}
        seconds = layout.estimate_rotation_seconds(
            {}, {"1": "A"}, drums, seconds_per_revolution=60, maximum=8
        )
        self.assertEqual(seconds, 8.0)


class MiscTests(unittest.TestCase):
    def test_split_csv(self) -> None:
        self.assertEqual(layout.split_csv(" a, b ,,c "), ["a", "b", "c"])
        self.assertEqual(layout.split_csv(None), [])

    def test_color_css(self) -> None:
        self.assertEqual(layout.color_css("r"), "#e53935")
        self.assertIsNone(layout.color_css("A"))

    def test_board_from_settings_alias(self) -> None:
        self.assertEqual(layout.board_from_settings(45, 0, 0), (3, 15))

    def test_flatten_lines(self) -> None:
        self.assertEqual(layout.flatten_lines(["AB", "CD"]), "ABCD")

    def test_default_drum_shape(self) -> None:
        self.assertEqual(layout.FLAP_COUNT, 64)
        self.assertEqual(layout.FLAP_COUNT, len(layout.DEFAULT_DRUM))
        self.assertEqual(layout.DEFAULT_DRUM[0], " ")
        self.assertTrue(set(layout.COLOR_CODES) <= set(layout.DEFAULT_DRUM))


if __name__ == "__main__":
    unittest.main(verbosity=2)
