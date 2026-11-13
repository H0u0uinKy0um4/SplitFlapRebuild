# Calibration from YAML

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/automation/calibration.md)

`splitflap_os.calibrate` sends one action to one module, and `set_settings`
changes persisted settings. Field reference is in [services](../use/services.md);
the wire payloads are in [commands](../protocol/commands.md#calibrate).

## Home and move a module

```yaml
actions:
  # Home a module
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: home

  # Move to drum index 5
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: goto
      index: 5

  # Move to the first flap matching a character
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: goto
      flap: R

  # Relative move (converted to an absolute position)
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: step
      steps: -32
```

Moves are blocking. Give a module about 5 seconds before you query it again, or
it will look offline.

## Record flap 0

Recording index `0` stores the current position as `map[0]` and redefines
`home_offset`; it is the supported way to re-centre flap 0.

```yaml
actions:
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: record
      index: 0
```

## Apply a position map

`positions` maps a drum index to an absolute step. `65535` clears one entry, and
`clear_map: true` clears the whole map first.

```yaml
actions:
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: apply
      home_offset: 2832
      clear_map: false
      positions:
        0: 2832
        1: 2896
        2: 2960
```

## Write a drum

Exactly 64 characters, no line breaks. The service waits for the readback and
returns `verified: true` or `verified: false`.

```yaml
actions:
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: drum_write
      drum: " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw"
```

## Change settings

Display keys are flat; app keys are namespaced. Unknown keys are ignored.

```yaml
actions:
  - action: splitflap_os.set_settings
    data:
      settings:
        page_delay: 8
        ui_scale: 120
        theme: dark
        clock.clock_format: "24h"
        weather.weather_entity: weather.home
```

## Sync after a restart

```yaml
automation:
  - alias: "Restore board state after restart"
    triggers:
      - trigger: homeassistant
        event: start
    actions:
      - delay: "00:00:10"
      - action: splitflap_os.sync
```

## See also

- [Services](../use/services.md)
- [Layout and position maps](../protocol/layout.md#coordinate-system-and-position-maps)
- [YAML examples](examples.md)
