# Split-Flap OS

A Home Assistant custom integration for a split-flap display driven by the
ESP32-C3 RS485 **SplitFlap Master** firmware. It replaces the older `splitflap`
integration with a Home Assistant native app engine, a sidebar panel, and a
tuning/calibration workbench.

> 🇨🇿 Český návod pro začátečníky: [README.cs.md](README.cs.md).

The integration talks to the master over MQTT. The master keeps ownership of the
RS485 bus and the slave modules; Home Assistant owns text layout, apps, playlists,
auto-detected board geometry, tuning state, and persistence.

```
Home Assistant                         ESP32 master                 Slaves
┌───────────────────────────┐  MQTT    ┌──────────────┐   RS485     ┌────────┐
│ Split-Flap OS integration │ ───────> │ command/*    │ ──────────> │ module │
│ engine + apps + panel     │ <─────── │ status       │ <────────── │ module │
└───────────────────────────┘          └──────────────┘             └────────┘
```

## Features

- **Sidebar panel** (`Split-Flap OS`) with Control, Apps, Tuning, and Settings
  tabs, plus a live flap preview.
- **Board auto-detection**: module count comes from the master status payload.
  45 modules become 3×15 and 64 become 4×16. Small displays use a single row.
  The physical frame can be overridden with rows/columns and a per-row module
  layout such as `3,3,1`.
- **Physical layouts and app availability**: short rows are centred, module IDs
  are assigned in reading order, and data apps are disabled with a reason when
  every row is not wide enough.
- **Apps** rendered from Home Assistant data where possible:
  clock, date, dashboard, weather, stocks, crypto, NHL scores, MBTA transit,
  countdown, world clock, ISS position, and colour animations.
- **Playlists** with per-page text, loop control, and saved named playlists.
- **Animation send orders**: left-to-right, right-to-left, columns, centre-out,
  outside-in, diagonal, random, rain, and spiral.
- **Tuning UI** for module inspection, home, goto, relative steps, home offsets,
  EEPROM position maps, recording drum indexes, bus scan, sync, and refresh.
- **Entities and services** so automations can send text, launch apps, and run
  hardware actions without the panel.
- **Character validation**: text and playlists are checked against each
  module's reported `flap_list` before anything is sent; a missing flap raises
  an error naming the module and character.
- **Czech localization** of the setup/options flow, service names, and panel
  strings; entity names remain English.
- **Backup/restore** of settings, playlists, and the last module snapshot.
- Only one config entry is allowed, matching the single-master firmware.

## Requirements

- Home Assistant 2024.11 or newer.
- The MQTT integration configured and connected to the broker used by the master.
- SplitFlap Master firmware with these topics:
  - status: `<prefix>/status` (retained, JSON)
  - commands: `<prefix>/command/display`, `sync`, `scan`, `update`, `calibrate`
- The default prefix is `splitflap`. It is configurable during setup.

## Installation

### HACS (custom repository)

1. Add this repository as a HACS **Integration** custom repository.
2. Install **Split-Flap OS**.
3. Restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration → Split-Flap OS**.
5. Enter the MQTT topic prefix (`splitflap` by default) and a display name.

### Manual

Copy `custom_components/splitflap_os` into your Home Assistant
`config/custom_components/` directory and restart. Then add the integration from
the UI.

The sidebar panel is registered automatically; no Lovelace resource entry is
needed.

## Panel

- **Control** — live display, multi-line compose box, colour insert buttons,
  start column, send order, speed, playlist builder, and saved playlists.
- **Apps** — tap an app to start it; the gear opens the settings that app reads.
- **Tuning** — module matrix, per-module diagnostics, motor home/goto/step,
  record and position-map controls, and a clickable character map.
- **Settings** — grouped settings (display plus one group per app), hardware
  actions, backup/restore, and connection details.

The panel uses Home Assistant WebSocket commands and does not require a build
step. It is loaded from `frontend/splitflap-os-panel.js` through `panel_custom`.

## Entities

| Platform | Entity | Purpose |
| --- | --- | --- |
| sensor | Status | Master online/offline plus MQTT metadata |
| sensor | Module count | Number of detected modules |
| sensor | Display text | Last non-raw text shown |
| sensor | Active app | Active app, playlist, or idle |
| button | Home all | Home every module |
| button | Scan bus | Full RS485 discovery |
| button | Sync state | Republish master state / EEPROM sync |
| button | Refresh modules | Update known modules without a scan |
| button | Stop display | Stop the app or playlist |
| text | Set display text | Write text directly from automations |
| select | App | Start an app or choose Off |

