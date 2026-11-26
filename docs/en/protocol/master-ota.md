# Master OTA

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/master-ota.md)

The panel can update the ESP32 master itself. This is a separate channel from
[slave OTA](ota.md): the master flashes its own application over MQTT, while
module updates travel over the RS485 bootloader. Home Assistant never speaks
RS485 and does not use the manual ArduinoOTA port.

Master self-update requires master firmware with `mqtt_compat` 2 (for example
`1.2.0.0`) and this integration's `MQTT_COMPAT` 2 (`2.0.1`). Older masters keep
handling display and slave OTA normally; the Master OTA card still appears but
the compatibility gate warns or blocks a flash.

## Safety model

- Only **app-only ESP32 `.bin` images** are accepted. The master writes them to
  one of two OTA partitions and rolls back automatically if the new image does
  not boot successfully. The existing ArduinoOTA path remains a **manual
  recovery** tool, not the panel's update mechanism.
- Only one firmware operation may own the master. A running
  [slave OTA](ota.md#session-behaviour) session blocks a master flash and vice
  versa.
- Home Assistant verifies SHA-256 before publishing any chunk. The master
  verifies what it wrote and confirms a successful boot.
- Success is not "commands were sent": it means the master reconnected within
  **five minutes** with the expected version. A raw local upload without an
  expected version is allowed, but warns and only confirms the reconnect.
- The panel asks for confirmation before applying an image. **Cancel** is only
  available while the master is collecting; once `flash` is sent the master
  reboots automatically and there is deliberately no `reset` action on this
  topic.

## Commands

Published to `<prefix>/command/master_firmware` as JSON (not retained):

| Action | Payload | Notes |
| --- | --- | --- |
| `begin` | `{"action": "begin", "version": "1.2.0.0", "sha256": "<64 hex>", "size": 524288}` | Start collecting an image. `version` may be empty for a local image without a known version. |
| `chunk` | `{"action": "chunk", "data": "<base64>"}` | Append raw image bytes. Home Assistant sends 768 image bytes per chunk (1024 base64 characters). |
| `flash` | `{"action": "flash"}` | Verify and apply the staged image; the master reboots automatically. |
| `cancel` | `{"action": "cancel"}` | Discard a staged image. Accepted only while collecting. |

There is no `reset` action: a failed boot rolls back to the previous partition,
and manual recovery uses ArduinoOTA (below). Home Assistant accepts an app-only
image up to **1.875 MiB** (1,966,080 bytes, one master OTA slot) and drops an
image whose checksum does not match. The published `mqtt-compat-2` image is
1,477,664 bytes, so it fits comfortably.

## Status object

The master publishes `master_ota` inside `<prefix>/status`, next to the
unchanged slave `ota` object:

```json
{
  "version": "1.2.0.0",
  "bus_compat": 1,
  "mqtt_compat": 2,
  "ip": "10.0.1.42",
  "ota": {"state": "idle"},
  "master_ota": {
    "state": "collecting",
    "progress": 40,
    "received": 2048,
    "size": 5120,
    "version": "1.2.0.0",
    "target_version": "1.2.1.0",
    "error": null
  }
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `state` | string | `idle`, `collecting`, `applying`, `rebooting`, `done`, `failed`, or `cancelled`. |
| `progress` | int | 0–100 while collecting/applying. |
| `received` | int | Image bytes collected so far. |
| `size` | int | Expected image size in bytes. |
| `version` | string | Version currently booted on the master. |
| `target_version` | string | Version of the staged image, when known. |
| `error` | string | Present when the session failed. |

Unknown states fall back to `idle`. `ip` is extra diagnostic data for recovery;
the panel does not connect to it. See [overview](overview.md#status-payload) for
the rest of the status payload.

## Published releases

The master repository publishes `firmware.bin` plus a generated `firmware.json`
manifest to GitHub Releases. Pushes update a rolling `dev` release; tags create
immutable stable releases. A master manifest looks like:

```json
{
  "schema": 1,
  "kind": "master-app",
  "channel": "stable",
  "version": "1.2.0.0",
  "mqtt_compat": 2,
  "bus_compat": 1,
  "image": "firmware.bin",
  "sha256": "<64 hex>",
  "notes": "dual OTA partitions with rollback"
}
```

`kind: "master-app"` keeps it out of the slave release list, which uses
`slave-app` and a `.hex` asset. `bus_compat` is diagnostic here: the master's
RS485 generation is checked for slave flashes, not for its own update.

Before allowing a master flash, Home Assistant compares the release's
`mqtt_compat` with **both** its own `MQTT_COMPAT` and the connected master's
reported `mqtt_compat` (falling back to the older `compat` alias). A known
mismatch is blocked; an unknown master generation warns; the
`Debug: allow incompatible firmware` setting can downgrade a known mismatch to
a warning for development. Publishing a release alone never bypasses the gate.

## Panel surface

The controls live in **Settings → System → Master OTA**. The release picker
lists published master builds, stable first, then the latest `dev` build; HASC
downloads the `.bin` only when a release is flashed and verifies its checksum.
**Local BIN (advanced)** accepts a locally built app-only `firmware.bin` with an
optional expected version. Progress and the reconnect countdown stay inside
this sub-tab; there is no global badge. See the [panel guide](../use/panel.md#master-ota).

This is panel-only in v1: there is no Home Assistant automation service. The
WebSocket commands are `splitflap_os/list_master_firmware_releases`,
`splitflap_os/flash_master_firmware_release`, `splitflap_os/flash_master_firmware`,
and `splitflap_os/cancel_master_firmware`.

## Manual recovery

If the master stops answering MQTT after an update, use ArduinoOTA from the
master's build environment: host `SplFlp_Master`, port **3232**, with the
password from the `OTA_PASSWORD` build flag. That path is manual recovery only;
the panel never uses it. A successful master update reboots without any boot
button.

## See also

- [Slave OTA](ota.md)
- [Commands](commands.md)
- [Protocol overview](overview.md)
- [Versioning](versioning.md)
- [Panel and settings](../use/panel.md)
- [Troubleshooting](../automation/troubleshooting.md)
