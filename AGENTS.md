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
  `<prefix>/status` and `<prefix>/command/{display,sync,scan,update,calibrate}`.
- The master's `display` command is an array whose order is the send order.
- Board characters are one character per module. The stock drum is 64 flaps
  (`layout.DEFAULT_DRUM`); lower-case `roygbpw` are physical colour flaps.
- `layout.py` and `positions.py` must stay free of Home Assistant imports so
  they can be unit tested.
- The panel is vanilla JS loaded as an ES module through `panel_custom`. No build
  step, no external dependencies.
- Preserve the old `/home/iuarchbtw/GIT_Personal/HASC/SplitFlap` repository.

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
- The panel checks `engine.settings_groups`, `engine.apps`, and
  `engine.saved_playlists`; keeping those shapes stable avoids frontend changes.
- App providers are `async def provider(engine, now) -> list[Page] | Page | None`.
  Register them in `apps/__init__.py`.

## Known firmware bugs / caveats

- Master `calibrate` action `record` with index `0` also sends a destructive
  `m<id>w0:0` write. Documented in README; avoid relying on index 0 recording.
- Master publishes `busy: false` and `position_known: online` unconditionally.
  Do not build logic on those fields; use `current_step`, `home_offset`,
  `total_steps`, and explicit sync/refresh.
- `module["flap"]` may fall back to the master's `current_text`; the coordinator
  keeps `actual_flap` and `desired_flap` separate for the UI.

## Validation commands

```bash
python3 -m py_compile custom_components/splitflap_os/*.py \
  custom_components/splitflap_os/apps/*.py
node --check custom_components/splitflap_os/frontend/splitflap-os-panel.js
python3 -m json.tool custom_components/splitflap_os/manifest.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/strings.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/translations/en.json >/dev/null
python3 tests/test_layout.py
python3 tests/test_positions.py
```

## Style

- Keep Python typed and `from __future__ import annotations`.
- Avoid new dependencies.
- Panel HTML is assembled with escaped values (`escapeHtml`/`escapeAttr`).
  Preserve escaping whenever adding dynamic markup.
- The panel intentionally avoids re-rendering static inputs while they are
  focused; `_settingsDirty` and `_inspectorModule` exist for that reason.
