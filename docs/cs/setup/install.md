# Instalace

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/setup/install.md)

## Požadavky

- Home Assistant **2024.11** nebo novější.
- Integrace **MQTT** nastavená a připojená ke brokeru, který používá master.
  Integrace si MQTT klienta nenese.
- Firmware SplitFlap Master, který publikuje `<prefix>/status` (JSON, retained)
  a odebírá `<prefix>/command/{display,sync,scan,update,calibrate,firmware}`.
- MQTT topic prefix, který master používá. Výchozí firmware používá `splitflap`.

## HACS (vlastní repozitář)

1. V HACS přidejte tento repozitář jako vlastní repozitář typu **Integration**.
2. Nainstalujte **Split-Flap OS**.
3. Restartujte Home Assistant.
4. Jděte na **Nastavení → Zařízení a služby → Přidat integraci → Split-Flap OS**.

## Ručně

Zkopírujte `custom_components/splitflap_os` do složky
`config/custom_components/` v Home Assistantu a restartujte. Potom integraci
přidejte v uživatelském rozhraní.

Panel v postranním menu se registruje automaticky přes `panel_custom`; žádný
záznam v Lovelace není potřeba.

## Nastavení připojení

| Pole | Výchozí | Poznámky |
| --- | --- | --- |
| MQTT topic prefix | `splitflap` | Nesmí být prázdný ani obsahovat `+` nebo `#`. |
| Název displeje | `Split-Flap Display` | Používá se v názvech entit a v `entity_id`. |

Je povolena jen **jedna** konfigurační položka, což odpovídá firmwaru s jedním
masterem. Přidání druhé skončí chybou `single_instance_allowed`.

Obě hodnoty lze později změnit v dialogu **Konfigurovat**. Po uložení se položka
znovu načte; přejmenování displeje nemění `entity_id`.

## První spuštění

1. Přidejte integraci a ověřte, že entita **Status** je `online`. Master publikuje
   heartbeat každých 30 sekund a integrace ho označí jako offline po 90 sekundách
   bez zprávy.
2. Otevřete panel **Split-Flap OS**, jděte na **Tuning → Commands** a stiskněte
   **Scan bus**, pokud je počet modulů `0`.
3. Pokud automaticky zjištěný rám neodpovídá fyzickému tvaru, nastavte
   `row_counts` (například `3,3,1`), `rows` a `cols` v **Settings → Display**.
   Viz [rozvržení](../protocol/layout.md).
4. Pošlete krátký text z **Control** a ověřte, že se moduly pohnou.

## Ověření

- **Nastavení → Zařízení a služby → Entity** vypisuje senzory, tlačítka,
  textovou entitu a entitu pro výběr aplikace. Viz [entity](../use/entities.md).
- Panel je v postranním menu; samostatný dashboard není potřeba.
- Atributy entity **Status** ukazují MQTT prefix, počet modulů a poslední status
  payload.

## Aktualizace

1. Aktualizujte přes HACS (nebo nahraďte `custom_components/splitflap_os`).
2. Restartujte Home Assistant.
3. Obnovte stránku tvrdým refreshem (Ctrl/Cmd+Shift+R), aby se moduly panelu
   nenačetly z cache service workeru.
4. Ověřte verzi v **Settings → System** a v atributech statusu.

Nastavení, nastavení aplikací, playlisty a poslední snímek modulů jsou v `Store`
Home Assistantu pod konfigurační položkou a aktualizace přežijí. Odebrání položky
smaže oba store.

## Kam dál

- [Panel a nastavení](../use/panel.md)
- [Služby](../use/services.md)
- [YAML příklady](../automation/examples.md)
- [Řešení potíží](../automation/troubleshooting.md)
