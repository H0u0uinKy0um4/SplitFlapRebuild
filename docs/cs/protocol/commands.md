# Příkazy

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/commands.md)

Každý příkaz je JSON objekt publikovaný na `<prefix>/command/<název>`. Příkazy
**nejsou** retained. Pravidla textu jsou v [textu](text.md), OTA v [OTA](ota.md)
a geometrie v [rozvržení](layout.md).

## display

```json
{"modules": [{"id": 1, "char": "H"}, {"id": 2, "char": "I"}], "speed": 15}
```

| Pole | Typ | Poznámky |
| --- | --- | --- |
| `modules` | array | Uspořádaný seznam objektů `{id, char}`. Pořadí pole **je** pořadí animace. |
| `modules[].id` | int | ID modulu. |
| `modules[].char` | string | Přesně jeden znak. Mezera je povolená a modul vyčistí. |
| `speed` | int | Volitelný hint prodlevy na modul. Současný firmware masteru ho ignoruje a používá vlastní časování sběrnice. |

Integrace posílá každý modul, který se mapuje na buňku tabule, včetně mezer, takže
je celý rám deterministický. Kontrola znaků probíhá v Home Assistantu před
publikováním:

- Ověřuje se `flap_list` každého modulu.
- Mezery na zarovnání se ignorují.
- Moduly bez hlášeného `flap_list` se přeskakují.
- Chybějící znak vyvolá chybu a **nic** se nepublikuje.

## sync

```json
{"action": "fetch_state"}
```

Požádá master o znovupublikování aktuálního stavu a snímku EEPROM.

## scan

```json
{"action": "scan"}
```

Plný sken RS485 sběrnice. Výsledek dorazí jako nový status payload s aktuálním
`modules_count` a polem `modules`.

## update

```json
{"action": "update_data"}
```

Obnoví známé moduly bez plného skenu sběrnice.

## calibrate

```json
{"action": "goto", "module": 3, "index": 5}
```

Společná pole:

| Pole | Typ | Poznámky |
| --- | --- | --- |
| `action` | string | Viz tabulka akcí. |
| `module` | int | ID modulu. |

| Akce | Payload | Chování |
| --- | --- | --- |
| `goto` | `index` nebo `flap` | Přesun na index bubnu (od 0) nebo na první lístek odpovídající `flap`. |
| `home` | — | Spustí homing. |
| `step` | `steps` | Relativní počet kroků, převedený na absolutní pozici z `current_step` a `total_steps` modulu. Pokud pozice není známá, zapíše varování a pošle hodnotu jako absolutní. |
| `record` | `index` | Uloží aktuální pozici jako záznam mapy pro daný index bubnu. Index `0` je podporovaný a předefinuje `home_offset`. |
| `apply` | `home_offset`, `positions`, `clear_map` | Zapíše mapu pozic do EEPROM. `positions` je `index -> absolutní krok`; `65535` (`0xFFFF`) záznam vymaže. `clear_map: true` mapu nejdřív vymaže. |
| `clear_map` | — | Vymaže mapu pozic v EEPROM. |
| `drum_write` | `drum` | Zapíše přesně 64 znaků, bez CR/LF. Integrace ověří čtení a vrátí `{ok, verified}`. |
| `get_pos` | — | Požádá modul o nahlášení aktuální pozice. |

Poznámky:

- Relativní krok se na straně modulu převede na absolutní `g<pos>`, aby záporná
  hodnota nemohla omotat buben.
- Záznamy `map_of_positions` se sentinelem `0xFFFF` se považují za nenastavené:
  vynechají se ze snímků, nikdy se nezobrazí jako naladěné a integrace použije
  odhadovanou pozici lístku.
- Záporné nebo mimořádné záznamy mapy se ignorují.
- Záznam indexu `0` je zamýšlený způsob, jak znovu vycentrovat lístek 0. Starý
  ničivý kompatibilní zápis `m<id>w0:0` byl odstraněn.
- Pohyby jsou blokující. Master odkládá obnovení stavu po pohybu o 5 s
  (`MOVE_SETTLE_MS`); neptejte se modulu hned po `goto`/`home`/`step`/`apply`,
  jinak se může jevit jako offline.

## Viz také

- [Přehled protokolu](overview.md)
- [Skládání textu](text.md)
- [OTA modulů](ota.md)
- [Rozvržení a geometrie](layout.md)
