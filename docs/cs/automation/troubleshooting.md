# Řešení potíží

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/automation/troubleshooting.md)

## Časté chyby

| Příznak | Příčina |
| --- | --- |
| `Action splitflap.send_text not found` | Špatná doména. Použijte `splitflap_os.send_text`. |
| Služba proběhne, ale nic se nehýbe | Žádné moduly, špatný prefix, nesouhlasné rozvržení, nebo běžící aplikace posílá vlastní text. Zkontrolujte log a panel. |
| `Cannot display: module N lacks 'X'` | Hlášený buben modulu znak neobsahuje. Nic se neodeslalo. |
| Text je na špatném místě | Pamatujte na zalamování, svislé centrování a že `start` je offset před zalamováním. |
| `raw` text je oříznutý | `raw` je celá tabule; doplní se nebo zkrátí na `řádky × sloupce`. |
| UI odmítne `pages` | UI služby očekává JSON **string**, ne YAML seznam. |
| Oznámení hned zmizí | `send_text`, `start_app`, `play_playlist` nebo `stop_app` vyprázdnily frontu. |
| `App cannot run on this display` | Rozvržení je příliš malé nebo neplatné. Upravte `row_counts`, `rows`, `cols`. |
| Pole skriptu je prázdné | Volání přes `script.turn_on` s `data:` místo `variables:`. |
| `speed` nemá žádný efekt | Současný firmware masteru ho ignoruje. |
| V textu chybí česká diakritika | 64lístkový buben nemá písmena s diakritikou. |
| Malá barevná písmena se změní na velká | Běžný text se převádí na velká písmena. Použijte barevná emoji nebo `raw: true`. |

## Problémy se zobrazením

| Příznak | Co zkontrolovat |
| --- | --- |
| Entita Status je `offline` | Integraci MQTT, prefix a retained zprávu `<prefix>/status`. Master posílá heartbeat každých 30 s; offline po 90 s. |
| `modules_count` zůstává `0` | Status se neparsuje, nebo sběrnice nebyla skenována. Stiskněte **Scan bus**. |
| Chyba rozvržení nebo zakázané aplikace | **Settings → Display**: rozvržení řad musí popsat všechny zjištěné moduly a nechat nejvýše jednu řadu prázdných buněk. Viz [rozvržení](../protocol/layout.md). |
| Po restartu je na tabuli starý text | Obnoví se poslední snímek; stiskněte **Sync** pro obnovení z masteru. |
| Panel po instalaci chybí | Jednou reloadněte integraci a obnovte stránku tvrdým refreshem. V logu hledejte chyby kolem `panel` nebo statické cesty. |
| Upozornění na verzi | `mqtt_compat` masteru se liší od `MQTT_COMPAT`. Viz [verze](../protocol/versioning.md). |
| Modul se po pohybu jeví offline | Očekávané: pohyby blokují sběrnici a obnovení se odkládá o 5 s. |

## Debug logování

```yaml
logger:
  logs:
    custom_components.splitflap_os: debug
```

Hledejte:

- `Published to splitflap/command/display` — příkaz opustil Home Assistant.
- `Cannot display: ...` — validace text odmítla.
- `No status from Split-Flap ...` — špatný prefix nebo broker.
- `Split-Flap OS is not configured` — konfigurační položka není načtená.

## Trasy běhu skriptu

**Nastavení → Skripty → váš skript → Trasy běhu** ukážou každou proměnnou, která
větev `choose` se provedla, a přesnou chybu. To je rychlejší než hádání z broker
logu: neúspěšné volání služby se do MQTT nikdy nedostane.

## Kontrola brokeru

Přihlaste se k:

- `<prefix>/status` — stav masteru.
- `<prefix>/command/#` — příkazy publikované Home Assistantem.

Pokud se neobjeví žádný příkaz, problém je v Home Assistantu (název služby,
podmínka, šablona, validace). Pokud se příkaz objeví, ale displej se nehýbe,
problém je na straně masteru nebo modulů (ID modulů, blokující pohyb, OTA relace,
sběrnice).

## Kontrola v panelu

- **Control** — pošlete text a sledujte náhled.
- **Apps** — karty ukážou, proč je aplikace nedostupná.
- **Tuning → Commands** — stav modulu, home, goto, kroky.
- **Settings → System** — informace o připojení, verze, záloha/obnova.

## Viz také

- [Služby](../use/services.md)
- [Přehled protokolu](../protocol/overview.md#diagnostika)
- [YAML příklady](examples.md)
