# Installation

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/setup/install.md)

## Requirements

- Home Assistant **2024.11** or newer.
- The **MQTT** integration configured and connected to the broker the master
  uses. The integration does not bundle an MQTT client.
- SplitFlap Master firmware that publishes `<prefix>/status` (JSON, retained)
  and subscribes to `<prefix>/command/{display,sync,scan,update,calibrate,firmware}`.
- The MQTT topic prefix used by the master. The default firmware uses
  `splitflap`.

## HACS (custom repository)

1. In HACS, add this repository as an **Integration** custom repository.
2. Install **Split-Flap OS**.
3. Restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration → Split-Flap OS**.

## Manual

Copy `custom_components/splitflap_os` into your Home Assistant
`config/custom_components/` directory and restart Home Assistant. Then add the
integration from the UI.

The sidebar panel is registered automatically through `panel_custom`; no
Lovelace resource entry is needed.

## Configuration

| Field | Default | Notes |
| --- | --- | --- |
| MQTT topic prefix | `splitflap` | Must not be empty and must not contain `+` or `#`. |
| Display name | `Split-Flap Display` | Used in entity names and `entity_id`s. |

Only **one** config entry is allowed, matching the single-master firmware.
Adding a second one aborts with `single_instance_allowed`.

Both values can be changed later in the integration's **Configure** dialog. The
entry reloads after saving; entity IDs do not change when you rename the display.

## First run

1. Add the integration and check that the **Status** sensor becomes `online`.
   The master publishes a heartbeat every 30 seconds and the integration marks
   it offline after 90 seconds without a payload.
2. Open the **Split-Flap OS** panel, go to **Tuning → Commands**, and press
   **Scan bus** if the module count is `0`.
3. If the auto-detected frame is not the physical shape, set `row_counts`
   (for example `3,3,1`), `rows`, and `cols` in **Settings → Display**. See
   [layout](../protocol/layout.md).
4. Send a short text from **Control** and confirm that the modules move.

## Verify

- **Settings → Devices & services → Entities** lists the sensors, buttons, the
  text entity, and the app select entity. See [entities](../use/entities.md).
- The panel appears in the sidebar; no separate dashboard is required.
- The **Status** attributes show the MQTT prefix, module count, and the last
  status payload.

## Upgrading

1. Update through HACS (or replace `custom_components/splitflap_os`).
2. Restart Home Assistant.
3. Hard-refresh the browser (Ctrl/Cmd+Shift+R) so the panel modules are not
   served from the service-worker cache.
4. Confirm the version on **Settings → System** and in the status attributes.

Settings, app settings, playlists, and the last module snapshot live in Home
Assistant's `Store` under the config entry and survive upgrades. Removing the
entry deletes both stores.

## Where to go next

- [Panel and settings](../use/panel.md)
- [Services](../use/services.md)
- [YAML examples](../automation/examples.md)
- [Troubleshooting](../automation/troubleshooting.md)
