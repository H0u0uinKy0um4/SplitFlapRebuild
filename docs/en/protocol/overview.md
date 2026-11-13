# Protocol overview

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/overview.md)

This page covers the roles, the MQTT connection, and the status payload. Command
payloads are in [commands](commands.md); board geometry is in
[layout](layout.md); compatibility numbers are in [versioning](versioning.md).

The wire protocol between master and slaves (RS485 framing, bootloader escaping,
CRCs) belongs to the firmware repositories. Home Assistant never speaks it
directly, so this page only describes what crosses MQTT.

## Roles and boundaries

```text
Home Assistant                         ESP32 master                 Slaves
┌───────────────────────────┐  MQTT    ┌──────────────┐   RS485     ┌────────┐
│ Split-Flap OS integration │ ───────> │ command/*    │ ──────────> │ module │
│ engine + apps + panel     │ <─────── │ status       │ <────────── │ module │
└───────────────────────────┘          └──────────────┘             └────────┘
```

- **Home Assistant** composes text, wraps it to the board, runs apps and
  playlists, validates characters, stores settings, and publishes commands.
- **The master** owns the RS485 bus, performs scans and calibration, schedules
  module moves, tracks positions, and publishes state. Moves are **blocking** on
  the slave side.
- **Slaves** are addressed by numeric module ID and show one character each.

Only one config entry is allowed, because the firmware is a single master.

## MQTT connection

| Setting | Default | Notes |
| --- | --- | --- |
| Topic prefix | `splitflap` | Configurable during setup. Must not be empty or contain `+` / `#`. |
| Status topic | `<prefix>/status` | JSON, retained by the master. |
| Command topics | `<prefix>/command/{display,sync,scan,update,calibrate,firmware}` | JSON, not retained. |

The integration subscribes to the status topic and marks the master offline after
**90 seconds** without a payload. The master publishes a heartbeat every
**30 seconds**.

If the configured prefix differs from the master's, Home Assistant receives no
status, keeps `modules_count` at `0`, and publishes commands nobody reads. The
panel shows the master as offline and the module list is empty.

## Status payload

Canonical shape (abridged):

```json
{
  "state": "online",
  "text": "HELLO",
  "version": "1.1.0.0",
  "bus_compat": 1,
  "mqtt_compat": 1,
  "compat": 1,
  "scanning": false,
  "modules_count": 7,
  "modules": [
    {
      "id": 1,
      "state": "online",
      "online": true,
      "total_steps": 4096,
      "status": 1,
      "home_offset": 2832,
      "auto_homing": true,
      "current_step": 3616,
      "pos": 3616,
      "current_index": 1,
      "busy": false,
      "position_known": true,
      "flap_list": " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw",
      "map_of_positions": {"0": 2832, "1": 2896},
      "flap": "H",
      "fw_version": "1.0.1",
      "fw_bus_compat": 1,
      "fw_bus_compatible": true,
      "fw_compat": 1,
      "fw_compatible": true
    }
  ],
  "ota": {"state": "idle"}
}
```

### Top-level fields

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | string | `online` / `offline` as reported by the master. |
| `text` | string | Last text the master displayed. |
| `version` | string | Master firmware version, `<bus>.<mqtt>.<release>`. |
| `bus_compat` | int | Master's RS485 application generation. |
| `mqtt_compat` | int | Master's MQTT schema generation. |
| `compat` | int | Legacy alias for `mqtt_compat`. |
| `scanning` | bool | A bus scan is in progress. |
| `modules_count` | int | Modules the master knows about. Drives the board size. |
| `modules` | array | Module objects, see below. |
| `ota` | object | Slave OTA session state; see [slave OTA](ota.md). |

### Module fields

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | int | Module ID on the bus. |
| `state` | string | Module state reported by the slave. |
| `online` | bool | The master considers the module reachable. |
| `total_steps` | int | Steps per full revolution. |
| `home_offset` | int | Steps from the hall entering edge to flap index `0`. |
| `current_step` | int | Current absolute step position. |
| `current_index` | int | Flap index from the position map, or the linear fallback. |
| `flap` | string | Best-known character; not a true readback. |
| `flap_list` | string | The module's drum, exactly 64 characters when reported. |
| `map_of_positions` | object | Optional `index -> absolute step` EEPROM map. |
| `position_known` | bool | The slave reports a valid known position. |
| `busy` | bool | Always `false` in current firmware because moves are blocking. |
| `auto_homing` | bool | The slave's auto-home setting. |
| `status` | int | Raw slave status code. |
| `fw_version` | string | Slave application version, `<bus>.<release>`. |
| `fw_bus_compat` | int | Slave's bus generation. |
| `fw_bus_compatible` | bool | Present when the slave reports a version. |
| `fw_compat` / `fw_compatible` | int / bool | Legacy aliases for the bus values. |

The coordinator accepts several aliases for robustness (`flapList`, `drum`,
`pos`, `steps_per_rev`, `positionMap`, `firmwareVersion`, and others). The table
lists the canonical names; new firmware should publish those.

`actual_flap` and `desired_flap` are derived by the integration for the panel.
They are not part of the MQTT payload.

### Position caveat

`flap` is the master's **best knowledge**, not a true readback:

- When `position_known` is true, the master derives the flap from the position
  map, or from the linear formula when no map entry exists, and publishes that
  plus `current_index`.
- Otherwise it falls back to the last requested character.

On deployed (older) slave firmware the position is open loop between homes, so
`position_known` is only trustworthy with firmware that re-references on the hall
entering edge during every move. See
[layout](layout.md#coordinate-system-and-position-maps).

## Diagnostics

| Symptom | Likely cause |
| --- | --- |
| Status entity `offline` | Wrong prefix, MQTT disconnected, or no retained status. |
| `modules_count` stays `0` | No parsed status, or the bus was never scanned. |
| Commands published but nothing moves | Master ignored the module IDs, or a move is still blocking. Wait ~5 s. |
| Module looks offline right after a move | Expected: the refresh is deferred by 5 s. |
| `Cannot display: module N lacks 'X'` | The reported drum lacks the character. Nothing was sent. |
| OTA rejected | Another session is active, the image is too large, or the bootloader protocol is unknown. |
| Version warning | Master `mqtt_compat` differs from `MQTT_COMPAT`. |

More in [troubleshooting](../automation/troubleshooting.md).
