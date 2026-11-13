# Commands

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/commands.md)

Every command is a JSON object published to `<prefix>/command/<name>`. Commands
are **not** retained. Text rules are in [text](text.md), OTA in [OTA](ota.md),
and geometry in [layout](layout.md).

## display

```json
{"modules": [{"id": 1, "char": "H"}, {"id": 2, "char": "I"}], "speed": 15}
```

| Field | Type | Notes |
| --- | --- | --- |
| `modules` | array | Ordered list of `{id, char}` objects. The array order **is** the animation send order. |
| `modules[].id` | int | Module ID. |
| `modules[].char` | string | Exactly one character. A space is allowed and clears the module. |
| `speed` | int | Optional per-module delay hint. Current master firmware ignores it and uses its own bus timing. |

The integration sends every module that maps to a board cell, including spaces,
so the whole frame is deterministic. Character validation happens in Home
Assistant before publishing:

- Each module's `flap_list` is checked.
- Padding spaces are ignored.
- Modules without a reported `flap_list` are skipped.
- A missing character raises an error and **nothing** is published.

## sync

```json
{"action": "fetch_state"}
```

Asks the master to republish its current state and EEPROM snapshot.

## scan

```json
{"action": "scan"}
```

Full RS485 discovery. The result arrives as a new status payload with an updated
`modules_count` and `modules` array.

## update

```json
{"action": "update_data"}
```

Refreshes the known modules without a full bus scan.

## calibrate

```json
{"action": "goto", "module": 3, "index": 5}
```

Common fields:

| Field | Type | Notes |
| --- | --- | --- |
| `action` | string | See the action table. |
| `module` | int | Module ID. |

| Action | Payload | Behavior |
| --- | --- | --- |
| `goto` | `index` or `flap` | Move to a drum index (0-based) or to the first flap matching `flap`. |
| `home` | — | Run the homing sequence. |
| `step` | `steps` | Relative step count, converted to an absolute position from the module's `current_step` and `total_steps`. If the position is unknown it logs a warning and sends the value as absolute. |
| `record` | `index` | Store the current position as the map entry for that drum index. Index `0` is supported and redefines `home_offset`. |
| `apply` | `home_offset`, `positions`, `clear_map` | Write the position map to EEPROM. `positions` is `index -> absolute step`; `65535` (`0xFFFF`) clears that entry. `clear_map: true` clears the map first. |
| `clear_map` | — | Clear the EEPROM position map. |
| `drum_write` | `drum` | Write exactly 64 characters, no CR/LF. The integration verifies the readback and reports `{ok, verified}`. |
| `get_pos` | — | Ask the module to report its current position. |

Notes:

- A relative step becomes an absolute `g<pos>` on the slave so a negative value
  cannot wrap around the drum.
- `map_of_positions` entries equal to the slave's `0xFFFF` sentinel are treated as
  unset: omitted from snapshots, never shown as tuned, and the integration falls
  back to the estimated flap.
- Negative or out-of-range map entries are ignored.
- Recording index `0` is the intended way to re-centre flap 0. The old destructive
  `m<id>w0:0` compatibility write has been removed.
- Moves are blocking. The master defers the post-move refresh by 5 s
  (`MOVE_SETTLE_MS`); do not query a module immediately after
  `goto`/`home`/`step`/`apply` or it may look offline.

## See also

- [Protocol overview](overview.md)
- [Text composition](text.md)
- [Slave OTA](ota.md)
- [Layout and geometry](layout.md)
