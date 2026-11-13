# YAML příklady

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/automation/examples.md)

Běžné recepty: text, barvy, oznámení, playlisty a aplikace. Kalibrace je v
[kalibraci](calibration.md); skripty a šablony ve
[skriptech a šablonách](scripts.md). Přehled polí je v
[službách](../use/services.md).

## Zvyklosti

- Doména je **`splitflap_os`**, ne `splitflap`.
- Příklady používají současnou syntaxi (`action:`, `triggers:`). Starší klíče
  `service:` a `platform:` stále fungují.
- Volání služeb patří pod `action:`.
- Seznamy lze ve skriptech psát jako YAML seznamy. UI služeb přijímá u `pages`
  jen JSON **string**.
- Volání vyzkoušejte v **Nástroje pro vývojáře → Akce**, než ho vložíte do
  automatizace.

## Text podle času

```yaml
automation:
  - alias: "Ranní pozdrav"
    triggers:
      - trigger: time
        at: "07:00:00"
    actions:
      - action: splitflap_os.send_text
        data:
          text: "GOOD MORNING"
          style: center_out
```

## Více řádků a barevné lístky

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: |-
        ATTENTION
        🟥🟩🟦
      style: rain
```

## Reakce na entitu

```yaml
automation:
  - alias: "Pračka dokončena"
    triggers:
      - trigger: state
        entity_id: binary_sensor.washing_machine
        to: "on"
    actions:
      - action: splitflap_os.send_text
        data:
          text: "WASHING DONE"
          style: spiral
```

## Posun textu

`start` je od 1 a aplikuje se před zalamováním:

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: "HI"
      start: 5
```

## Odeslání hotové raw tabule

`raw` text musí být celá tabule; kratší text se doplní mezerami na
`řádky × sloupce`, delší se zkrátí:

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: "   R     "
      raw: true
```

## Dočasné oznámení

```yaml
actions:
  - action: splitflap_os.notify
    data:
      text: "DOOR OPEN"
      seconds: 20
      style: outside_in
      priority: 10
```

## Playlist ze skriptu

```yaml
actions:
  - action: splitflap_os.play_playlist
    data:
      pages:
        - text: "HELLO"
          delay: 3
        - text: "HOW ARE YOU?"
          style: rtl
          delay: 4
        - text: "TODAY IS {{ now().strftime('%d.%m.%Y') }}"
          delay: 5
      delay: 2
      loop: true
```

Stejný playlist v UI služby jako JSON string:

```json
[
  {"text": "HELLO", "delay": 3},
  {"text": "HOW ARE YOU?", "style": "rtl", "delay": 4}
]
```

## Uložení a spuštění pojmenovaného playlistu

```yaml
actions:
  - action: splitflap_os.save_playlist
    data:
      name: "Morning news"
      pages:
        - "GOOD MORNING"
        - text: "TODAY IS {{ now().strftime('%d.%m.%Y') }}"
          delay: 5
      delay: 3

  - action: splitflap_os.run_saved_playlist
    data:
      name: "Morning news"
```

## Spuštění a zastavení aplikace

```yaml
actions:
  - action: splitflap_os.start_app
    data:
      app: clock

  # později
  - action: splitflap_os.stop_app
```

## Viz také

- [Kalibrace](calibration.md)
- [Skripty a šablony](scripts.md)
- [Řešení potíží](troubleshooting.md)
