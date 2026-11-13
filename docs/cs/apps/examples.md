# Příklady aplikací

> [← Přehled](../../../README.cs.md) · [🇬🇧 English](../../en/apps/examples.md)

Hotoví provideři a kontrolní postup. Referenci API najdete v
[tvorbě aplikace](authoring.md); klíče manifestu v
[manifestu aplikace](manifest.md).

## Text podle nastavení

```python
async def fetch(ctx, now):
    greeting = ctx.get_setting("greeting", "HELLO")
    return ctx.lines(greeting)
```

## Více stránek s prodlevami

```python
from ..models import Page


async def fetch(ctx, now):
    return [
        Page(ctx.lines("PART ONE"), delay=3),
        Page(ctx.lines("PART TWO"), delay=3, style="rtl"),
    ]
```

## Cachované HTTP

```python
import aiohttp

from ..models import Page


async def fetch(ctx, now):
    async def load():
        return await ctx.http_json("https://api.example.com/status")

    try:
        data = await ctx.async_cached("status", 60, load)
    except (aiohttp.ClientError, TimeoutError):
        return Page(ctx.lines("NO DATA"), delay=10)

    return Page(ctx.lines(str(data.get("value", "")).upper()), delay=10)
```

## Raw snímky animace

Snímky musí mít přesně `rows * cols` znaků. `ctx.lines()` je pro běžný text; raw
snímky sestavte sami:

```python
async def fetch(ctx, now):
    frame = ("r" * ctx.cols + " " * ctx.cols) * (ctx.rows // 2)
    frame = frame.ljust(ctx.rows * ctx.cols)[: ctx.rows * ctx.cols]
    return Page(frame, raw=True, delay=0.4, style="ltr")
```

## Použití jiné aplikace

```python
async def fetch(ctx, now):
    pages = await ctx.fetch_app("clock")
    return pages[:1]
```

`fetch_app` spustí provider druhé aplikace s kontextem vázaným na ni, takže se
použije její nastavení a cache.

## Testování

```bash
python3 -m py_compile custom_components/splitflap_os/*.py \
  custom_components/splitflap_os/apps/*.py \
  custom_components/splitflap_os/apps/*/app.py
python3 tests/test_apps.py
python3 tests/test_translations.py
python3 tests/test_layout.py
```

`tests/test_apps.py` pokrývá načítání registru, jmenné prostory nastavení,
`visible_when` a migraci starých klíčů. Pokud přidáte novou vlastnost manifestu,
rozšiřte tento test.

Ruční kontroly:

1. Reloadněte integraci.
2. Aplikace se objeví na záložce Apps se správnou ikonou a popisem.
3. Její nastavení se objeví v Settings → Apps a přežije reload.
4. Spusťte ji a ověřte stránky a prodlevy.
5. Otestujte ji na nejmenším podporovaném rozvržení, ne jen na široké tabuli.

## Kontrolní seznam

- [ ] Název složky a `key` se shodují a odpovídají `^[a-z][a-z0-9_]*$`.
- [ ] `manifest.json` se parsuje a deklaruje `name`, `icon`, `description`.
- [ ] `min_rows` / `min_cols` odpovídají tomu, co rozvržení skutečně potřebuje.
- [ ] `app.py` definuje `async def fetch(ctx, now)`.
- [ ] Text používá `ctx.lines()` a jen znaky ze standardního bubnu.
- [ ] Nastavení používají lokální klíče a `ctx.get_setting`.
- [ ] Síťová volání používají `ctx.async_cached` a ošetřují chyby.
- [ ] Jsou přítomné anglické i české překlady.
- [ ] Prochází `py_compile`, `test_apps.py` a `test_translations.py`.
- [ ] Aplikace byla otestována na úzkém i nízkém rozvržení.

## Viz také

- [Tvorba aplikace](authoring.md)
- [Manifest aplikace](manifest.md)
- [Rozvržení a geometrie](../protocol/layout.md#dostupnost-aplikaci)
