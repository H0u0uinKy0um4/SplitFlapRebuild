# Entity

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/use/entities.md)

Názvy entit jsou přeložené do angličtiny a češtiny. Prefix `entity_id` vychází
z názvu displeje zadaného při instalaci. Pro displej pojmenovaný
`Split-Flap Display`:

| Platforma | Příklad `entity_id` | Význam |
| --- | --- | --- |
| sensor | `sensor.split_flap_display_status` | Master `online` / `offline` |
| sensor | `sensor.split_flap_display_module_count` | Počet zjištěných modulů |
| sensor | `sensor.split_flap_display_display_text` | Poslední ne-raw text |
| sensor | `sensor.split_flap_display_active_app` | Aktivní aplikace, playlist nebo `idle` |
| button | `button.split_flap_display_home_all` | Najet všemi moduly domů |
| button | `button.split_flap_display_scan_bus` | Plný sken sběrnice |
| button | `button.split_flap_display_sync_state` | Vyžádat stav masteru |
| button | `button.split_flap_display_refresh_modules` | Obnova bez skenu |
| button | `button.split_flap_display_stop_display` | Zastavit aplikaci nebo playlist |
| text | `text.split_flap_display_set_display_text` | Zápis textu (max 255 znaků) |
| select | `select.split_flap_display_app` | Spuštění aplikace nebo `Off` |

Přesné ID si vždy ověřte v **Nastavení → Zařízení a služby → Entity**.

## Atributy

- **Status** — `mqtt_prefix`, `modules_count`, `last_status`, `restored`.
- **Display text** — `lines`, `mode`, `active_app`, `current_page_index`,
  `current_page_count`.
- **Active app** — `mode`, `running`, `board` a informace o stránce.

## Chování

- Všechny entity se aktualizují ze signálu koordinátoru; nic nedotazuje.
- **Textová** entita volá `send_text` s `stop: true` a je omezená na 255 znaků.
  Delší řetězec entita odmítne, zatímco služba přijme až 4096.
- **Select** entita vypisuje všechny registrované aplikace plus `Off`. Volba
  `Off` zastaví engine; volba aplikace ji spustí ve výchozím režimu.
- **Module count** řídí velikost tabule, takže zůstává `0`, dokud nedorazí status
  payload s moduly.
- **Sync state** znovu publikuje stav masteru a snímek EEPROM; **Refresh modules**
  obnoví známé moduly bez plného skenu sběrnice.

## Viz také

- [Služby](../use/services.md)
- [YAML příklady](../automation/scripts.md#entity-v-yaml)
- [Přehled protokolu](../protocol/overview.md#stavovy-payload)
