# Development

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/setup/development.md)

Home Assistant is not installed in this repository, so validation uses the
checks that need no Home Assistant runtime.

## Checks

```bash
python3 -m py_compile custom_components/splitflap_os/*.py \
  custom_components/splitflap_os/apps/*.py \
  custom_components/splitflap_os/apps/*/app.py
for f in $(find custom_components/splitflap_os/frontend -name '*.js'); do node --check "$f"; done
python3 -m json.tool custom_components/splitflap_os/manifest.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/strings.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/translations/en.json >/dev/null
python3 -m json.tool custom_components/splitflap_os/translations/cs.json >/dev/null
python3 tests/test_apps.py
python3 tests/test_layout.py
python3 tests/test_positions.py
python3 tests/test_translations.py
python3 tests/test_ota.py
python3 tests/test_versions.py
```

## Version lockstep

`VERSION` in `const.py` must have its major number equal to `MQTT_COMPAT`
(`tests/test_versions.py` enforces this). The same version appears in
`manifest.json`, `const.py`, `frontend/constants.js`, and every `?v=` ES module
import:

- `frontend/splitflap-os-panel.js`
- `frontend/panel/{core,components,actions,flap-display}.js`
- `frontend/panel/views/{control,playlists,apps,tuning,settings}.js`
- `frontend/i18n/index.js`

Never leave a stale `?v=` value behind; Home Assistant and the browser cache
would serve mixed modules. See [versioning](../protocol/versioning.md).

## Project layout

```text
custom_components/splitflap_os/
├── __init__.py          setup, unload, cleanup
├── apps/                local app plugins (manifest.json + app.py), common.py, loader.py
├── button.py            hardware action buttons
├── config_flow.py       single-instance setup and options
├── const.py             domain constants
├── coordinator.py       MQTT state, normalization, publishing
├── engine.py            display loop, playlists, settings, backup
├── entity.py            shared entity base
├── firmware.py          Intel HEX parsing for OTA images
├── frontend/            sidebar panel JavaScript
│   └── panel/           core, components, actions, flap-display, views/
├── layout.py            pure text/layout/order/rotation helpers
├── manifest.json
├── models.py            Page object
├── ota.py               OTA status/action constants and normalization
├── panel.py             static path + panel registration
├── runtime.py           runtime lookup helper
├── select.py            app select entity
├── sensor.py            status sensors
├── services.py / services.yaml
├── settings.py          display settings metadata
├── strings.json / translations/{en,cs}.json
├── text.py              display text entity
└── websocket_api.py     panel commands
```

`layout.py` and `positions.py` must stay free of Home Assistant imports so
`tests/` can exercise them directly. `app.py` and `sources/index.html` at the
repository root are the original AdamGMakes reference implementation; they are
not loaded by Home Assistant.

## Documentation

Every page exists twice, `docs/en/...` and `docs/cs/...`, with the same file
name and mirrored headings. When you add or change a page, update both
languages, the cross-language header links, and the tables in `README.md` and
`README.cs.md`.
