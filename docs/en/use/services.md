# Services

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/use/services.md)

All services live under **`splitflap_os.*`**. They are meant for automations and
scripts; the panel uses WebSocket commands instead.

| Service | Purpose |
| --- | --- |
| `send_text` | Send wrapped text to the board. |
| `notify` | Queue an interrupting message; the app or playlist resumes afterwards. |
| `play_playlist` | Play a list of pages, optionally looping. |
| `start_app` / `stop_app` | Start a data app / stop the engine. |
| `sync` / `scan` / `update` | Ask the master to republish state / scan the bus / refresh modules. |
| `calibrate` | One calibration command for one module. |
| `home_all` / `record_all` | Bulk calibration helpers. |
| `save_playlist` / `delete_playlist` / `run_saved_playlist` | Manage named playlists. |
| `set_settings` | Merge and persist settings. |

## send_text

| Field | Default | Meaning |
| --- | --- | --- |
| `text` | required | Text to display. New lines start a new row. Maximum 4096 characters. |
| `start` | `1` | 1-based offset: prepends `start - 1` spaces before wrapping. |
| `style` | `ltr` | Send order: `ltr`, `rtl`, `columns`, `center_out`, `outside_in`, `diagonal`, `random`, `rain`, `spiral`. |
| `speed` | `15` | Delay in ms per module. Sent with the display command; current master firmware ignores it. |
| `stop` | `true` | Stop the running app or playlist before showing the text. |
| `raw` | `false` | Treat `text` as a complete board: no upper-casing, no wrapping. |

Normal text is upper-cased, wrapped to the board, and centred. Quotes `"` become
`q`; colour emoji become physical colour flaps. See
[text composition](../protocol/text.md).

## notify

| Field | Default | Meaning |
| --- | --- | --- |
| `text` | required | Message to display, wrapped like `send_text`. Maximum 4096 characters. |
| `seconds` | `10` | How long the message stays visible (`0.5`–`300`). |
| `style` | `ltr` | Send order. Unknown styles fall back to `ltr`. |
| `priority` | `0` | Higher priority is shown first. Equal priorities keep arrival order. |

While an app or playlist runs, the queue is drained between pages and during
page delays, so the playlist position is kept. While the display is idle, the
message is shown and the previous board is restored afterwards. The queue holds
up to 50 entries and drops entries older than 300 seconds. `stop_app`,
`start_app`, `play_playlist`, and `send_text` with `stop: true` (the default)
clear pending notifications.

## play_playlist

| Field | Default | Meaning |
| --- | --- | --- |
| `pages` | required | YAML list (script) or JSON array string (service UI). Maximum 100 pages. |
| `delay` | `5` | Seconds after each page finishes moving. |
| `loop` | `true` | Repeat until stopped. |

A page is either a string, or an object with `text`, `delay`, `style`, `speed`,
`raw`, `resend`, and `start`. All pages are validated against the module drums
before playback starts, and the whole playlist is discarded if one page cannot
be shown.

## start_app and stop_app

| Field | Meaning |
| --- | --- |
| `app` | App key: `animations`, `clock`, `countdown`, `dashboard`, `date`, `stocks`, `weather`. |

Unknown apps raise an error. Apps that do not fit the layout also raise an error
with the requirement. `stop_app` has no fields and clears pending notifications.

## calibrate

| Field | Meaning |
| --- | --- |
| `module` | Module ID. |
| `action` | `goto`, `home`, `step`, `record`, `apply`, `clear_map`, `drum_write`, `get_pos`. |
| `index` | Drum index, 0-based. |
| `flap` | Character for `goto` when `index` is not set. |
| `home_offset` | Steps from the hall sensor to flap 0 (`apply`). |
| `positions` | `index -> absolute step` map (`apply`). `65535` clears one entry. |
| `clear_map` | Clear the EEPROM map before `apply`. |
| `steps` | Relative steps; converted to an absolute position. |
| `drum` | Exactly 64 characters, no line breaks (`drum_write`). |

`drum_write` waits for the module to report the new drum and returns
`verified: true` or `verified: false`. The payload the master receives for each
action is in [commands](../protocol/commands.md#calibrate).

## sync, scan, update

| Service | Effect |
| --- | --- |
| `sync` | Ask the master to republish its state and EEPROM snapshot. |
| `scan` | Full RS485 discovery; the result arrives as a new status payload. |
| `update` | Refresh the known modules without a full bus scan. |

## Playlist management

- `save_playlist` — `name`, `pages`, `delay`.
- `delete_playlist` — `name`.
- `run_saved_playlist` — run a saved playlist in a loop by `name`.

## Bulk calibration

- `home_all` — home every module.
- `record_all` — record one `index` on every module.

## set_settings

Merges a `settings` object and persists it. Display keys keep their flat names;
app keys are namespaced, for example `clock.clock_format`. Unknown keys are
ignored rather than stored, and a malformed value is skipped instead of failing
the whole call. See [panel and settings](panel.md#settings).

## Character validation

Before anything is published:

- Every module that reports a `flap_list` is checked for the characters it will
  receive.
- Padding spaces are ignored.
- Modules without a reported `flap_list` are skipped, because there is no drum to
  compare against.
- A missing character raises an error naming the module and the character, and
  **nothing** is sent.

## See also

- [YAML examples](../automation/examples.md)
- [Entities](../use/entities.md)
- [Protocol commands](../protocol/commands.md)
