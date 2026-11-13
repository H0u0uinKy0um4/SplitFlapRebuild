# Verze

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/protocol/versioning.md)

Existují dvě osy kompatibility, protože spolu mluví dva různé páry partnerů.

## Osy kompatibility

| Osa | Kontrakt | Kdo ji nese |
| --- | --- | --- |
| **BUS_COMPAT** | RS485 aplikační protokol a kontrakt vstupu do OTA | modul + master |
| **MQTT_COMPAT** | JSON schéma MQTT statusu a příkazů | master + Home Assistant |

Master obě strany propojuje, takže nese obě čísla. Protokol bootloaderu OTA je
**třetí, samostatné** číslo: `OTA_PROTOCOL_VERSION` (master) musí odpovídat
`BOOTLOADER_VERSION` (modul, `bootloader/src/protocol.h`). Nikdy ho nezahrnujte do
žádné z os kompatibility.

## Zobrazované verze

```text
modul    <bus>.<vydání>               1.0.1      bus 1, vydání 0.1
master   <bus>.<mqtt>.<vydání>        1.1.0.0    bus 1, mqtt 1, vydání 0.0
HA       <mqtt>.<vydání>              1.2.15     mqtt 1, vydání 2.15
```

## Kontroly

- `VERSION` v `const.py` musí mít major číslo rovné `MQTT_COMPAT`;
  hlídá to `tests/test_versions.py`.
- Integrace porovnává `mqtt_compat` masteru (s fallbackem na starší alias
  `compat`) s vlastním `MQTT_COMPAT`.
- Neshoda zobrazí upozornění, ale nezablokuje zobrazení, zrušení OTA ani reset
  modulu.
- Pokud master verzi vůbec nehlásí, panel ji označí jako neznámou a nebude
  předpokládat kompatibilitu.
- Generace sběrnice masteru je jen diagnostická; Home Assistant RS485 protokol
  přímo nikdy nemluví.

## Co zvyšovat

| Změna | Zvýšit |
| --- | --- |
| Oprava chyby, UI, nové volitelné pole, nový příkaz | jen vydání |
| Tvar RS485 příkazu/odpovědi, pravidla ID modulů, kontrakt vstupu do OTA | `FW_BUS_COMPAT` + `MASTER_BUS_COMPAT` |
| Odebrání nebo přejmenování MQTT JSON pole/akce, tvar snímku panelu | `MASTER_MQTT_COMPAT` + `MQTT_COMPAT` |
| Rámování bootloaderu, příkazy, CRC, boot politika | `OTA_PROTOCOL_VERSION` + `BOOTLOADER_VERSION` |

## Cache frontendu

Při změně jakéhokoli souboru frontendu zvyšte verzi v jednom kroku:

1. `custom_components/splitflap_os/manifest.json`
2. `custom_components/splitflap_os/const.py` (`VERSION`)
3. `custom_components/splitflap_os/frontend/constants.js`
4. každý import `?v=` u ES modulů

Seznam souborů a validační příkazy jsou ve [vývoji](../setup/development.md).

## Viz také

- [Vývoj](../setup/development.md)
- [Přehled protokolu](overview.md)
