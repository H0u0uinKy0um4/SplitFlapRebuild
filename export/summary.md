# Split-Flap OS — Conversation Summary

## Goal
Implement three major changes in `custom_components/splitflap_os`:
1. Per-app namespaced settings.
2. Notification queue.
3. Manifest-based local app plugins.

Also make apps more self-contained by moving Czech UI translations into each app manifest and removing app-specific global i18n fallbacks.

## Main Changes

### 1. Per-app namespaced settings
- `apps/common.py`: added `visible_when` to `SettingField`; added `AppContext`.
- `apps/loader.py`: added `AppRegistry`, manifest parsing, namespaced keys (`<app>.<key>`), `migrate_settings()`, local import via `importlib.util`, provider lookup (`fetch` with `provider` fallback).
- `settings.py`: now only global display settings and defaults.
- `engine.py`: registry-based defaults, namespaced settings migration, `_settings_for_ui()`, validation via `registry.keys`.
- `select.py`: uses `registry.app_defs()`.
- Panel: suffix-aware label/help/placeholder/option lookup in `core.js`; `visible_when` rendering and toggling in `render.js` and `actions.js`.

### 2. Notification queue
- `services.py` / `services.yaml`: added `notify` service (`text`, `seconds`, `style`, `priority`).
- `engine.py`: queue with priority and max age/size; `_wake_event` interrupts long delays; runner drains queue between pages and during `_sleep`; idle display shows message then restores previous state; `async_stop` clears queued notifications.
- `strings.json`, `translations/en.json`, `translations/cs.json`: added notify service strings.

### 3. Manifest-based local app plugins
- Created `apps/<id>/manifest.json` + `app.py` for 12 apps: animations, clock, countdown, crypto, dashboard, date, iss, metro, sports, stocks, weather, world_clock.
- Removed old flat modules: `animations.py`, `iss.py`, `markets.py`, `metro.py`, `sports.py`, `time_apps.py`, `weather.py`.
- Providers use `fetch(ctx, now)` with `AppContext`.
- `load_apps()` runs in executor during `async_setup`; new apps appear after integration reload.

### App-owned translations
- Added `translations` support to `AppDef` and loader.
- Migrated Czech app names/descriptions and field labels/help/placeholders/options from global i18n into each manifest.
- Panel prefers manifest translations; global i18n now only covers display settings and shared options.
- Removed app-specific entries from `frontend/i18n/en.js` and `cs.js`.

### Versioning
- Bumped version from `1.0.8` to `1.1.0` in:
  - `manifest.json`
  - `const.py`
  - `frontend/constants.js`
  - all `?v=` imports
- Updated README version references and feature/service documentation.

### Tests
- Added `tests/test_apps.py` for registry, namespacing, `visible_when`, and migration.
- Existing tests remain passing.

## Validation Run
Passed:
- `python3 -m py_compile custom_components/splitflap_os/*.py custom_components/splitflap_os/apps/*/app.py`
- `node --check` for all frontend JS
- JSON parsing for manifest, strings, and translations
- `tests/test_layout.py`
- `tests/test_positions.py`
- `tests/test_translations.py`
- `tests/test_ota.py`
- `tests/test_versions.py`
- `tests/test_apps.py`

Home Assistant is not installed in this environment, so runtime integration tests could not run.

## Current Status
Implementation is complete and validated at the static/unit-test level. Remaining work is optional: remove the last global fallback code paths entirely, add tests for manifest translations, and clean up any redundant compatibility entries.
