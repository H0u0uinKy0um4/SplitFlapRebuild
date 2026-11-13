# App examples

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/apps/examples.md)

Worked providers and the check routine. The API reference is in
[writing an app](authoring.md); manifest keys are in
[app manifest](manifest.md).

## Setting-driven text

```python
async def fetch(ctx, now):
    greeting = ctx.get_setting("greeting", "HELLO")
    return ctx.lines(greeting)
```

## Multi-page with delays

```python
from ..models import Page


async def fetch(ctx, now):
    return [
        Page(ctx.lines("PART ONE"), delay=3),
        Page(ctx.lines("PART TWO"), delay=3, style="rtl"),
    ]
```

## Cached HTTP

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

## Raw animation frames

Frames must be exactly `rows * cols` characters. `ctx.lines()` is for normal
text; build raw frames yourself:

```python
async def fetch(ctx, now):
    frame = ("r" * ctx.cols + " " * ctx.cols) * (ctx.rows // 2)
    frame = frame.ljust(ctx.rows * ctx.cols)[: ctx.rows * ctx.cols]
    return Page(frame, raw=True, delay=0.4, style="ltr")
```

## Reusing another app

```python
async def fetch(ctx, now):
    pages = await ctx.fetch_app("clock")
    return pages[:1]
```

`fetch_app` runs the other app's provider with a context bound to that app, so its
settings and cache are used.

## Testing

```bash
python3 -m py_compile custom_components/splitflap_os/*.py \
  custom_components/splitflap_os/apps/*.py \
  custom_components/splitflap_os/apps/*/app.py
python3 tests/test_apps.py
python3 tests/test_translations.py
python3 tests/test_layout.py
```

`tests/test_apps.py` covers registry loading, namespaced settings,
`visible_when`, and the legacy migration. If you add a manifest feature, extend
that test.

Manual checks:

1. Reload the integration.
2. The app appears on the Apps tab with the expected icon and description.
3. Its settings appear under Settings → Apps and persist across a reload.
4. Start it and confirm the pages and delays.
5. Test on the smallest supported layout, not only on a wide board.

## Checklist

- [ ] Directory name and `key` match and use `^[a-z][a-z0-9_]*$`.
- [ ] `manifest.json` parses and declares `name`, `icon`, `description`.
- [ ] `min_rows` / `min_cols` match what the layout actually needs.
- [ ] `app.py` defines `async def fetch(ctx, now)`.
- [ ] Text uses `ctx.lines()` and only characters from the stock drum.
- [ ] Settings use local keys and `ctx.get_setting`.
- [ ] Network calls use `ctx.async_cached` and handle failures.
- [ ] English and Czech translations are both present.
- [ ] `py_compile`, `test_apps.py`, and `test_translations.py` pass.
- [ ] The app was tested on a narrow and a short layout.

## See also

- [Writing an app](authoring.md)
- [App manifest](manifest.md)
- [Layout and geometry](../protocol/layout.md#app-availability)
