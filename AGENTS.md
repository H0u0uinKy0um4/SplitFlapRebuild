# Agent notes — Split-Flap OS

## What this repository is

A Home Assistant custom integration (`custom_components/splitflap_os`) plus a
sidebar panel, built fresh to replace the older `splitflap` integration. The
root `app.py` and `index.html` are AdamGMakes' original reference implementation
and must not be treated as production code or deleted.

## Hard constraints

- Home Assistant is **not installed** in this environment. Validate with
  `py_compile`, `node --check`, JSON parsing, and `tests/test_layout.py`.
- Only one config entry is allowed; the firmware is a single master.
- MQTT topics are fixed relative to a configurable prefix:
  `<prefix>/status` and
  `<prefix>/command/{display,sync,scan,update,calibrate,firmware}`. The
  `firmware` topic carries the slave-module OTA control messages (JSON
  actions `begin`/`chunk`/`flash`/`cancel`/`reset`; see the master repo's
  `include/ota/SlaveFlasher.h`); the master owns the binary framing to the
  modules, this side only publishes base64 image chunks.
- The master's `display` command is an array whose order is the send order.
- Board characters are one character per module. The stock drum is 64 flaps
  (`layout.DEFAULT_DRUM`); lower-case `roygbpw` are physical colour flaps.
- The physical layout is defined by `row_counts` (one module count per row,
  e.g. `3,3,1`) plus the `rows`/`cols` frame size. Module IDs are assigned
  left-to-right, top-to-bottom; short rows are centred. A layout may leave at
  most one row's worth of blank frame cells.
- `layout.py` and `positions.py` must stay free of Home Assistant imports so
  they can be unit tested. `resolve_layout()` is the single mapping from the
  detected count and settings to physical cells.
- Apps declare `min_rows` and `min_cols`. Support is checked against the frame
  rows and the narrowest row, so a ragged layout disables data apps. Unsupported
  starts raise `ValueError`; the panel shows disabled cards.
- The panel is vanilla JS loaded as an ES module through `panel_custom`. No build
  step, no external dependencies.
- **Frontend Cache Busting & Version Bump Rule**: Whenever modifying frontend files
  (`frontend/*.js`, `styles.js`, `i18n/*.js`, `panel/*.js`), **ALWAYS bump the version
  in lockstep across all files** to bust Home Assistant / browser Service Worker caches:
  1. `custom_components/splitflap_os/manifest.json` (`"version": "<NEW_VERSION>"`)
  2. `custom_components/splitflap_os/const.py` (`VERSION: Final = "<NEW_VERSION>"`)
  3. `custom_components/splitflap_os/frontend/constants.js` (`export const VERSION = "<NEW_VERSION>";`)
  4. All ES module import query parameters (`?v=<NEW_VERSION>`) in:
     - `frontend/splitflap-os-panel.js` (entry point — NEVER forget this file!)
     - `frontend/panel/render.js`
     - `frontend/panel/core.js`
     - `frontend/panel/actions.js`
     - `frontend/i18n/index.js`
  Never leave stale `?v=...` version parameters in any import, or the browser will
  serve stale cached modules.
- Preserve the old `/home/iuarchbtw/GIT_Personal/HASC/SplitFlap` repository.
- All user-facing UI text must be implemented in **English and Czech**. For the
  panel, add strings to `PANEL_I18N`/`SETTINGS_I18N` in
  `frontend/splitflap-os-panel.js` and use `_t()`/language-aware helpers (never
  hardcode user-visible text in one language). For Home Assistant config/options,
  services, and entity names, keep `strings.json`, `translations/en.json`, and
  `translations/cs.json` in sync (same keys/fields) and use `translation_key`
  where applicable. When adding new UI or messages, update both languages in the
  same change.

## Versioning (two compatibility axes)

The canonical procedure lives in the slave repo's `docs/VERSIONING.md`. Do not
invent a new scheme; follow it.

- `BUS_COMPAT` covers the slave <-> master side (RS485 app protocol + OTA entry
  contract). It lives in the slave's `FW_BUS_COMPAT` and the master's
  `MASTER_BUS_COMPAT`.
- `MQTT_COMPAT` covers the master <-> Home Assistant side (MQTT status/command
  JSON schema). It lives in the master's `MASTER_MQTT_COMPAT` and this repo's
  `MQTT_COMPAT` in `const.py`.
- Published strings are composed from the axes that apply:
  - slave: `<bus>.<release>` (for example `1.0.1`)
  - master: `<bus>.<mqtt>.<release>` (for example `1.1.0.0`)
  - HA: `<mqtt>.<release>` (for example `1.0.2`)
- The OTA bootloader protocol is a **third, separate** number:
  `OTA_PROTOCOL_VERSION` (master) must equal `BOOTLOADER_VERSION` (slave
  `bootloader/src/protocol.h`). Never fold it into either compat axis.

