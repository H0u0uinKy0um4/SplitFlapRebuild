# Entities

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/use/entities.md)

Entity names are translated into English and Czech. The `entity_id` prefix comes
from the display name entered during setup. For a display named
`Split-Flap Display`:

| Platform | Example `entity_id` | Meaning |
| --- | --- | --- |
| sensor | `sensor.split_flap_display_status` | Master `online` / `offline` |
| sensor | `sensor.split_flap_display_module_count` | Detected module count |
| sensor | `sensor.split_flap_display_display_text` | Last non-raw text |
| sensor | `sensor.split_flap_display_active_app` | Active app, playlist, or `idle` |
| button | `button.split_flap_display_home_all` | Home every module |
| button | `button.split_flap_display_scan_bus` | Full bus scan |
| button | `button.split_flap_display_sync_state` | Request master state |
| button | `button.split_flap_display_refresh_modules` | Refresh without a scan |
| button | `button.split_flap_display_stop_display` | Stop app or playlist |
| text | `text.split_flap_display_set_display_text` | Write text (max 255 chars) |
| select | `select.split_flap_display_app` | Start an app or `Off` |

Always confirm the exact IDs in **Settings → Devices & services → Entities**.

## Attributes

- **Status** — `mqtt_prefix`, `modules_count`, `last_status`, `restored`.
- **Display text** — `lines`, `mode`, `active_app`, `current_page_index`,
  `current_page_count`.
- **Active app** — `mode`, `running`, `board`, and page information.

## Behaviour

- Every entity updates from the coordinator's dispatcher signal; nothing polls.
- The **text** entity calls `send_text` with `stop: true` and is limited to 255
  characters. Longer strings are rejected by the entity, while the service
  accepts up to 4096.
- The **select** entity lists every registered app plus `Off`. Choosing `Off`
  stops the engine; choosing an app starts it in its default mode.
- The **module count** sensor drives the board size, so it stays `0` until a
  status payload with modules arrives.
- **Sync state** republishes the master's state and EEPROM snapshot; **Refresh
  modules** updates the known modules without a full bus scan.

## See also

- [Services](../use/services.md)
- [YAML examples](../automation/scripts.md#entities-in-yaml)
- [Protocol overview](../protocol/overview.md#status-payload)
