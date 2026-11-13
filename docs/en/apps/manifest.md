# App manifest

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/apps/manifest.md)

An app is a folder inside `custom_components/splitflap_os/apps/` with two files:
`manifest.json` (metadata and settings schema) and `app.py` (the provider). Only
folders shipped in the integration are loaded; there is no remote code.

## Directory layout

```text
custom_components/splitflap_os/apps/
├── common.py            AppContext, AppDef, SettingField, helpers
├── loader.py            AppRegistry, load_apps, manifest parsing
├── __init__.py          re-exports
└── hello/
    ├── manifest.json
    └── app.py
```

The folder name and `key` must match `^[a-z][a-z0-9_]*$`. Folders starting with
`_` or `.` are ignored. A folder without a manifest, a broken manifest, or an
`app.py` without `fetch` is logged and skipped; it does not break the other apps.

## Manifest keys

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `key` | string | required | Unique app key. Lower-case letters, digits, underscore. |
| `name` | string | `key` | Display name. |
| `icon` | string | `""` | Emoji or short text shown on the app card. |
| `description` | string | `""` | One-line description. |
| `category` | string | `data` | Grouping hint: `data`, `time`, or `animation`. |
| `default_delay` | number | `5` | Seconds per page when the page does not set `delay`. |
| `min_rows` | int | `1` | Minimum frame rows. |
| `min_cols` | int | `1` | Minimum width of **every** row. |
| `modes` | list | `[]` | Optional panel-selectable variants. |
| `fields` | list | `[]` | Settings schema. |
| `translations` | object | `{}` | Per-language name, description, field, and mode overrides. |

## Fields

Each field becomes an input on **Settings → Apps → <app>** and is persisted as
`<key>.<field key>`.

| Key | Type | Meaning |
| --- | --- | --- |
| `key` | string | Local setting key. |
| `label` | string | Input label. |
| `type` | string | `text` (default), `number`, `select`, `password`, `datetime-local`. Other values render as text. |
| `options` | list | Values for `select`. |
| `placeholder` | string | Input placeholder. |
| `default` | any | Default value. |
| `min`, `max`, `step` | number | Bounds for `number`. |
| `help` | string | Small text under the input. |
| `domain` | string | Metadata for entity-like fields (for example `weather`). The panel renders a text input. |
| `visible_when` | object | Show the field only when another field matches: `{"key": "weather_entity", "equals": ""}`. |

`visible_when.key` is a **local** key; the registry namespaces it. An empty
`equals` is meaningful ("show when the field is blank").

```json
"fields": [
  {
    "key": "format",
    "label": "Format",
    "type": "select",
    "options": ["short", "long"],
    "default": "short"
  },
  {
    "key": "api_key",
    "label": "API key",
    "type": "password",
    "visible_when": {"key": "format", "equals": "long"}
  }
]
```

## Modes

`modes` declares variants the panel can select without separate apps. The panel
passes the chosen mode through its WebSocket command; `splitflap_os.start_app`
starts the app in its default mode, and unknown modes are ignored.

```json
"modes": ["full", "time", "date"]
```

## Translations

Top-level `name`, `description`, `label`, `help`, `placeholder`, and `options` are
the English/default values. Add a `translations` object for other languages:

```json
"translations": {
  "cs": {
    "name": "Ahoj",
    "description": "Statický pozdrav",
    "fields": {
      "format": {
        "label": "Formát",
        "help": "Jak dlouhý text zobrazit.",
        "placeholder": "krátký",
        "options": {"short": "Krátký", "long": "Dlouhý"}
      }
    },
    "modes": {"full": "Celé"}
  },
  "en": {
    "fields": {
      "format": {"options": {"short": "Short", "long": "Long"}}
    }
  }
}
```

The panel prefers the manifest translation for the selected language and falls
back to the top-level value. Include both `en` and `cs` whenever you add
user-visible text; `tests/test_translations.py` and `tests/test_apps.py` check
parity.

## Complete example

`custom_components/splitflap_os/apps/hello/manifest.json`:

```json
{
  "key": "hello",
  "name": "Hello",
  "icon": "👋",
  "description": "A static greeting",
  "category": "data",
  "default_delay": 5,
  "min_rows": 1,
  "min_cols": 5,
  "fields": [
    {
      "key": "greeting",
      "label": "Greeting",
      "type": "text",
      "default": "HELLO"
    }
  ]
}
```

The provider side is in [writing an app](authoring.md).
