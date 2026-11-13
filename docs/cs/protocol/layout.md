# Rozvržení a geometrie

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/layout.md)

Rozvržení popisuje skutečný displej, ne jen počet modulů. Určuje, které ID modulu
padne do které buňky rámu, a které aplikace mohou běžet.

## Rozvržení a ID modulů

```text
row_counts = 3,3,1     rám = 3 řady × 3 sloupce

řada 1: modul 1  modul 2  modul 3
řada 2: modul 4  modul 5  modul 6
řada 3:          modul 7
```

Pravidla:

- `row_counts` je počet modulů v každé řadě oddělený čárkou, shora dolů.
- `rows` / `cols` jsou rozměry rámu; `0` znamená odvodit.
- ID modulů se přidělují zleva doprava, pak shora dolů.
- Kratší řada se v rámu vycentruje.
- Rozvržení smí nechat nejvýše jednu řadu prázdných buněk. 7 modulů v rámu 3×3 je
  platné; 7 modulů v rámu 3×15 se odmítne.
- Uložené rozvržení, které neodpovídá zjištěnému počtu modulů, se odmítne a panel
  zobrazí chybu místo toho, aby tiše použil špatné moduly.

## Automatická velikost tabule

Když není nastavené explicitní rozvržení, `auto_board()` zvolí rám zjištěného
počtu:

| Modulů | Rám | Modulů | Rám |
| --- | --- | --- | --- |
| 24 | 2×12 | 45 | 3×15 |
| 30 | 2×15 | 48 | 4×12 |
| 32 | 2×16 | 50 | 5×10 |
| 36 | 3×12 | 54 | 3×18 |
| 40 | 4×10 | 56 | 4×14 |
| 42 | 3×14 | 60 | 4×15 |
| | | 64 | 4×16 |

- Do 12 modulů se zobrazí jako jedna řada.
- Ostatní počty použijí široký bannerový rám odvozený z počtu.
- Uživatel může pevně zadat jeden rozměr a druhý nechat automatický.

## Dostupnost aplikací

Aplikace deklarují `min_rows` a `min_cols` ve svém manifestu. Podpora se kontroluje
proti výšce rámu a **nejužší řadě**, ne proti průměrné šířce, takže neuspořádané
rozvržení jako `3,3,1` (nejužší řada 1) datové aplikace zakáže.

| Aplikace | Minimální rám |
| --- | --- |
| Animations | jakákoli velikost |
| Clock | 3 × 9 |
| Date | 3 × 11 |
| Dashboard | 3 × 11 |
| Weather | 3 × 10 |
| Stocks | 3 × 7 |
| Countdown | 3 × 12 |

- Textové stránky a barevné animace fungují na jakémkoli platném rozvržení, včetně
  jednoho modulu.
- Pokud je rozvržení neplatné, zůstanou dostupné jen aplikace s oběma minimy `1`.
- Nepodporované karty jsou zakázané s důvodem; spuštění z panelu nebo služby
  vyvolá `ValueError`.
- Když se běžící aplikace stane nepodporovanou kvůli změně rozvržení, engine ji
  zastaví.

## Souřadnicový systém a mapy pozic

- Modul počítá `pos` od náběžné hrany hall senzoru.
- Lístek `0` je na `homeOffset`.
- Když záznam mapy chybí, záložní pozice je
  `homeOffset + round(index * totalStepsPerRev / 64)`, modulo `totalStepsPerRev`.
- Integrace používá stejný vzorec při odhadu lístku.
- `record` s `index: 0` uloží aktuální pozici jako `map[0]` a předefinuje
  `homeOffset`.
- `0xFFFF` znamená „nenastaveno“. Integrace tyto záznamy vynechá a nikdy je
  nezobrazí jako naladěné. Explicitní `65535` v objektu `positions` u `calibrate`
  vymaže jeden záznam na modulu.
- Záporné nebo mimořádné záznamy se ignorují.

Pozice je mezi homingy na nasazeném firmwaru modulů otevřená smyčka. Firmware s
průběžným referencováním hall senzoru během pohybu vynuluje `pos` na náběžné hraně
při každém pohybu přes magnet a přepočítá zbývající vzdálenost, takže drift nemůže
přežít přejezd magnetu. Po mechanických změnách nebo špatném počtu otáček
každopádně znovu spusťte homing.

## Viz také

- [Příkazy](commands.md#calibrate)
- [Panel a nastavení](../use/panel.md)
- [Tvorba aplikace](../apps/authoring.md#pozadavky-na-rozvrzeni)
