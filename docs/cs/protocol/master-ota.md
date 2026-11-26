# OTA masteru

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/master-ota.md)

Panel umí aktualizovat i samotný ESP32 master. Jde o samostatný kanál oproti
[OTA modulů](ota.md): master flashuje svou vlastní aplikaci přes MQTT, zatímco
aktualizace modulů běží přes RS485 bootloader. Home Assistant nikdy nemluví
RS485 a nepoužívá ruční ArduinoOTA port.

Aktualizace masteru vyžaduje firmware masteru s `mqtt_compat` 2 (například
`1.2.0.0`) a tuto integraci s `MQTT_COMPAT` 2 (`2.0.1`). Starší mastery dál
normálně zobrazují a aktualizují moduly; karta OTA masteru se zobrazí, ale
kompatibilita může varovat nebo zápis zablokovat.

## Bezpečnostní model

- Přijímají se pouze **aplikace ESP32 ve formátu `.bin`**. Master ji zapíše do
  jednoho ze dvou OTA oddílů a při neúspěšném startu se automaticky vrátí na
  předchozí. Stávající ArduinoOTA slouží jen k **ručnímu obnovení**, ne k
  aktualizaci z panelu.
- Master smí mít v jednu chvíli jen jednu firmware operaci. Běžící
  [OTA modulů](ota.md#chovani-relace) blokuje zápis do masteru a naopak.
- Home Assistant před odesláním každého bloku ověří SHA-256. Master ověří
  napsaná data a potvrdí úspěšný start.
- Úspěchem není „příkazy byly odeslány“, ale to, že se master do **pěti minut**
  znovu připojil s očekávanou verzí. Místní zápis bez očekávané verze je
  povolený, ale upozorní a potvrdí jen znovupřipojení.
- Panel před zápisem žádá potvrzení. **Zrušit** je dostupné jen během přijímání
  obrazu; po odeslání `flash` se master sám restartuje a na tomto topicu proto
  záměrně není žádná akce `reset`.

## Příkazy

Publikují se na `<prefix>/command/master_firmware` jako JSON (ne retained):

| Akce | Payload | Poznámky |
| --- | --- | --- |
| `begin` | `{"action": "begin", "version": "1.2.0.0", "sha256": "<64 hex>", "size": 524288}` | Začne přijímat obraz. `version` může být prázdná u místního obrazu s neznámou verzí. |
| `chunk` | `{"action": "chunk", "data": "<base64>"}` | Připojí surové bajty obrazu. Home Assistant posílá 768 bajtů na blok (1024 znaků base64). |
| `flash` | `{"action": "flash"}` | Ověří a aplikuje obraz; master se automaticky restartuje. |
| `cancel` | `{"action": "cancel"}` | Zruší přijímání obrazu. Přijímá se jen během shromažďování. |

Akce `reset` neexistuje: při neúspěšném startu se master vrátí na předchozí
oddíl a ruční obnovení vede přes ArduinoOTA (níže). Home Assistant přijme
aplikaci do velikosti **1,875 MiB** (1 966 080 bajtů, jeden OTA oddíl masteru)
a odmítne obraz, jehož kontrolní součet neodpovídá. Publikovaný obraz
`mqtt-compat-2` má 1 477 664 bajtů, takže se bez problémů vejde.

## Stavový objekt

Master publikuje `master_ota` uvnitř `<prefix>/status`, vedle nezměněného objektu
`ota` pro moduly:

```json
{
  "version": "1.2.0.0",
  "bus_compat": 1,
  "mqtt_compat": 2,
  "ip": "10.0.1.42",
  "ota": {"state": "idle"},
  "master_ota": {
    "state": "collecting",
    "progress": 40,
    "received": 2048,
    "size": 5120,
    "version": "1.2.0.0",
    "target_version": "1.2.1.0",
    "error": null
  }
}
```

| Pole | Typ | Význam |
| --- | --- | --- |
| `state` | string | `idle`, `collecting`, `applying`, `rebooting`, `done`, `failed` nebo `cancelled`. |
| `progress` | int | 0–100 během přijímání a zápisu. |
| `received` | int | Dosud přijaté bajty obrazu. |
| `size` | int | Očekávaná velikost obrazu v bajtech. |
| `version` | string | Verze aktuálně spuštěná na masteru. |
| `target_version` | string | Verze připraveného obrazu, pokud je známá. |
| `error` | string | Přítomné při selhání relace. |

Neznámé stavy se převedou na `idle`. `ip` je doplňující diagnostická informace
pro obnovení; panel se na něj nepřipojuje. Zbytek status payloadu je v
[přehledu](overview.md#stavovy-payload).

## Publikované verze

Repozitář masteru publikuje na GitHub Releases `firmware.bin` a vygenerovaný
manifest `firmware.json`. Push aktualizuje průběžnou `dev` verzi, tagy tvoří
neměnné stabilní verze. Manifest masteru vypadá takto:

```json
{
  "schema": 1,
  "kind": "master-app",
  "channel": "stable",
  "version": "1.2.0.0",
  "mqtt_compat": 2,
  "bus_compat": 1,
  "image": "firmware.bin",
  "sha256": "<64 hex>",
  "notes": "dual OTA partitions with rollback"
}
```

`kind: "master-app"` odděluje tyto verze od seznamu modulů, který používá
`slave-app` a soubor `.hex`. `bus_compat` je zde jen diagnostický: generace
RS485 masteru se kontroluje při zápisu do modulů, ne při aktualizaci masteru.

Než Home Assistant povolí zápis do masteru, porovná `mqtt_compat` verze
**s oběma** hodnotami – s vlastním `MQTT_COMPAT` i s `mqtt_compat` připojeného
masteru (se starším aliasem `compat`). Známá neshoda zápis zablokuje, neznámá
generace masteru upozorní a ladící přepínač
`Debug: allow incompatible firmware` může známou neshodu pro vývoj snížit na
upozornění. Samotné publikování verze bránu neobchází.

## Rozhraní v panelu

Ovládání je v **Nastavení → Systém → OTA masteru**. Výběr verze zobrazuje
publikované verze masteru, nejprve stabilní, pak nejnovější `dev`; HASC stáhne
`.bin` až při zápisu a ověří kontrolní součet. **Místní BIN (pokročilé)** přijímá
místně sestavenou aplikaci `firmware.bin` s volitelnou očekávanou verzí. Průběh
a odpočet znovupřipojení zůstávají v této podzáložce; globální odznak není. Viz
[příručka panelu](../use/panel.md#ota-masteru).

Ve verzi 1 nejde o službu pro automatizace. WebSocket příkazy jsou
`splitflap_os/list_master_firmware_releases`,
`splitflap_os/flash_master_firmware_release`, `splitflap_os/flash_master_firmware`
a `splitflap_os/cancel_master_firmware`.

## Ruční obnovení

Pokud master po aktualizaci přestane odpovídat na MQTT, použijte ArduinoOTA ze
sestavovacího prostředí masteru: hostitel `SplFlp_Master`, port **3232** a heslo
z příznaku sestavení `OTA_PASSWORD`. Tato cesta slouží jen k ručnímu obnovení;
panel ji nikdy nepoužije. Úspěšná aktualizace masteru se restartuje sama, bez
tlačítka spuštění.

## Viz také

- [OTA modulů](ota.md)
- [Příkazy](commands.md)
- [Přehled protokolu](overview.md)
- [Verze](versioning.md)
- [Panel a nastavení](../use/panel.md)
- [Řešení potíží](../automation/troubleshooting.md)
