# YAML examples

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/automation/examples.md)

Everyday recipes: text, colours, notifications, playlists, and apps. Calibration
is in [calibration](calibration.md); scripts and templates in
[scripts and templates](scripts.md). Field reference is in
[services](../use/services.md).

## Conventions

- The domain is **`splitflap_os`**, not `splitflap`.
- Examples use the current syntax (`action:`, `triggers:`). The older `service:`
  and `platform:` keys still work.
- Service calls go under `action:`.
- Lists can be YAML lists in scripts. The service UI accepts only a JSON
  **string** for `pages`.
- Test in **Developer tools → Actions** before putting a call in an automation.

## Send text on a schedule

```yaml
automation:
  - alias: "Morning greeting"
    triggers:
      - trigger: time
        at: "07:00:00"
    actions:
      - action: splitflap_os.send_text
        data:
          text: "GOOD MORNING"
          style: center_out
```

## Multiple rows and colour flaps

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: |-
        ATTENTION
        🟥🟩🟦
      style: rain
```

## React to an entity

```yaml
automation:
  - alias: "Washing machine finished"
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

## Offset the text

`start` is 1-based and is applied before wrapping:

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: "HI"
      start: 5
```

## Send a complete raw board

`raw` text must be a complete board; shorter text is space-padded to
`rows × cols`, longer text is truncated:

```yaml
actions:
  - action: splitflap_os.send_text
    data:
      text: "   R     "
      raw: true
```

## Temporary notification

```yaml
actions:
  - action: splitflap_os.notify
    data:
      text: "DOOR OPEN"
      seconds: 20
      style: outside_in
      priority: 10
```

## Playlist from a script

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

The same playlist in the service UI as a JSON string:

```json
[
  {"text": "HELLO", "delay": 3},
  {"text": "HOW ARE YOU?", "style": "rtl", "delay": 4}
]
```

## Save and run a named playlist

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

## Start and stop an app

```yaml
actions:
  - action: splitflap_os.start_app
    data:
      app: clock

  # later
  - action: splitflap_os.stop_app
```

## See also

- [Calibration](calibration.md)
- [Scripts and templates](scripts.md)
- [Troubleshooting](troubleshooting.md)
