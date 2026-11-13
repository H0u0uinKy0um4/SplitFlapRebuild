# Manifest aplikace

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/apps/manifest.md)

Aplikace je složka uvnitř `custom_components/splitflap_os/apps/` se dvěma soubory:
`manifest.json` (metadata a schéma nastavení) a `app.py` (provider). Načítají se
jen složky dodané v integraci; žádný vzdálený kód.

## Struktura složek

```text
custom_components/splitflap_os/apps/
├── common.py            AppContext, AppDef, SettingField, pomocníci
├── loader.py            AppRegistry, load_apps, parsování manifestu
├── __init__.py          re-exporty
└── hello/
    ├── manifest.json
    └── app.py
```

Název složky a `key` musí odpovídat `^[a-z][a-z0-9_]*$`. Složky začínající `_`
nebo `.` se ignorují. Složka bez manifestu, s neplatným manifestem nebo s `app.py`
bez `fetch` se zapíše do logu a přeskočí; nerozbije ostatní aplikace.

## Klíče manifestu

| Klíč | Typ | Výchozí | Význam |
| --- | --- | --- | --- |
| `key` | string | povinné | Jedinečný klíč aplikace. Malá písmena, číslice, podtržítko. |
| `name` | string | `key` | Zobrazovaný název. |
| `icon` | string | `""` | Emoji nebo krátký text na kartě aplikace. |
| `description` | string | `""` | Jednořádkový popis. |
| `category` | string | `data` | Skupina: `data`, `time` nebo `animation`. |
| `default_delay` | number | `5` | Sekundy na stránku, když stránka nemá `delay`. |
| `min_rows` | int | `1` | Minimální počet řad rámu. |
| `min_cols` | int | `1` | Minimální šířka **každé** řady. |
| `modes` | list | `[]` | Volitelné varianty volitelné v panelu. |
| `fields` | list | `[]` | Schéma nastavení. |
| `translations` | object | `{}` | Překlady názvu, popisu, polí a režimů. |

## Pole

Každé pole se stane vstupem v **Settings → Apps → <aplikace>** a ukládá se jako
`<klíč>.<klíč pole>`.

| Klíč | Typ | Význam |
| --- | --- | --- |
| `key` | string | Lokální klíč nastavení. |
| `label` | string | Popisek vstupu. |
| `type` | string | `text` (výchozí), `number`, `select`, `password`, `datetime-local`. Jiné hodnoty se zobrazí jako text. |
| `options` | list | Hodnoty pro `select`. |
| `placeholder` | string | Zástupný text vstupu. |
| `default` | any | Výchozí hodnota. |
| `min`, `max`, `step` | number | Omezení pro `number`. |
| `help` | string | Malý text pod vstupem. |
| `domain` | string | Metadata pro pole typu entity (například `weather`). Panel zobrazí textový vstup. |
| `visible_when` | object | Zobrazí pole jen když jiné pole odpovídá: `{"key": "weather_entity", "equals": ""}`. |

`visible_when.key` je **lokální** klíč; registr ho doplní jmenným prostorem.
Prázdné `equals` má význam („zobraz, když je pole prázdné“).

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

## Režimy

`modes` deklaruje varianty, které panel umí vybrat bez samostatných aplikací.
Panel předává zvolený režim přes WebSocket příkaz; `splitflap_os.start_app` spustí
aplikaci s výchozím režimem a neznámé režimy se ignorují.

```json
"modes": ["full", "time", "date"]
```

## Překlady

Hodnoty `name`, `description`, `label`, `help`, `placeholder` a `options` na
nejvyšší úrovni jsou anglické/výchozí. Pro další jazyky přidejte objekt
`translations`:

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

Panel upřednostní překlad manifestu pro zvolený jazyk a jinak použije hodnotu na
nejvyšší úrovni. Kdykoli přidáte uživatelsky viditelný text, doplňte `en` i `cs`;
shodu hlídají `tests/test_translations.py` a `tests/test_apps.py`.

## Kompletní příklad

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

Strana provideru je v [tvorbě aplikace](authoring.md).
