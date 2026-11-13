# Přehled protokolu

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/overview.md)

Tato stránka pokrývá role, MQTT připojení a status payload. Payloady příkazů jsou
v [příkazech](commands.md); geometrie tabule v [rozvržení](layout.md); čísla
kompatibility ve [verzích](versioning.md).

Drátový protokol mezi masterem a moduly (RS485 rámování, escapování v
bootloaderu, CRC) patří do repozitářů firmwaru. Home Assistant s ním nikdy nemluví
přímo, takže tato stránka popisuje jen to, co prochází přes MQTT.

## Role a hranice

```text
Home Assistant                         ESP32 master                 Moduly
┌───────────────────────────┐  MQTT    ┌──────────────┐   RS485     ┌────────┐
│ Integrace Split-Flap OS   │ ───────> │ command/*    │ ──────────> │ modul  │
│ engine + aplikace + panel │ <─────── │ status       │ <────────── │ modul  │
└───────────────────────────┘          └──────────────┘             └────────┘
```

- **Home Assistant** skládá text, zalamuje ho na tabuli, spouští aplikace a
  playlisty, ověřuje znaky, ukládá nastavení a publikuje příkazy.
- **Master** vlastní RS485 sběrnici, provádí sken a kalibraci, plánuje pohyby
  modulů, sleduje pozice a publikuje stav. Pohyby jsou na straně modulů
  **blokující**.
- **Moduly** jsou adresované číselným ID a zobrazují jeden znak.

Je povolena jen jedna konfigurační položka, protože firmware je jeden master.

## MQTT připojení

| Nastavení | Výchozí | Poznámky |
| --- | --- | --- |
| Topic prefix | `splitflap` | Volitelný při instalaci. Nesmí být prázdný ani obsahovat `+` / `#`. |
| Status topic | `<prefix>/status` | JSON, master ho publikuje jako retained. |
| Příkazové topicy | `<prefix>/command/{display,sync,scan,update,calibrate,firmware}` | JSON, ne retained. |

Integrace odebírá status topic a po **90 sekundách** bez zprávy označí master jako
offline. Master publikuje heartbeat každých **30 sekund**.

Pokud se nakonfigurovaný prefix liší od prefixu masteru, Home Assistant nedostává
status, `modules_count` zůstává `0` a příkazy publikuje na topic, který nikdo
nečte. Panel zobrazí master jako offline a seznam modulů je prázdný.

## Stavový payload

Základní tvar (zkráceno):

```json
{
  "state": "online",
  "text": "HELLO",
  "version": "1.1.0.0",
  "bus_compat": 1,
  "mqtt_compat": 1,
  "compat": 1,
  "scanning": false,
  "modules_count": 7,
  "modules": [
    {
      "id": 1,
      "state": "online",
      "online": true,
      "total_steps": 4096,
      "status": 1,
      "home_offset": 2832,
      "auto_homing": true,
      "current_step": 3616,
      "pos": 3616,
      "current_index": 1,
      "busy": false,
      "position_known": true,
      "flap_list": " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw",
      "map_of_positions": {"0": 2832, "1": 2896},
      "flap": "H",
      "fw_version": "1.0.1",
      "fw_bus_compat": 1,
      "fw_bus_compatible": true,
      "fw_compat": 1,
      "fw_compatible": true
    }
  ],
  "ota": {"state": "idle"}
}
```

### Pole nejvyšší úrovně

| Pole | Typ | Význam |
| --- | --- | --- |
| `state` | string | `online` / `offline`, jak hlásí master. |
| `text` | string | Poslední text, který master zobrazil. |
| `version` | string | Verze firmwaru masteru, `<bus>.<mqtt>.<vydání>`. |
| `bus_compat` | int | Generace RS485 aplikačního protokolu masteru. |
| `mqtt_compat` | int | Generace MQTT schématu masteru. |
| `compat` | int | Starší alias pro `mqtt_compat`. |
| `scanning` | bool | Probíhá sken sběrnice. |
| `modules_count` | int | Počet modulů, které master zná. Řídí velikost tabule. |
| `modules` | array | Objekty modulů, viz níže. |
| `ota` | object | Stav OTA relace; viz [OTA modulů](ota.md). |

