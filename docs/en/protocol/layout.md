# Layout and geometry

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/layout.md)

The layout describes the real display, not just the number of modules. It decides
which module ID lands in which frame cell, and which apps can run.

## Board layout

```text
row_counts = 3,3,1     frame = 3 rows × 3 columns

row 1: module 1  module 2  module 3
row 2: module 4  module 5  module 6
row 3:          module 7
```

Rules:

- `row_counts` is one comma-separated module count per row, top to bottom.
- `rows` / `cols` are the frame dimensions; `0` means derive them.
- Module IDs are assigned left to right, then top to bottom.
- A short row is centred inside the frame.
- A layout may leave at most one row's worth of blank frame cells. 7 modules in a
  3×3 frame is valid; 7 modules in a 3×15 frame is rejected.
- A saved layout that does not match the detected module count is rejected and
  the panel shows the error instead of silently using the wrong modules.

## Automatic board size

When no explicit layout is set, `auto_board()` picks a frame from the detected
count:

| Modules | Frame | Modules | Frame |
| --- | --- | --- | --- |
| 24 | 2×12 | 45 | 3×15 |
| 30 | 2×15 | 48 | 4×12 |
| 32 | 2×16 | 50 | 5×10 |
| 36 | 3×12 | 54 | 3×18 |
| 40 | 4×10 | 56 | 4×14 |
| 42 | 3×14 | 60 | 4×15 |
| | | 64 | 4×16 |

- Up to 12 modules become a single row.
- Other counts use a wide banner-like frame derived from the count.
- Either dimension can be fixed by the user while the other stays automatic.

## App availability

Apps declare `min_rows` and `min_cols` in their manifest. Support is checked
against the frame height and the **narrowest row**, not the average width, so a
ragged layout such as `3,3,1` (narrowest row 1) disables data apps.

| App | Minimum frame |
| --- | --- |
| Animations | any size |
| Clock | 3 × 9 |
| Date | 3 × 11 |
| Dashboard | 3 × 11 |
| Weather | 3 × 10 |
| Stocks | 3 × 7 |
| Countdown | 3 × 12 |

- Text pages and colour animations work on any valid layout, including one module.
- If the layout itself is invalid, only apps with both minimums at `1` stay
  available.
- Unsupported cards are disabled with the reason; starting one from the panel or
  a service raises `ValueError`.
- If a running app becomes unsupported because the layout changed, the engine
  stops it.

## Coordinate system and position maps

- The slave counts `pos` from the hall entering edge.
- Flap `0` sits at `homeOffset`.
- When a map entry is missing, the fallback position is
  `homeOffset + round(index * totalStepsPerRev / 64)`, modulo `totalStepsPerRev`.
- The integration mirrors this formula when estimating a flap.
- `record` with `index: 0` stores the current position as `map[0]` and redefines
  `homeOffset`.
- `0xFFFF` means "unset". The integration omits these entries and never shows them
  as tuned. An explicit `65535` in a `calibrate` `positions` object clears that
  single entry on the slave.
- Negative or out-of-range entries are ignored.

Position is open loop between homes on deployed slave firmware. Firmware with
mid-move hall re-referencing zeroes `pos` on the hall entering edge during any
move that crosses the magnet and recomputes the remaining distance, so drift
cannot survive a magnet crossing. Re-home after mechanical changes or after a
wrong revolution count either way.

## See also

- [Commands](commands.md#calibrate)
- [Panel and settings](../use/panel.md)
- [Writing an app](../apps/authoring.md#layout-requirements)
