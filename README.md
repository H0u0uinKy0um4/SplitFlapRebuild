# Split-Flap OS

A Home Assistant custom integration for a split-flap display driven by the
ESP32-C3 RS485 **SplitFlap Master** firmware. Home Assistant owns text layout,
apps, playlists, board geometry, tuning state, and persistence; the master owns
the RS485 bus and the slave modules.

> 🇨🇿 Česká verze: [README.cs.md](README.cs.md).

```text
Home Assistant                         ESP32 master                 Slaves
┌───────────────────────────┐  MQTT    ┌──────────────┐   RS485     ┌────────┐
│ Split-Flap OS integration │ ───────> │ command/*    │ ──────────> │ module │
│ engine + apps + panel     │ <─────── │ status       │ <────────── │ module │
└───────────────────────────┘          └──────────────┘             └────────┘
```

## Documentation

| Area | Pages |
| --- | --- |
| **Setup** | [Installation](docs/en/setup/install.md), [Development](docs/en/setup/development.md) |
| **Using the display** | [Panel and settings](docs/en/use/panel.md), [Entities](docs/en/use/entities.md), [Services](docs/en/use/services.md) |
| **Automation** | [YAML examples](docs/en/automation/examples.md), [Calibration](docs/en/automation/calibration.md), [Scripts and templates](docs/en/automation/scripts.md), [Troubleshooting](docs/en/automation/troubleshooting.md) |
| **Protocol** | [Overview](docs/en/protocol/overview.md), [Commands](docs/en/protocol/commands.md), [Text](docs/en/protocol/text.md), [OTA](docs/en/protocol/ota.md), [Layout](docs/en/protocol/layout.md), [Versioning](docs/en/protocol/versioning.md) |
| **Apps** | [Manifest](docs/en/apps/manifest.md), [Writing an app](docs/en/apps/authoring.md), [Examples](docs/en/apps/examples.md) |

## Requirements

- Home Assistant 2024.11 or newer.
- The MQTT integration connected to the broker used by the master.
- SplitFlap Master firmware publishing `<prefix>/status` and listening on
  `<prefix>/command/{display,sync,scan,update,calibrate,firmware}`.

## Quick start

1. Install the integration ([HACS or manual](docs/en/setup/install.md)).
2. Add **Split-Flap OS** and enter the MQTT prefix (`splitflap` by default).
3. Confirm the **Status** sensor is `online`.
4. Open the sidebar panel and press **Tuning → Commands → Scan bus**.
5. Send text from **Control**.

## What it does

- Sidebar panel with Control, Apps, Tuning, and Settings tabs, a live preview,
  and English/Czech switching.
- Board auto-detection from the reported module count, with optional
  `row_counts` layouts such as `3,3,1`.
- Seven local app plugins: animations, clock, countdown, dashboard, date,
  stocks, and weather.
- Playlists with per-page text, delay, send order, and looping.
- Entities and services for automations, including interrupting notifications.
- Slave-module OTA over MQTT; the master owns the RS485 bootloader.
- Character validation against each module's drum before anything is sent.

## Versions

| Part | Format | Example | Axis |
| --- | --- | --- | --- |
| Slave | `<bus>.<release>` | `1.0.1` | RS485 bus |
| Master | `<bus>.<mqtt>.<release>` | `1.1.0.0` | bus + MQTT |
| Home Assistant | `<mqtt>.<release>` | `1.2.15` | MQTT |

A mismatch in `mqtt_compat` shows a warning but does not stop display traffic.
Details: [versioning](docs/en/protocol/versioning.md).

## Credits and licence

Hardware, drum character set, and the RS485 protocol come from **Adam G Makes**
([SplitFlapDisplay](https://github.com/adamgmakes/SplitFlapDisplay)). The
reference Python frontend in this repository (`app.py`, `sources/index.html`) is
derived from that work and is not loaded by Home Assistant.

The original project is CC BY-NC-SA 4.0; this derivative keeps the same terms:
non-commercial use, attribution, and share-alike. Commercial use requires
permission from the original author.
