# Skládání textu

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/text.md)

Stejná pravidla platí pro `send_text`, `notify`, playlisty, textovou entitu a
stránky aplikací.

## Pravidla

1. **Velká písmena** u běžného textu. `raw` stránky zachovávají velikost.
2. **Uvozovky** `"` se posílají jako lístek `q`.
3. **Barevná emoji** se převedou na malé barevné lístky firmwaru:
   🟥→`r`, 🟧→`o`, 🟨→`y`, 🟩→`g`, 🟦→`b`, 🟪→`p`, ⬜→`w`, ⬛→mezera.
4. **Zalomení** každého odstavce na šířku rámu. Řádky nad výšku rámu se zahodí.
5. **Vycentrování** bloku svisle a každého řádku vodorovně.
6. **`start`** přidá před text `start - 1` mezer, takže `1` znamená bez posunu.
7. **`raw`** bere text jako hotovou tabuli: nové řádky se odstraní, řetězec se
   doplní mezerami na `řádky × sloupce` a delší se zkrátí.

## Buben

Standardní buben má přesně **64 lístků**:

```text
 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw
```

- Malé `roygbpw` jsou fyzické barevné lístky.
- Buben **neobsahuje česká písmena s diakritikou**, takže pište bez ní
  (`PRACKA HOTOVA`).
- Buben se nikdy nedoplňuje mezerami na 64 znaků; kratší override se odmítne.
- Zalomení řádku se u `drum_write` odmítá, protože by ukončilo RS485 příkaz.

## Kontrola

Před publikováním se u každého modulu ověří `flap_list` proti znakům, které
dostane. Mezery na zarovnání se ignorují, moduly bez hlášeného seznamu se
přeskakují a chybějící znak zruší celé publikování. Viz
[display](commands.md#display).

## Viz také

- [Příkazy](commands.md)
- [Rozvržení a geometrie](layout.md)
- [Služby](../use/services.md)
