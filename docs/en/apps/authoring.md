# Writing an app

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/apps/authoring.md)

This page is the provider contract: `fetch`, `Page`, `AppContext`, settings, and
layout rules. Manifest keys are in [app manifest](manifest.md); worked examples
and the test checklist are in [app examples](examples.md).

## Provider contract

The loader imports `app.py` and looks for a module-level `fetch` coroutine. The
older name `provider` is still accepted as a fallback.

```python
async def fetch(ctx: AppContext, now: datetime):
    """Return a Page, a list of Pages, or None."""
```

- `ctx` is an `AppContext`.
- `now` is timezone-aware when a timezone is configured.
- Return `None` to show nothing this cycle, one `Page`, or a list of pages. A list
  becomes a playlist for that app.
- The provider is called once per display cycle. Use caching for network calls.

## Page

`Page` lives in `models.py` and is imported as `from ..models import Page`.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `text` | string | `""` | Page text. Newlines start rows. |
| `delay` | float | `None` | Seconds after the page finishes. Falls back to `default_delay`. |
| `raw` | bool | `False` | Complete board data: no upper-casing, wrapping, or reflow. |
| `style` | string | `None` | Send order. Unknown values fall back to `ltr`. |
| `speed` | int | `None` | Per-module delay hint forwarded with the display command. |
| `resend` | bool | `False` | Send the same characters again even if they did not change. |
| `start` | int | `0` | Pre-wrap offset in characters (0-based here). |

A page can also be a plain string or a dict with the same keys; the engine
normalizes both with `Page.from_dict`.

## AppContext

Providers cannot touch MQTT, persistence, calibration, or the display loop. They
get a narrow context instead.

| Member | Type | Meaning |
| --- | --- | --- |
| `hass` | `HomeAssistant` | For `hass.states` and other read-only access. |
| `board` | `(rows, cols)` | Frame size. |
| `rows`, `cols` | int | Frame size components. |
| `layout` | `Layout` | Resolved layout, including `error` and per-row widths. |
| `tz` | tzinfo or `None` | Configured timezone. |
| `unit_system` | string | `metric` or `imperial`. |
| `active_app_mode` | string or `None` | Mode selected for the running app. |
| `session` | `aiohttp.ClientSession` | Shared HTTP session. |
| `http_timeout` | timeout | Shared HTTP timeout. |
| `get_setting(key, default=None)` | any | Read a **local** setting key; the app namespace is applied automatically. |
| `lines(*values)` | string | Format each value into a board-width line and join with newlines. |
| `async_cached(key, ttl, factory)` | any | Per-app cache. `factory` is an async callable. |
| `http_json(url, params=None, headers=None)` | any | JSON GET with the shared session and timeout. |
| `fetch_app(app_key, now=None)` | `list[Page]` | Run another registered app with its own context. |

Helpers in `apps/common.py`:

- `split_csv(value)` — split a comma-separated setting into clean strings.
- `as_float(value, default)` — tolerant float conversion.

## Settings

- A field declared as `greeting` is stored as `<app>.greeting`, read with
  `ctx.get_setting("greeting")`, and shown on the app's settings page.
- Two apps may declare the same local key without colliding.
- Defaults come from the manifest and apply when no value is stored.
- When an app is removed, its namespaced keys stay in storage but are ignored,
  because `set_settings` and the settings UI only accept registered keys.
- Legacy flat keys are migrated on first load: a flat `clock_format` is copied
  into every app that declares a local `clock_format`.

## Layout requirements

`min_rows` and `min_cols` in the manifest are checked against the frame height and
the **narrowest row**. See [app availability](../protocol/layout.md#app-availability).

- `min_rows: 1, min_cols: 1` runs on any valid layout, including one module.
- If the layout is invalid, only apps with both minimums at `1` stay available.
- Unsupported apps are shown disabled with the reason; starting one raises
  `ValueError`.
- If the layout changes while an app runs and the app no longer fits, the engine
  stops it.

Keep `min_cols` honest: text is wrapped to the frame width, so an app that assumes
a wide row will look broken on a narrow frame.

## Loading and reloading

- Apps are loaded during `async_setup_entry` in an executor; a bad import is
  logged and skipped.
- Adding or editing a folder requires reloading the integration (or restarting
  Home Assistant).
- The registry sorts apps by key; the Apps tab and the select entity follow that
  order.

## See also

- [App manifest](manifest.md)
- [App examples](examples.md)
- [Layout and geometry](../protocol/layout.md)