## Services

All services live under `splitflap_os.*`.

| Service | Description |
| --- | --- |
| `send_text` | Send wrapped text with `start`, `style`, `speed`, `stop`, `raw` |
| `notify` | Queue an interrupting message with display time, style and priority; the active app or playlist resumes afterwards |
| `play_playlist` | Play pages with `delay` and `loop` |
| `start_app` / `stop_app` | Control the app engine |
| `sync` / `scan` / `update` | Hardware state actions |
| `calibrate` | Per-module goto/home/step/record/apply/clear_map/get_pos |
| `home_all` / `record_all` | Bulk calibration helpers |
| `save_playlist` / `delete_playlist` / `run_saved_playlist` | Playlist management |
| `set_settings` | Merge and persist settings (namespaced keys such as `clock.clock_format`) |

Service `pages` fields accept a real YAML list when called from scripts, or a
JSON array string when using the UI. `send_text` treats `start` as a 1-based
column offset. `speed` is forwarded with the display command; the current master
firmware ignores it and uses its own fixed bus timing.

Before text is published, every module that reports a `flap_list` is checked
for the characters it will receive. If a flap is missing, the service raises an
error naming the module and character, and nothing is sent. `play_playlist`
validates all pages before it starts. Padding spaces are ignored, and modules
without a reported flap list are skipped because there is no drum to compare
against.

## Settings

Settings are stored with Home Assistant's `Store` under the config entry and are
available from the panel. App settings are namespaced as `<app>.<key>` (for
example `clock.clock_format` or `weather.weather_entity`); legacy flat keys are
migrated automatically on first load. Important keys include:

- `row_counts`, `rows`, `cols` — the physical display layout. `row_counts` is
  one comma-separated module count per row, for example `3,3,1`. Blank means
  automatic layout. `rows` and `cols` are the frame dimensions; `0` means
  derive them from the detected module count.
- `ui_scale` — panel preview scale in percent (`50`–`200`, default `100`).
  Increase it to make a small physical display easier to see in the panel.
- `timezone`, `units`, `page_delay`.
- `weather_entity` (preferred), `zip_code` + `weather_api_key` (OpenWeather
  fallback).
- `stocks_list`, `crypto_list`, `sports_teams`.
- `metro_stop`, `metro_route`, `mbta_api_key`.
- `countdown_event`, `countdown_target`, `clock_format`, `world_clock_zones`.
- `anim_effect`, `anim_style`, `anim_speed`.

Weather uses the Home Assistant `weather.get_forecasts` service when an entity is
selected, so no external API key is required for the normal path. Stocks and
crypto use Yahoo Finance and CoinGecko respectively. MBTA works without a key at
low volume; an API key is optional.

## Physical layout and app availability

The layout describes the real display, not just the number of modules.

```text
row_counts = 3,3,1     frame = 3 rows × 3 columns

row 1: module 1  module 2  module 3
row 2: module 4  module 5  module 6
row 3:          module 7
```

Rules:

- Module IDs are assigned left to right, then top to bottom.
- A row with fewer modules is centred inside the frame.
- A layout may leave blank frame cells, up to one row's worth. For example,
  7 modules in a 3×3 frame is valid; 7 modules in a 3×15 frame is rejected.
- The integration rejects a saved layout that does not match the detected
  module count or leaves too much blank space. If the detected count changes
  later, the panel shows a layout error instead of silently using the wrong
  modules.
- Text pages and colour animations work on any valid layout, including one
  module. Data apps require every row to be wide enough for their content.

App minimums are declared in `apps/__init__.py`:

| App | Minimum frame |
| --- | --- |
| Animations | any size |
| Clock | 3 × 9 |
| Date | 3 × 11 |
| Dashboard | 3 × 11 |
| Weather | 3 × 10 |
| Stocks | 3 × 7 |
| Crypto | 3 × 8 |
| Sports | 3 × 8 |
| Metro | 3 × 10 |
| Countdown | 3 × 12 |
| World Clock | 1 × 10 |
| ISS | 3 × 10 |

Unsupported app cards are disabled and show the requirement. Starting one from
the panel or a service returns an error. If a running app becomes unsupported
because the layout changed, the engine stops it.

## MQTT contract

