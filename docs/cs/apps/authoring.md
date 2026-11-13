# Tvorba aplikace

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/apps/authoring.md)

Tato stránka je kontrakt provideru: `fetch`, `Page`, `AppContext`, nastavení a
pravidla rozvržení. Klíče manifestu jsou v [manifestu aplikace](manifest.md);
hotové příklady a kontrolní seznam v [příkladech aplikací](examples.md).

## Kontrakt provideru

Loader soubor načte a hledá korutinu `fetch` na úrovni modulu. Starší název
`provider` je stále přijímaný jako fallback.

```python
async def fetch(ctx: AppContext, now: datetime):
    """Return a Page, a list of Pages, or None."""
```

- `ctx` je `AppContext`.
- `now` je timezone-aware, když je nastavené časové pásmo.
- Vraťte `None`, když se v tomto cyklu nemá nic zobrazit, jednu `Page`, nebo
  seznam stránek. Seznam se pro aplikaci stane playlistem.
- Provider se volá jednou za cyklus displeje. Pro síťová volání používejte cache.

## Page

`Page` je v `models.py` a importuje se jako `from ..models import Page`.

| Pole | Typ | Výchozí | Význam |
| --- | --- | --- | --- |
| `text` | string | `""` | Text stránky. Nové řádky začnou řady. |
| `delay` | float | `None` | Sekundy po dokončení stránky. Fallback je `default_delay`. |
| `raw` | bool | `False` | Hotová data tabule: bez velkých písmen, zalamování a přetékání. |
| `style` | string | `None` | Pořadí odesílání. Neznámé hodnoty se změní na `ltr`. |
| `speed` | int | `None` | Hint prodlevy na modul předávaný s příkazem display. |
| `resend` | bool | `False` | Pošle stejné znaky znovu, i když se nezměnily. |
| `start` | int | `0` | Offset před zalamováním ve znacích (zde od 0). |

Stránka může být i obyčejný řetězec nebo slovník se stejnými klíči; engine obojí
normalizuje přes `Page.from_dict`.

## AppContext

Provider nemůže sahat na MQTT, ukládání, kalibraci ani smyčku displeje. Dostane
úzký kontext.

| Člen | Typ | Význam |
| --- | --- | --- |
| `hass` | `HomeAssistant` | Pro `hass.states` a další čtení. |
| `board` | `(rows, cols)` | Velikost rámu. |
| `rows`, `cols` | int | Složky velikosti rámu. |
| `layout` | `Layout` | Rozvržené rozvržení včetně `error` a šířek řad. |
| `tz` | tzinfo nebo `None` | Nastavené časové pásmo. |
| `unit_system` | string | `metric` nebo `imperial`. |
| `active_app_mode` | string nebo `None` | Režim zvolený pro běžící aplikaci. |
| `session` | `aiohttp.ClientSession` | Sdílená HTTP session. |
| `http_timeout` | timeout | Sdílený HTTP timeout. |
| `get_setting(key, default=None)` | any | Přečte **lokální** klíč nastavení; jmenný prostor aplikace se použije automaticky. |
| `lines(*values)` | string | Naformátuje každou hodnotu na řádek šířky tabule a spojí novými řádky. |
| `async_cached(key, ttl, factory)` | any | Cache aplikace. `factory` je asynchronní callable. |
| `http_json(url, params=None, headers=None)` | any | JSON GET se sdílenou session a timeoutem. |
| `fetch_app(app_key, now=None)` | `list[Page]` | Spustí jinou registrovanou aplikaci s jejím vlastním kontextem. |

Pomocníci v `apps/common.py`:

- `split_csv(value)` — rozdělí nastavení oddělené čárkou na čisté řetězce.
- `as_float(value, default)` — tolerantní převod na float.

## Nastavení

- Pole deklarované jako `greeting` se uloží jako `<app>.greeting`, čte se přes
  `ctx.get_setting("greeting")` a zobrazí se na stránce nastavení aplikace.
- Dvě aplikace mohou deklarovat stejný lokální klíč bez kolize.
- Výchozí hodnoty pochází z manifestu a použijí se, když není nic uloženo.
- Když se aplikace odebere, její klíče ve jmenném prostoru zůstanou v úložišti,
  ale ignorují se, protože `set_settings` i UI přijímají jen registrované klíče.
- Staré ploché klíče se při prvním načtení migrují: plochý `clock_format` se
  zkopíruje do každé aplikace, která lokální `clock_format` deklaruje.

## Požadavky na rozvržení

`min_rows` a `min_cols` z manifestu se kontrolují proti výšce rámu a **nejužší
řadě**. Viz [dostupnost aplikací](../protocol/layout.md#dostupnost-aplikaci).

- `min_rows: 1, min_cols: 1` běží na jakémkoli platném rozvržení, i s jedním
  modulem.
- Pokud je rozvržení neplatné, zůstanou dostupné jen aplikace s oběma minimy `1`.
- Nepodporované aplikace se zobrazí zakázané s důvodem; spuštění vyvolá
  `ValueError`.
- Když se rozvržení změní během běhu aplikace a aplikace se už nevejde, engine ji
  zastaví.

Držte `min_cols` poctivé: text se zalamuje na šířku rámu, takže aplikace, která
počítá se širokou řadou, bude na úzkém rámu vypadat špatně.

## Načítání a reload

- Aplikace se načítají během `async_setup_entry` v executoru; neplatný import se
  zapíše do logu a přeskočí.
- Přidání nebo úprava složky vyžaduje reload integrace (nebo restart Home
  Assistantu).
- Registr řadí aplikace podle klíče; záložka Apps i entita select tento pořadí
  dodržují.

## Viz také

- [Manifest aplikace](manifest.md)
- [Příklady aplikací](examples.md)
- [Rozvržení a geometrie](../protocol/layout.md)
