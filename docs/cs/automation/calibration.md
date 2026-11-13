# Kalibrace z YAML

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/automation/calibration.md)

`splitflap_os.calibrate` pošle jeden příkaz jednomu modulu a `set_settings` změní
uložené nastavení. Přehled polí je ve [službách](../use/services.md); drátové
payloady v [příkazech](../protocol/commands.md#calibrate).

## Najetí domů a pohyb modulu

```yaml
actions:
  # Najetí modulu domů
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: home

  # Přesun na index bubnu 5
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: goto
      index: 5

  # Přesun na první lístek odpovídající znaku
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: goto
      flap: R

  # Relativní pohyb (převede se na absolutní pozici)
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: step
      steps: -32
```

Pohyby jsou blokující. Nechte modulu asi 5 sekund, než ho znovu vyzvete, jinak se
může jevit jako offline.

## Záznam lístku 0

Záznam indexu `0` uloží aktuální pozici jako `map[0]` a předefinuje `home_offset`;
je to podporovaný způsob, jak znovu vycentrovat lístek 0.

```yaml
actions:
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: record
      index: 0
```

## Aplikace mapy pozic

`positions` mapuje index bubnu na absolutní krok. `65535` vymaže jeden záznam a
`clear_map: true` vymaže celou mapu před zápisem.

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

## Zápis bubnu

Přesně 64 znaků, bez zalomení. Služba počká na čtení a vrátí `verified: true` nebo
`verified: false`.

```yaml
actions:
  - action: splitflap_os.calibrate
    data:
      module: 3
      action: drum_write
      drum: " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw"
```

## Změna nastavení

Klíče displeje jsou ploché; klíče aplikací mají jmenný prostor. Neznámé klíče se
ignorují.

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

## Synchronizace po restartu

```yaml
automation:
  - alias: "Obnovit stav tabule po restartu"
    triggers:
      - trigger: homeassistant
        event: start
    actions:
      - delay: "00:00:10"
      - action: splitflap_os.sync
```

## Viz také

- [Služby](../use/services.md)
- [Rozvržení a mapy pozic](../protocol/layout.md#souradnicovy-system-a-mapy-pozic)
- [YAML příklady](examples.md)