The integration expects the master's retained status payload to look like this
(abridged):

```json
{
  "state": "online",
  "text": "HELLO",
  "version": "1.1.0.0",
  "bus_compat": 1,
  "mqtt_compat": 1,
  "compat": 1,
  "modules_count": 45,
  "modules": [
    {
      "id": 1,
      "state": "online",
      "online": true,
      "flap": "H",
      "total_steps": 4096,
      "home_offset": 2832,
      "current_step": 3616,
      "flap_list": " ABC...",
      "map_of_positions": {"0": 2832, "1": 2896},
      "fw_version": "1.0.1",
      "fw_bus_compat": 1,
      "fw_bus_compatible": true,
      "fw_compat": 1,
      "fw_compatible": true
    }
  ]
}
```

`version`/`bus_compat`/`mqtt_compat` are the master's own version contract;
`compat` remains an alias for `mqtt_compat` for older integration builds. The
per-module `fw_version`/`fw_bus_compat` come from the slave's `m<id>s` reply;
`fw_bus_compatible` is omitted when the module does not report a version, and
`fw_compat`/`fw_compatible` remain aliases for the bus values.

Display commands are sent as an ordered array so the array order doubles as the
animation order:

```json
{"modules": [{"id": 1, "char": "H"}, {"id": 2, "char": "I"}]}
```

Calibration commands use `{"module": 1, "action": "goto", "index": 5}` and the
master translates them to the slave protocol.

Position-map entries with the slave's `0xFFFF` sentinel are treated as unset:
they are omitted from snapshots, never shown as tuned in the character map,
and the integration falls back to the estimated flap position. Negative and
out-of-range entries are ignored in the same way. An explicit `positions`
object sent to the `calibrate` service may still contain `65535` to clear a
single entry on the slave.

## Versions and module firmware

All three parts of the system (slave firmware, ESP32 master, this integration)
use two independent **compatibility axes** because two different peers talk to
each other:

| Axis | Peer contract | Carried by |
| --- | --- | --- |
| **BUS_COMPAT** | RS485 application protocol and the OTA/bootloader entry contract | slave + master |
| **MQTT_COMPAT** | MQTT status/command JSON schema | master + Home Assistant |

The master bridges the two, so it carries both numbers. Each repository also
has its own release inside those generations, and the published version is
composed from the numbers that apply to it:

```
slave    <bus>.<release>              1.0.1      bus 1, release 0.1
master   <bus>.<mqtt>.<release>       1.1.0.0    bus 1, mqtt 1, release 0.0
HA       <mqtt>.<release>             1.2.13      mqtt 1, release 2.13
```

| Where | Version | Compatibility | Read from |
| --- | --- | --- | --- |
| Home Assistant integration | `1.2.13` | MQTT `1` | panel header, connection info, WebSocket `version`/`mqtt_compat` |
| ESP32 master | `1.1.0.0` | bus `1`, MQTT `1` | status `version`/`bus_compat`/`mqtt_compat`, connection info |
| Slave application | `1.0.1` | bus `1` | panel module inspector, firmware card, `m<id>v`, UPDI dump |

The integration compares the master's `mqtt_compat` with `MQTT_COMPAT` in
`const.py`. A mismatch shows a warning banner, but it never blocks display
traffic, OTA cancellation or a module reset. If the master predates the version
protocol, the panel says the version is unknown rather than assuming it is
compatible. The bus generation is shown for diagnostics; the slave <-> master
side is not something Home Assistant speaks directly.

The module firmware card shows the application version and bus generation each
slave reports. Use it to prove an OTA actually took: bump the slave's
`FW_RELEASE`, upload the new `.hex`, and the card should show the new version
after the module reboots and re-homes. OTA itself refuses an unknown bootloader
protocol before writing any page.

When changing the frontend, bump `VERSION` in `const.py`, `manifest.json` and
`frontend/constants.js`, and every `?v=` import parameter, together.
`tests/test_versions.py` enforces that lockstep and the major/MQTT_COMPAT
relationship.

## Coordinate system and recording index 0

The slave counts `pos` from the hall entering edge. Flap 0 sits at `homeOffset`,
and the fallback position for an unset map entry is
`homeOffset + round(index * totalStepsPerRev / 64)`, modulo
`totalStepsPerRev`. The integration mirrors this when it estimates a flap
position, so `home_offset` and `total_steps` in the status payload are enough to
locate any flap.

