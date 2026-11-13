# OTA modulů

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/ota.md)

Panel flashuje modul přes RS485. Master vlastní rámování bootloaderu; Home
Assistant posílá jen base64 části aplikačního obrazu.

## Příkazy

Publikují se na `<prefix>/command/firmware`:

| Akce | Payload | Poznámky |
| --- | --- | --- |
| `begin` | `{"action": "begin", "module": 3}` | Začne sbírat obraz. Opakované `begin` restartuje přerušený sběr. |
| `chunk` | `{"action": "chunk", "data": "<base64>"}` | Přidá bajty obrazu. `data` je base64 surové části aplikačního obrazu. |
| `flash` | `{"action": "flash"}` | Vstoupí do bootloaderu a flashne sebraný obraz. Blokuje smyčku displeje přibližně 20–25 s. |
| `cancel` | `{"action": "cancel"}` | Zruší aktivní relaci nebo zahodí sebraný obraz. |
| `reset` | `{"action": "reset", "module": 3}` | Spustí modul uvíznutý v bootloaderu zpět do aplikace. |

## Omezení obrazu

- Aplikační oblast začíná na `0x0800`; boot sekce má 2 KB.
- Maximální velikost aplikace je **14336 bajtů** ve stránkách po 64 bajtech.
- Home Assistant posílá **768 bajtů obrazu na chunk** (1024 znaků base64), což se
  pohodlně vejde do 2048bajtového MQTT bufferu masteru.
- Obraz musí být surová aplikační oblast buildu `ATtiny1616_OTA` modulu, linkovaná
  na `0x0800`.
- OTA odmítne neznámý protokol bootloaderu ještě před zápisem první stránky.

## Objekt ve statusu

Publikuje se uvnitř `<prefix>/status` jako `ota`:

```json
{"ota": {"state": "flashing", "module": 3, "progress": 42, "received": 9216}}
```

| Pole | Typ | Význam |
| --- | --- | --- |
| `state` | string | `idle`, `collecting`, `entering`, `flashing`, `verifying`, `done`, `cancelled` nebo `failed`. |
| `module` | int | Cílový modul během relace. |
| `progress` | int | 0–100 během sběru nebo flashování. |
| `received` | int | Dosud přijaté bajty obrazu. |
| `error` | string | Přítomné, když relace selhala. |

Neznámé stavy se převedou na `idle`; pole špatného typu se zahodí.

## Chování relace

Během aktivní relace (`collecting`, `entering`, `flashing`, `verifying`) master
odmítá příkazy display, scan, update a calibrate a druhý upload se odmítne. Modul
uvíznutý v bootloaderu už neodpovídá na ASCII sken, takže `reset` je cesta
k obnově.

## Rozhraní v Home Assistantu

Pro OTA neexistuje služba. Panel používá WebSocket příkazy
`splitflap_os/flash_firmware`, `splitflap_os/cancel_firmware` a
`splitflap_os/reset_firmware`. Topic je zde zdokumentovaný, protože je součástí
MQTT kontraktu.

## Viz také

- [Přehled protokolu](overview.md)
- [Příkazy](commands.md)
- [Verze](versioning.md)
