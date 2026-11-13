# Vývoj

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/setup/development.md)

Home Assistant není v tomto repozitáři nainstalovaný, takže validace používá
kontroly, které nepotřebují běžící Home Assistant.

## Kontroly

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

## Verze v jednom kroku

`VERSION` v `const.py` musí mít major číslo rovné `MQTT_COMPAT`
(hlídá `tests/test_versions.py`). Stejná verze je v `manifest.json`, `const.py`,
`frontend/constants.js` a ve všech importech `?v=`:

- `frontend/splitflap-os-panel.js`
- `frontend/panel/{core,components,actions,flap-display}.js`
- `frontend/panel/views/{control,playlists,apps,tuning,settings}.js`
- `frontend/i18n/index.js`

Nikdy nenechávejte staré `?v=`; Home Assistant i prohlížeč by načetly smíchané
moduly. Viz [verze](../protocol/versioning.md).

## Struktura projektu

```text
custom_components/splitflap_os/
├── __init__.py          setup, unload, cleanup
├── apps/                lokální pluginy (manifest.json + app.py), common.py, loader.py
├── button.py            tlačítka hardwarových akcí
├── config_flow.py       jednorázové nastavení a options
├── const.py             konstanty domény
├── coordinator.py       MQTT stav, normalizace, publikování
├── engine.py            smyčka displeje, playlisty, nastavení, záloha
├── entity.py            společná základna entit
├── firmware.py          parsování Intel HEX pro OTA obrazy
├── frontend/            JavaScript panelu v postranním menu
│   └── panel/           core, components, actions, flap-display, views/
├── layout.py            čisté funkce pro text, rozvržení, pořadí a rotaci
├── manifest.json
├── models.py            objekt Page
├── ota.py               konstanty a normalizace OTA stavu/akcí
├── panel.py             registrace statické cesty a panelu
├── runtime.py           pomocník pro nalezení runtime
├── select.py            entita pro výběr aplikace
├── sensor.py            stavové senzory
├── services.py / services.yaml
├── settings.py          metadata nastavení displeje
├── strings.json / translations/{en,cs}.json
├── text.py              textová entita displeje
└── websocket_api.py     příkazy pro panel
```

`layout.py` a `positions.py` musí zůstat bez importů Home Assistantu, aby je
`tests/` mohly testovat přímo. `app.py` a `sources/index.html` v kořeni
repozitáře jsou původní referenční implementace od AdamGMakes; Home Assistant je
nenačítá.

## Dokumentace

Každá stránka existuje dvakrát, `docs/en/...` a `docs/cs/...`, se stejným názvem
souboru a zrcadlovými nadpisy. Když stránku přidáte nebo změníte, upravte oba
jazyky, odkazy v hlavičce a tabulky v `README.md` a `README.cs.md`.