Recording index 0 is supported: `m<id>r0` stores the current position as
`map[0]` and redefines `homeOffset`. That is the intended way to re-centre flap
0, not a destructive compatibility write. Older master firmware also sent a
second `m<id>w0:0`; current firmware does not.

## Adding an app

Apps are local plugins. Create a directory under
`custom_components/splitflap_os/apps/<key>/` containing:

- `manifest.json` — key, name, icon, description, category, minimum rows/columns,
  modes, and setting fields. Setting keys are local to the app and namespaced
  automatically as `<key>.<field>`.
- `app.py` — an async `fetch(context, now)` returning a `Page`, a list of
  pages, or `None`. `context` is a narrow `AppContext` exposing `get_setting`,
  `lines`, `board`, `rows`, `cols`, `tz`, `unit_system`, `hass`, `async_cached`,
  `http_json`, `session`, and `http_timeout`.

```python
async def fetch(ctx, now):
    return [Page(ctx.lines("HELLO", "WORLD", ""), delay=5)]
```

Reload the integration to pick up the new directory. `visible_when` on a field
shows or hides it based on another field's value. Providers are called once per
display cycle; slow network calls should use `await ctx.async_cached(key, ttl, factory)`.

## Project layout

```
custom_components/splitflap_os/
├── __init__.py          setup, unload, cleanup
├── apps/                local app plugins (manifest.json + app.py) and registry
├── config_flow.py       single-instance setup and options
├── const.py             domain constants
├── coordinator.py       MQTT state, normalization, publishing
├── engine.py            display loop, playlists, settings, backup
├── entity.py            shared entity base
├── frontend/            sidebar panel JavaScript
├── layout.py            pure text/layout/order/rotation helpers
├── manifest.json
├── models.py            Page object
├── panel.py             static path + panel registration
├── runtime.py           runtime lookup helper
├── sensor.py / button.py / text.py / select.py
├── services.py / services.yaml
├── settings.py          grouped settings metadata
├── strings.json / translations/en.json
└── websocket_api.py     panel commands
```

`app.py` and `index.html` in the repository root are AdamGMakes' original
reference implementation. They are not loaded by Home Assistant.

## Development checks

Home Assistant is not vendored in this repository. Run the checks that do not
need a full Home Assistant install:

```bash
python3 -m py_compile custom_components/splitflap_os/*.py \
  custom_components/splitflap_os/apps/*/app.py
for f in $(find custom_components/splitflap_os/frontend -name '*.js'); do node --check "$f"; done
python3 -m json.tool custom_components/splitflap_os/manifest.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/strings.json >/dev/null
python3 tests/test_layout.py
python3 tests/test_positions.py
python3 tests/test_translations.py
python3 tests/test_ota.py
python3 tests/test_versions.py
```

## Credits

This project builds on the original **Split-Flap Display** design by
**Adam G Makes** ([@adamgmakes](https://github.com/adamgmakes)):

- Repository: https://github.com/adamgmakes/SplitFlapDisplay
- The 3D-printed module hardware, drum/character set, RS485 bus protocol,
  and the reference Python frontend in this repository's root (`app.py`,
  `index.html`) are derived from that work.

The original project is licensed under
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).
This derivative is shared on the same terms: non-commercial use, attribution to
Adam G Makes, and any further derivatives distributed under the same license.
Commercial use requires permission from the original author.

## Troubleshooting

- **Panel says OFFLINE** — check the MQTT integration, the topic prefix, and the
  retained `<prefix>/status` payload. The master sends a heartbeat every 30
  seconds; the integration marks it offline after 90 seconds.
- **No modules** — press **Scan bus** in Tuning. The status payload's
  `modules_count` drives the board size.
- **Layout error or disabled apps** — open Settings and adjust the frame or
  row layout. A row layout such as `3,3,1` must describe every detected module
  and may leave at most one row of blank frame cells. Data apps stay disabled
  until every row is wide enough.
- **Display shows old text after a restart** — the integration restores the last
  known module snapshot and desired characters; press **Sync** to refresh from
  the master.
- **Service fails with "Cannot display: module ... lacks ..."** — a module's
  reported drum lacks one of the requested characters. Check the module in
  Tuning, use a character from its flap list, or remove it. Nothing was sent to
  the display.
- **Panel missing after install** — reload the integration once, then hard-refresh
  the browser. Check Home Assistant logs for `panel` or static-path errors.
