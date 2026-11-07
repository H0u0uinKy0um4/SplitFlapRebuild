# Split-Flap OS

A Home Assistant custom integration for a split-flap display driven by the
ESP32-C3 RS485 **SplitFlap Master** firmware. It replaces the older `splitflap`
integration with a Home Assistant native app engine, a sidebar panel, and a
tuning/calibration workbench.

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
  45 modules become 3×15 and 64 become 4×16; rows/columns can be overridden.
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
- **Settings** — grouped settings (display, weather, markets, sports, transit,
  time, animations), hardware actions, backup/restore, and connection details.

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
| `play_playlist` | Play pages with `delay` and `loop` |
| `start_app` / `stop_app` | Control the app engine |
| `sync` / `scan` / `update` | Hardware state actions |
| `calibrate` | Per-module goto/home/step/record/apply/clear_map/get_pos |
| `home_all` / `record_all` | Bulk calibration helpers |
| `save_playlist` / `delete_playlist` / `run_saved_playlist` | Playlist management |
| `set_settings` | Merge and persist settings |

Service `pages` fields accept a real YAML list when called from scripts, or a
JSON array string when using the UI. `send_text` treats `start` as a 1-based
column offset. `speed` is forwarded with the display command; the current master
firmware ignores it and uses its own fixed bus timing.

## Settings

Settings are stored with Home Assistant's `Store` under the config entry and are
available from the panel. Important keys include:

- `rows`, `cols` — `0` means auto-detect from the module count.
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

## MQTT contract

The integration expects the master's retained status payload to look like this
(abridged):

```json
{
  "state": "online",
  "text": "HELLO",
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
      "map_of_positions": {"0": 2832, "1": 2896}
    }
  ]
}
```

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

## Firmware caveat: recording index 0

The current master firmware's `record` action sends `m<id>r<idx>`, then also
sends `m<id>w0:0` when `idx == 0` "for compatibility". That legacy write can
corrupt the first entry of the EEPROM map. Prefer recording nonzero indexes, or
patch the firmware to remove the extra `w0:0` write. The integration does not
send that write itself; it only sends `{"action": "record", "index": 0}` and the
master expands it.

## Adding an app

1. Add an async provider in `custom_components/splitflap_os/apps/`:

   ```python
   async def my_app(engine, now) -> list[Page]:
       return [Page(engine.lines("HELLO", "WORLD", ""), delay=5)]
   ```

2. Describe it with `AppDef` and register it in
   `custom_components/splitflap_os/apps/__init__.py`.
3. If it has settings, add `SettingField`s and optionally add them to a group in
   `settings.py`.

Providers are called once per display cycle. Slow network calls should use
`await engine.async_cached(key, ttl, factory)`.

## Project layout

```
custom_components/splitflap_os/
├── __init__.py          setup, unload, cleanup
├── apps/                app providers and registry
├── config_flow.py       single-instance setup and options
├── const.py             domain constants
├── coordinator.py       MQTT state, normalization, publishing
├── engine.py            display loop, playlists, settings, backup
├── entity.py            shared entity base
├── frontend/            sidebar panel JavaScript
├── layout.py            pure text/wrapping/order/rotation helpers
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
  custom_components/splitflap_os/apps/*.py
node --check custom_components/splitflap_os/frontend/splitflap-os-panel.js
python3 -m json.tool custom_components/splitflap_os/manifest.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/strings.json >/dev/null
python3 tests/test_layout.py
```

## Troubleshooting

- **Panel says OFFLINE** — check the MQTT integration, the topic prefix, and the
  retained `<prefix>/status` payload. The master sends a heartbeat every 30
  seconds; the integration marks it offline after 90 seconds.
- **No modules** — press **Scan bus** in Tuning. The status payload's
  `modules_count` drives the board size.
- **Display shows old text after a restart** — the integration restores the last
  known module snapshot and desired characters; press **Sync** to refresh from
  the master.
- **Panel missing after install** — reload the integration once, then hard-refresh
  the browser. Check Home Assistant logs for `panel` or static-path errors.
