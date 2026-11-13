# Split-Flap OS

Vlastní integrace Home Assistantu pro split-flap tabuli řízenou firmwarem
**SplitFlap Master** (ESP32-C3, RS485). Home Assistant vlastní rozvržení textu,
aplikace, playlisty, geometrii tabule, stav ladění a ukládání dat; master vlastní
RS485 sběrnici a moduly.

> 🇬🇧 English version: [README.md](README.md).

```text
Home Assistant                         ESP32 master                 Moduly
┌───────────────────────────┐  MQTT    ┌──────────────┐   RS485     ┌────────┐
│ Integrace Split-Flap OS   │ ───────> │ command/*    │ ──────────> │ modul  │
│ engine + aplikace + panel │ <─────── │ status       │ <────────── │ modul  │
└───────────────────────────┘          └──────────────┘             └────────┘
```

## Dokumentace

| Oblast | Stránky |
| --- | --- |
| **Instalace** | [Instalace](docs/cs/setup/install.md), [Vývoj](docs/cs/setup/development.md) |
| **Používání displeje** | [Panel a nastavení](docs/cs/use/panel.md), [Entity](docs/cs/use/entities.md), [Služby](docs/cs/use/services.md) |
| **Automatizace** | [YAML příklady](docs/cs/automation/examples.md), [Kalibrace](docs/cs/automation/calibration.md), [Skripty a šablony](docs/cs/automation/scripts.md), [Řešení potíží](docs/cs/automation/troubleshooting.md) |
| **Protokol** | [Přehled](docs/cs/protocol/overview.md), [Příkazy](docs/cs/protocol/commands.md), [Text](docs/cs/protocol/text.md), [OTA](docs/cs/protocol/ota.md), [Rozvržení](docs/cs/protocol/layout.md), [Verze](docs/cs/protocol/versioning.md) |
| **Aplikace** | [Manifest](docs/cs/apps/manifest.md), [Tvorba aplikace](docs/cs/apps/authoring.md), [Příklady](docs/cs/apps/examples.md) |

## Požadavky

- Home Assistant 2024.11 nebo novější.
- Integrace MQTT připojená ke brokeru, který používá master.
- Firmware SplitFlap Master publikující `<prefix>/status` a poslouchající na
  `<prefix>/command/{display,sync,scan,update,calibrate,firmware}`.

## Rychlý start

1. Nainstalujte integraci ([HACS nebo ručně](docs/cs/setup/install.md)).
2. Přidejte **Split-Flap OS** a zadejte MQTT prefix (výchozí `splitflap`).
3. Ověřte, že entita **Status** je `online`.
4. Otevřete panel v postranním menu a stiskněte
   **Tuning → Commands → Scan bus**.
5. Pošlete text z **Control**.

## Co integrace umí

- Panel v postranním menu se záložkami Control, Apps, Tuning a Settings, živým
  náhledem a přepínáním angličtiny/češtiny.
- Automatické rozpoznání tabule z hlášeného počtu modulů, s volitelným
  rozvržením `row_counts`, například `3,3,1`.
- Sedm lokálních aplikací: animace, hodiny, odpočítávání, přehled, datum, akcie
  a počasí.
- Playlisty s textem, prodlevou, pořadím odesílání a smyčkou pro každou stránku.
- Entity a služby pro automatizace, včetně přerušujících oznámení.
- OTA firmware modulů přes MQTT; RS485 bootloader vlastní master.
- Kontrola znaků proti bubnu každého modulu před odesláním.

## Verze

| Část | Formát | Příklad | Osa |
| --- | --- | --- | --- |
| Modul | `<bus>.<vydání>` | `1.0.1` | RS485 sběrnice |
| Master | `<bus>.<mqtt>.<vydání>` | `1.1.0.0` | sběrnice + MQTT |
| Home Assistant | `<mqtt>.<vydání>` | `1.2.15` | MQTT |

Neshoda v `mqtt_compat` zobrazí upozornění, ale nezastaví zobrazování. Podrobnosti:
[verze](docs/cs/protocol/versioning.md).

## Poděkování a licence

Hardware, znakový set bubnu a RS485 protokol pochází od **Adam G Makes**
([SplitFlapDisplay](https://github.com/adamgmakes/SplitFlapDisplay)). Referenční
Python frontend v tomto repozitáři (`app.py`, `sources/index.html`) z té práce
vychází a Home Assistant ho nenačítá.

Původní projekt je pod CC BY-NC-SA 4.0; tento derivát drží stejné podmínky:
nekomerční použití, uvedení autora a šíření pod stejnou licencí. Komerční použití
vyžaduje souhlas původního autora.
