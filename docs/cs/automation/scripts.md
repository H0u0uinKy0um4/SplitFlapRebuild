# Skripty a šablony

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/automation/scripts.md)

Předávání hodnot do skriptů, zápis přes entity a Jinja šablony.

## Pole skriptu z MQTT

Pole skriptu jsou uvnitř skriptu běžné proměnné. Při volání entity skriptu je
předejte pod `data:`:

```yaml
automation:
  - alias: "Rotační telefon na skript"
    triggers:
      - trigger: mqtt
        topic: rotarydial/dial
    actions:
      - action: script.rotary_phone_handler
        data:
          dialed: "{{ trigger.payload }}"
    mode: single
```

```yaml
script:
  rotary_phone_handler:
    alias: "Rotary Phone Handler"
    fields:
      dialed:
        description: "The dialed number payload"
        required: true
        selector:
          text:
    sequence:
      - variables:
          code: "{{ dialed | string | trim | regex_replace('[^0-9]', '') }}"
      - choose:
          - conditions:
              - condition: template
                value_template: "{{ code == '22' }}"
            sequence:
              - action: splitflap_os.send_text
                data:
                  text: "R"
                  style: rain
```

`script.turn_on` nepoužívá `data:` pro pole. Volejte entitu skriptu přímo jako
výše, nebo předejte `variables:`:

```yaml
actions:
  - action: script.turn_on
    target:
      entity_id: script.rotary_phone_handler
    data:
      variables:
        dialed: "{{ trigger.payload }}"
```

## Entity v YAML

Textová entita je nejjednodušší způsob, jak zobrazit jednu zprávu. Volá
`send_text` s `stop: true` a je omezená na 255 znaků.

```yaml
actions:
  - action: text.set_value
    target:
      entity_id: text.split_flap_display_set_display_text
    data:
      value: "HELLO WORLD"
```

```yaml
actions:
  - action: button.press
    target:
      entity_id: button.split_flap_display_sync_state
```

## Šablony

Textová pole přijímají Jinja šablony:

```yaml
text: "{{ states('sensor.outside_temperature') }} C"
text: "{{ now().strftime('%H:%M') }}"
text: "{{ trigger.to_state.name | upper }}"
```

Mějte na paměti:

- `send_text` výsledek stejně převede na velká písmena.
- Standardní buben nemá česká písmena s diakritikou, takže `PRACKA` funguje a
  `PRAČKA` ne.
- `| int` vrací u nečíselného vstupu `0`. Pokud potřebujete špatný vstup odmítnout,
  porovnávejte jako stringy nebo použijte `regex_replace` a kontrolujte prázdný
  výsledek.
- V šablonách je `22 == '22'` hodnota `false`. Když si nejste jistí typem,
  použijte `{{ value | string == '22' }}`.

## Viz také

- [Entity](../use/entities.md)
- [Služby](../use/services.md)
- [Řešení potíží](troubleshooting.md)
