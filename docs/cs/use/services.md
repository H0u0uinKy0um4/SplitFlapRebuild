# Služby

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/use/services.md)

Všechny služby jsou pod **`splitflap_os.*`**. Jsou určené pro automatizace a
skripty; panel používá WebSocket příkazy.

| Služba | Účel |
| --- | --- |
| `send_text` | Pošle zalamovaný text na tabuli. |
| `notify` | Zařadí přerušující zprávu; aplikace nebo playlist pak pokračuje. |
| `play_playlist` | Přehraje seznam stránek, volitelně ve smyčce. |
| `start_app` / `stop_app` | Spustí datovou aplikaci / zastaví engine. |
| `sync` / `scan` / `update` | Požádá master o stav / sken sběrnice / obnovu modulů. |
| `calibrate` | Jeden kalibrační příkaz pro jeden modul. |
| `home_all` / `record_all` | Hromadné kalibrační pomůcky. |
| `save_playlist` / `delete_playlist` / `run_saved_playlist` | Správa pojmenovaných playlistů. |
| `set_settings` | Sloučí a uloží nastavení. |

## send_text

| Pole | Výchozí | Význam |
| --- | --- | --- |
| `text` | povinné | Text k zobrazení. Nové řádky začnou novou řadu. Maximum 4096 znaků. |
| `start` | `1` | Offset od 1: před text přidá `start - 1` mezer ještě před zalamováním. |
| `style` | `ltr` | Pořadí odesílání: `ltr`, `rtl`, `columns`, `center_out`, `outside_in`, `diagonal`, `random`, `rain`, `spiral`. |
| `speed` | `15` | Prodleva v ms na modul. Posílá se s příkazem display; současný firmware masteru ji ignoruje. |
| `stop` | `true` | Před zobrazením textu zastaví běžící aplikaci nebo playlist. |
| `raw` | `false` | Bere `text` jako hotovou tabuli: bez velkých písmen a bez zalamování. |

Běžný text se převede na velká písmena, zalomí na tabuli a vycentruje. Uvozovky
`"` se změní na `q`; barevná emoji na fyzické barevné lístky. Viz
[skládání textu](../protocol/text.md).

## notify

| Pole | Výchozí | Význam |
| --- | --- | --- |
| `text` | povinné | Zpráva k zobrazení, zalamovaná jako `send_text`. Maximum 4096 znaků. |
| `seconds` | `10` | Jak dlouho zpráva zůstane vidět (`0.5`–`300`). |
| `style` | `ltr` | Pořadí odesílání. Neznámý styl se změní na `ltr`. |
| `priority` | `0` | Vyšší priorita se zobrazí dřív. Stejné priority zachovají pořadí příchodu. |

Když běží aplikace nebo playlist, fronta se vybírá mezi stránkami a během
prodlev, takže pozice playlistu zůstane. Když je displej nečinný, zpráva se
zobrazí a předchozí tabule se potom obnoví. Fronta pojme až 50 položek a zahazuje
položky starší 300 sekund. `stop_app`, `start_app`, `play_playlist` a `send_text`
s `stop: true` (výchozí) vymažou čekající oznámení.

## play_playlist

| Pole | Výchozí | Význam |
| --- | --- | --- |
| `pages` | povinné | YAML seznam (skript) nebo JSON pole jako string (UI služby). Maximum 100 stránek. |
| `delay` | `5` | Sekundy po dokončení pohybu každé stránky. |
| `loop` | `true` | Opakovat do zastavení. |

Stránka je buď řetězec, nebo objekt s `text`, `delay`, `style`, `speed`, `raw`,
`resend` a `start`. Všechny stránky se před spuštěním ověří proti bubnům modulů a
pokud jedna stránka nejde zobrazit, zahodí se celý playlist.

## start_app a stop_app

| Pole | Význam |
| --- | --- |
| `app` | Klíč aplikace: `animations`, `clock`, `countdown`, `dashboard`, `date`, `stocks`, `weather`. |

Neznámá aplikace vyvolá chybu. Aplikace, která se nevejde do rozvržení, také
vyvolá chybu s uvedením požadavku. `stop_app` nemá pole a vymaže čekající
oznámení.

## calibrate

| Pole | Význam |
| --- | --- |
| `module` | ID modulu. |
| `action` | `goto`, `home`, `step`, `record`, `apply`, `clear_map`, `drum_write`, `get_pos`. |
| `index` | Index bubnu od 0. |
| `flap` | Znak pro `goto`, když není zadaný `index`. |
| `home_offset` | Kroky od hall senzoru k lístku 0 (`apply`). |
| `positions` | Mapa `index -> absolutní krok` (`apply`). `65535` vymaže jeden záznam. |
| `clear_map` | Před `apply` vymaže mapu EEPROM. |
| `steps` | Relativní kroky; převedou se na absolutní pozici. |
| `drum` | Přesně 64 znaků, bez zalomení (`drum_write`). |

`drum_write` počká, až modul nahlásí nový buben, a vrátí `verified: true` nebo
`verified: false`. Payload, který master u každé akce dostane, je v
[příkazech](../protocol/commands.md#calibrate).

## sync, scan, update

| Služba | Účinek |
| --- | --- |
| `sync` | Požádá master o znovupublikování stavu a snímku EEPROM. |
| `scan` | Plný sken RS485 sběrnice; výsledek dorazí jako nový status payload. |
| `update` | Obnoví známé moduly bez plného skenu sběrnice. |

## Správa playlistů

- `save_playlist` — `name`, `pages`, `delay`.
- `delete_playlist` — `name`.
- `run_saved_playlist` — spustí uložený playlist ve smyčce podle `name`.

## Hromadná kalibrace

- `home_all` — najede všemi moduly domů.
- `record_all` — uloží zadaný `index` na všech modulech.

## set_settings

Sloučí objekt `settings` a uloží ho. Klíče displeje mají ploché názvy; klíče
aplikací jmenný prostor, například `clock.clock_format`. Neznámé klíče se
ignorují, neukládají, a neplatná hodnota se přeskočí místo selhání celého volání.
Viz [panel a nastavení](panel.md#nastaveni).

## Kontrola znaků

Před publikováním:

- U každého modulu, který hlásí `flap_list`, se ověří znaky, které dostane.
- Mezery na zarovnání se ignorují.
- Moduly bez hlášeného `flap_list` se přeskakují, protože není proti čemu
  ověřovat.
- Chybějící znak vyvolá chybu s ID modulu a znakem a **nic** se neodešle.

## Viz také

- [YAML příklady](../automation/examples.md)
- [Entity](../use/entities.md)
- [Příkazy protokolu](../protocol/commands.md)