Bump only what the change actually breaks:

| Change | Bump |
| --- | --- |
| Bug fix, UI, new optional field, new command | release only |
| RS485 command/reply shape, module-id rules, OTA entry contract | `FW_BUS_COMPAT` + `MASTER_BUS_COMPAT` |
| MQTT JSON field/action removal or rename, panel snapshot shape | `MASTER_MQTT_COMPAT` + `MQTT_COMPAT` |
| Bootloader framing, commands, CRC, boot policy | `OTA_PROTOCOL_VERSION` + `BOOTLOADER_VERSION` |

For Home Assistant specifically:

1. `VERSION` in `const.py` must always have its major number equal to
   `MQTT_COMPAT`; `tests/test_versions.py` enforces this.
2. Any frontend edit also requires the lockstep bump in the rule above
   (`manifest.json`, `const.py`, `frontend/constants.js`, every `?v=` import).
3. Read the master's `mqtt_compat` (fall back to the older `compat` alias) to
   decide compatibility. The master's bus generation is diagnostic only.
4. When a version changes, update `README.md`, `README.cs.md`, the matrix in the
   slave's `docs/VERSIONING.md`, and any status-payload examples in the same
   change.

## Important architecture

- `coordinator.py` owns MQTT, normalization, persistence, and publishing.
  `engine.py` owns the display loop, apps, playlists, settings, and backup.
  The panel subscribes to one dispatcher signal (`const.signal_update`).
- `websocket_api.py` is the panel's only control surface. Services are exposed
  separately for automations. Both find the runtime through `runtime.py`.
- `engine.snapshot()` is the panel's state contract. If you add a field the panel
  needs, add it there.
- Entities live on the same dispatcher signal; they do not poll.
- Settings/playlists live in an engine `Store`; the module snapshot and desired
  characters live in a coordinator `Store`. `async_remove_entry` removes both.
- The panel checks `engine.settings_groups` (each group carries a `category`
  of `display` or `apps` that routes it to a settings sub-tab), `engine.apps`,
  `engine.saved_playlists`, and `engine.saved_drums`; keeping those shapes
  stable avoids frontend changes.
- App providers are `async def provider(engine, now) -> list[Page] | Page | None`.
  Register them in `apps/__init__.py`.

## Known firmware bugs / caveats

- Slave moves are **blocking**. The master defers the post-move refresh by
  `MOVE_SETTLE_MS` (5 s); do not query a module immediately after
  `goto`/`home`/`step`/`apply` or it will look offline.
- Master publishes `busy: false` unconditionally because moves are blocking.
  `position_known` is now the real slave flag, but only trust it while the
  module is online.
- Position is open loop between homes on deployed slave firmware; there is no
  per-step hall correction. Slave firmware with mid-move hall re-referencing
  (see the slave repo's PROTOCOL.md, "Motion") zeroes `pos` on the hall
  entering edge during any move that crosses the magnet and recomputes the
  remaining distance, so drift cannot survive a magnet crossing. Re-home after
  mechanical changes or a wrong revolution count either way.
- Recording index `0` is supported and redefines `homeOffset` on the slave. The
  old destructive `m<id>w0:0` compatibility write has been removed.
- `module["flap"]` is the master's best knowledge, not a true readback: when
  the module reports `position_known`, the master derives the real flap from
  the position map (or the slave's linear formula) and publishes that plus
  `current_index`; otherwise it falls back to the last requested character.
  On deployed (old) slave firmware the open-loop position can drift, so
  `position_known` is only trustworthy with the mid-move hall re-referencing
  slave firmware. The coordinator keeps `actual_flap` and `desired_flap`
  separate for the UI.
- Drums are exactly 64 characters. Shorter overrides are rejected instead of
  being space-padded, and line breaks are rejected because they would terminate
  the RS485 command.

## Validation commands

```bash
python3 -m py_compile custom_components/splitflap_os/*.py \
  custom_components/splitflap_os/apps/*.py
for f in $(find custom_components/splitflap_os/frontend -name '*.js'); do node --check "$f"; done
python3 -m json.tool custom_components/splitflap_os/manifest.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/strings.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/translations/en.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/translations/cs.json >/dev/null
python3 tests/test_layout.py
python3 tests/test_positions.py
python3 tests/test_translations.py
python3 tests/test_ota.py
python3 tests/test_versions.py
```

## Style

- Keep Python typed and `from __future__ import annotations`.
- Avoid new dependencies.
- Panel HTML is assembled with escaped values (`escapeHtml`/`escapeAttr`).
  Preserve escaping whenever adding dynamic markup.
- The panel intentionally avoids re-rendering static inputs while they are
  focused; `_settingsDirty` and `_inspectorModule` exist for that reason.
