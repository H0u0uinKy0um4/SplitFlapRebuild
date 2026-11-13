# Panel and settings

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/use/panel.md)

The panel is a vanilla JavaScript ES module registered through `panel_custom`.
There is no build step and no Lovelace resource to add.

## Tabs

| Tab | Contents |
| --- | --- |
| **Control** | Live preview, multi-line compose box, colour flap buttons, start column, send order, speed, playlist builder, and saved playlists. |
| **Apps** | App cards with availability, a gear button for that app's settings, a mode button, and start/stop. |
| **Tuning** | Commands, Map, Auto-tune, Teach, and Drum sub-tabs. |
| **Settings** | Display, Apps, Drums, and System sub-tabs. |

## Control

- Text is composed in the box, then sent with the selected **send order** and
  **speed**. The same wrapping rules as `send_text` apply, so what the preview
  shows is what the board receives.
- **Colour flap buttons** insert the firmware's lower-case colour characters
  (`r`, `o`, `y`, `g`, `b`, `p`, `w`). The drum has no colour emoji; the
  integration maps emoji to these flaps.
- **Start column** is 1-based and is applied before wrapping, like the `start`
  service field.
- **Playlists** are built page by page with their own delay and style, then
  saved under a name for `run_saved_playlist`.

## Apps

Each card shows the app name, description, icon, and availability. When an app
does not fit the layout, the card is disabled and states the requirement; see
[layout](../protocol/layout.md#app-availability). The gear button opens that
app's settings; the mode button picks a manifest-declared variant such as the
clock's `full`, `time`, or `date`.

## Tuning

| Sub-tab | Purpose |
| --- | --- |
| **Commands** | Module list, online state, home, goto, relative steps, scan, sync, refresh. |
| **Map** | EEPROM position map per module, including clearing entries. |
| **Auto-tune** | Sweep a module through its drum and record positions. |
| **Teach** | Record the current position as a drum index, including index `0`. |
| **Drum** | Write a 64-character drum to the slave's EEPROM and verify the readback. |

Moves are blocking. After `home`, `goto`, `step`, or `apply`, the master defers
its refresh by 5 seconds, so a module can briefly look offline; that is expected.

## Settings

### Display sub-tab

| Key | Meaning |
| --- | --- |
| `row_counts` | One comma-separated module count per physical row, for example `3,3,1`. Blank means automatic. |
| `rows`, `cols` | Frame dimensions. `0` derives them from the detected module count. |
| `ui_scale` | Preview scale in percent (`50`–`200`, default `100`). |
| `theme` | `auto` (follow Home Assistant), `light`, or `dark`. |
| `timezone` | IANA name such as `Europe/Prague`. Empty uses Home Assistant's timezone. |
| `units` | `auto`, `imperial`, or `metric`. |
| `page_delay` | Default page delay in seconds (`0.1`–`120`, default `5`). |

### Apps sub-tab

App settings are namespaced `<app>.<key>`, so two apps can both declare
`clock_format`. Defaults come from each `apps/<key>/manifest.json`. Legacy flat
keys from older releases are migrated on first load. A manifest field may use
`visible_when` to appear only when another field has a given value; the weather
API key field, for example, is hidden while a `weather` entity is selected.

The registered keys are `animations.*`, `clock.*`, `countdown.*`, `dashboard.*`,
`date.*`, `stocks.*`, and `weather.*`. See the app manifests for the exact list.

### Drums sub-tab

`default_drum` is the fallback 64-character drum used for modules that have not
reported their own. It is not a text field; the tab shows the drum and lets you
pick the stock one.

### System sub-tab

Connection details (prefix, broker state, versions and compatibility), hardware
actions, and backup/restore. The backup covers settings, playlists, and the last
module snapshot.

## Slave-module OTA

**Settings → System** also exposes the OTA controls. The panel reads an
`ATtiny1616_OTA` `firmware.hex`, validates and slices the application region,
and streams it over `<prefix>/command/firmware`. Progress arrives in the `ota`
status object, and the master blocks display traffic for roughly 20–25 seconds
while flashing. The wire details are in
[slave OTA](../protocol/ota.md).

## Behaviour notes

- Static inputs are not re-rendered while focused, so typing is not interrupted
  by status updates.
- The selected tab, settings sub-tab, and preview scale persist in
  `localStorage`; they are per-browser, not per-installation.
- Language switching covers panel strings, settings labels, app manifests, and
  service/entity names.

## See also

- [Entities](../use/entities.md)
- [Services](../use/services.md)
- [YAML examples](../automation/examples.md)
