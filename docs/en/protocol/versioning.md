# Versioning

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/versioning.md)

There are two compatibility axes because two different pairs of peers talk to
each other.

## Compatibility axes

| Axis | Peer contract | Carried by |
| --- | --- | --- |
| **BUS_COMPAT** | RS485 application protocol and the OTA entry contract | slave + master |
| **MQTT_COMPAT** | MQTT status/command JSON schema | master + Home Assistant |

The master bridges both, so it carries both numbers. The OTA bootloader protocol
is a **third, separate** number: `OTA_PROTOCOL_VERSION` (master) must equal
`BOOTLOADER_VERSION` (slave `bootloader/src/protocol.h`). Never fold it into
either compatibility axis.

## Published versions

```text
slave    <bus>.<release>              1.0.1      bus 1, release 0.1
master   <bus>.<mqtt>.<release>       1.1.0.0    bus 1, mqtt 1, release 0.0
HA       <mqtt>.<release>             1.2.15     mqtt 1, release 2.15
```

## Checks

- `VERSION` in `const.py` must have its major number equal to `MQTT_COMPAT`;
  `tests/test_versions.py` enforces this.
- The integration compares the master's `mqtt_compat` (falling back to the older
  `compat` alias) with its own `MQTT_COMPAT`.
- A mismatch shows a warning banner but does not block display traffic, OTA
  cancellation, or a module reset.
- If the master predates the version protocol, the panel reports the version as
  unknown instead of assuming compatibility.
- The master's bus generation is diagnostic only; Home Assistant never speaks the
  RS485 protocol directly.

## What to bump

| Change | Bump |
| --- | --- |
| Bug fix, UI, new optional field, new command | release only |
| RS485 command/reply shape, module-id rules, OTA entry contract | `FW_BUS_COMPAT` + `MASTER_BUS_COMPAT` |
| MQTT JSON field/action removal or rename, panel snapshot shape | `MASTER_MQTT_COMPAT` + `MQTT_COMPAT` |
| Bootloader framing, commands, CRC, boot policy | `OTA_PROTOCOL_VERSION` + `BOOTLOADER_VERSION` |

## Frontend cache

When changing any frontend file, bump the version in lockstep:

1. `custom_components/splitflap_os/manifest.json`
2. `custom_components/splitflap_os/const.py` (`VERSION`)
3. `custom_components/splitflap_os/frontend/constants.js`
4. every `?v=` ES module import parameter

The file list and validation commands are in [development](../setup/development.md).

## See also

- [Development](../setup/development.md)
- [Protocol overview](overview.md)