### Pole modulu

| Pole | Typ | Význam |
| --- | --- | --- |
| `id` | int | ID modulu na sběrnici. |
| `state` | string | Stav modulu hlášený modulem. |
| `online` | bool | Master považuje modul za dostupný. |
| `total_steps` | int | Kroků na celou otáčku. |
| `home_offset` | int | Kroků od náběžné hrany hall senzoru k lístku index `0`. |
| `current_step` | int | Aktuální absolutní pozice v krocích. |
| `current_index` | int | Index lístku z mapy pozic, nebo z lineárního vzorce. |
| `flap` | string | Nejlepší známý znak; není to skutečné čtení. |
| `flap_list` | string | Buben modulu, po nahlášení přesně 64 znaků. |
| `map_of_positions` | object | Volitelná mapa EEPROM `index -> absolutní krok`. |
| `position_known` | bool | Modul hlásí platnou známou pozici. |
| `busy` | bool | V současném firmwaru vždy `false`, protože pohyby jsou blokující. |
| `auto_homing` | bool | Nastavení automatického homingu modulu. |
| `status` | int | Surový stavový kód modulu. |
| `fw_version` | string | Verze aplikace modulu, `<bus>.<vydání>`. |
| `fw_bus_compat` | int | Generace sběrnice modulu. |
| `fw_bus_compatible` | bool | Přítomné, když modul hlásí verzi. |
| `fw_compat` / `fw_compatible` | int / bool | Starší aliasy pro hodnoty sběrnice. |

Koordinátor přijímá kvůli robustnosti několik aliasů (`flapList`, `drum`, `pos`,
`steps_per_rev`, `positionMap`, `firmwareVersion` a další). Tabulka uvádí
kanonické názvy; nový firmware by měl publikovat ty.

Pole `actual_flap` a `desired_flap` vznikají až v integraci pro panel. Nejsou
součástí MQTT payloadu.

### Poznámka k pozici

`flap` je **nejlepší znalost** masteru, ne skutečné čtení:

- Když je `position_known` true, master odvodí lístek z mapy pozic, nebo z
  lineárního vzorce, pokud mapa záznam nemá, a publikuje ho spolu s
  `current_index`.
- Jinak použije naposledy požadovaný znak.

Na nasazeném (starším) firmwaru modulů je pozice mezi homingy otevřená smyčka,
takže `position_known` je důvěryhodné jen s firmwarem, který při každém pohybu
znovu referencuje náběžnou hranu hall senzoru. Viz
[rozvržení](layout.md#souradnicovy-system-a-mapy-pozic).

## Diagnostika

| Příznak | Pravděpodobná příčina |
| --- | --- |
| Entita Status je `offline` | Špatný prefix, odpojené MQTT nebo chybějící retained status. |
| `modules_count` zůstává `0` | Status se neparsuje, nebo sběrnice nebyla skenována. |
| Příkazy se publikují, ale nic se nehýbe | Master ignoroval ID modulů, nebo ještě probíhá blokující pohyb. Počkejte ~5 s. |
| Modul se po pohybu jeví offline | Očekávané: obnovení se odkládá o 5 s. |
| `Cannot display: module N lacks 'X'` | Hlášený buben znak neobsahuje. Nic se neodeslalo. |
| OTA odmítnuta | Běží jiná relace, obraz je příliš velký nebo je neznámý protokol bootloaderu. |
| Upozornění na verzi | `mqtt_compat` masteru se liší od `MQTT_COMPAT`. |

Více v [řešení potíží](../automation/troubleshooting.md).
