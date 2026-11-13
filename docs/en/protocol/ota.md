# Slave OTA

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/ota.md)

The panel flashes a slave module over RS485. The master owns the bootloader
framing; Home Assistant only ships base64 application-image chunks.

## Commands

Published to `<prefix>/command/firmware`:

| Action | Payload | Notes |
| --- | --- | --- |
| `begin` | `{"action": "begin", "module": 3}` | Start collecting an image. Repeating `begin` restarts an aborted collection. |
| `chunk` | `{"action": "chunk", "data": "<base64>"}` | Append image bytes. `data` is base64 of a raw application-image slice. |
| `flash` | `{"action": "flash"}` | Enter the bootloader and flash the collected image. Blocks the display loop for roughly 20–25 s. |
| `cancel` | `{"action": "cancel"}` | Abort an active session or discard a collected image. |
| `reset` | `{"action": "reset", "module": 3}` | Boot a module stuck in its bootloader back into the application. |

## Image constraints

- The application region starts at `0x0800`; the boot section is 2 KB.
- Maximum application size is **14336 bytes**, in 64-byte pages.
- Home Assistant sends **768 image bytes per chunk** (1024 base64 characters),
  well inside the master's 2048-byte MQTT buffer.
- The image must be the raw application region of the slave's `ATtiny1616_OTA`
  build, linked at `0x0800`.
- OTA refuses an unknown bootloader protocol before writing any page.

## Status object

Published inside `<prefix>/status` as `ota`:

```json
{"ota": {"state": "flashing", "module": 3, "progress": 42, "received": 9216}}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | string | `idle`, `collecting`, `entering`, `flashing`, `verifying`, `done`, `cancelled`, or `failed`. |
| `module` | int | Target module during a session. |
| `progress` | int | 0–100 while collecting or flashing. |
| `received` | int | Image bytes collected so far. |
| `error` | string | Present when the session failed. |

Unknown states fall back to `idle`; fields of the wrong type are dropped.

## Session behaviour

While a session is active (`collecting`, `entering`, `flashing`, `verifying`) the
master refuses display, scan, update, and calibrate commands, and a second upload
is rejected. A module stuck in the bootloader no longer answers the ASCII scan, so
`reset` is the recovery path.

## Home Assistant surface

There is no service for OTA. The panel uses the WebSocket commands
`splitflap_os/flash_firmware`, `splitflap_os/cancel_firmware`, and
`splitflap_os/reset_firmware`. The topic is documented here because it is part of
the MQTT contract.

## See also

- [Protocol overview](overview.md)
- [Commands](commands.md)
- [Versioning](versioning.md)
