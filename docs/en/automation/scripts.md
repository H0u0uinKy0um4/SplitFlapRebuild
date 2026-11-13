# Scripts and templates

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/automation/scripts.md)

Passing values into scripts, writing through entities, and using Jinja templates.

## Script field from MQTT

Script fields are ordinary variables inside the script. Pass them under `data:`
when calling the script entity:

```yaml
automation:
  - alias: "Rotary dial to script"
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

`script.turn_on` does not use `data:` for fields. Call the script entity directly
as above, or pass `variables:`:

```yaml
actions:
  - action: script.turn_on
    target:
      entity_id: script.rotary_phone_handler
    data:
      variables:
        dialed: "{{ trigger.payload }}"
```

## Entities in YAML

The text entity is the simplest way to show one message. It calls `send_text`
with `stop: true` and is limited to 255 characters.

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

## Templates

Text fields accept Jinja templates:

```yaml
text: "{{ states('sensor.outside_temperature') }} C"
text: "{{ now().strftime('%H:%M') }}"
text: "{{ trigger.to_state.name | upper }}"
```

Keep in mind:

- `send_text` upper-cases the result anyway.
- The stock drum has no accented characters, so `PRACKA` works and `PRAČKA`
  does not.
- `| int` returns `0` for non-numeric input. To reject bad input, compare as
  strings or use `regex_replace` and check for an empty result.
- In templates `22 == '22'` is `false`. Use `{{ value | string == '22' }}` when
  the type is uncertain.

## See also

- [Entities](../use/entities.md)
- [Services](../use/services.md)
- [Troubleshooting](troubleshooting.md)
