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
| Clock | 1 × 2 |
| Date | 3 × 11 |
| Dashboard | 3 × 11 |
| Weather | 3 × 10 |
| Stocks | 3 × 7 |
| Countdown | 3 × 12 |

The clock's `full`, `time`, and `date` modes still need 3 × 9. On a smaller
frame the clock automatically shows its two-digit `minutes` mode instead.

- Text pages and colour animations work on any valid layout, including one module.
- If the layout itself is invalid, only apps with both minimums at `1` stay
  available.
- Unsupported cards are disabled with the reason; starting one from the panel or
  a service raises `ValueError`.
- If a running app becomes unsupported because the layout changed, the engine
  stops it.

## Debug override

The display setting `debug_ignore_module_limit` is intended for development with
an incomplete board. When enabled:

- the configured `rows`/`cols` frame (or `row_counts`) is used even if fewer
  modules are detected;
- module-count mismatch, capacity, and blank-cell checks are skipped;
- app size requirements are ignored, so every app card is startable;
- cells whose slot has no detected module are rendered in the preview but are
  omitted from the published module list and send order;
- the Tuning hardware grid packs only the modules that answered the scan, so
  the larger test canvas does not hide them.

Structural configuration errors still apply. The panel shows a **DEBUG** badge
while the switch is on. Disable it before normal use.

## Offline module simulator

The display setting `debug_simulate_modules` (`0`–`255`, default `0`) is a
stronger development aid. A non-zero value always overrides the detected count,
even when the master reports real modules. The integration builds virtual module
IDs `1…N` and resolves the frame the same way as for real hardware: `45` gives
`3 × 15`, `100` gives `5 × 20`, and `row_counts` still controls short rows. App
providers are checked against that simulated frame, so large-board apps can be
developed with only a couple of physical modules.

While simulation is active:

- the panel shows a **SIM N** badge and renders the virtual board;
- every MQTT command is suppressed at the coordinator's single publish seam,
  so no module moves, scans, calibrates, or flashes;
- scan, sync, update, calibration, home/record, firmware and master firmware
  commands fail with a simulation notice;
- live status payloads are ignored, and the last real module state is restored
  when the setting returns to `0`.

The existing `debug_ignore_module_limit` switch is independent: leave it on if
you also want every app card enabled regardless of the simulated board size.
Set `rows`, `cols`, or `row_counts` when the automatic frame is not the one you
want to test.

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
