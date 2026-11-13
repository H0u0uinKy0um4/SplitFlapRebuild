# Troubleshooting

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/automation/troubleshooting.md)

## Common mistakes

| Symptom | Cause |
| --- | --- |
| `Action splitflap.send_text not found` | Wrong domain. Use `splitflap_os.send_text`. |
| Service runs but nothing moves | No modules, wrong prefix, a layout mismatch, or a running app that resends its own text. Check the log and the panel. |
| `Cannot display: module N lacks 'X'` | The module's reported drum does not contain the character. Nothing was sent. |
| Text appears in the wrong place | Remember wrapping, vertical centring, and that `start` is a pre-wrap offset. |
| `raw` text is cut off | `raw` is a complete board; it is padded or truncated to `rows × cols`. |
| `pages` rejected in the UI | The service UI expects a JSON **string**, not a YAML list. |
| Notification disappears immediately | `send_text`, `start_app`, `play_playlist`, or `stop_app` cleared the queue. |
| `App cannot run on this display` | The layout is too small or invalid. Fix `row_counts`, `rows`, `cols`. |
| Script field is empty | Called through `script.turn_on` with `data:` instead of `variables:`. |
| `speed` has no effect | Current master firmware ignores it. |
| Czech diacritics are missing | The 64-flap drum has no accented letters. |
| Lower-case colour letters turn into capitals | Normal text is upper-cased. Use colour emoji or `raw: true`. |

## Display problems

| Symptom | Check |
| --- | --- |
| Status sensor `offline` | MQTT integration, topic prefix, and the retained `<prefix>/status` payload. The master heartbeats every 30 s; offline after 90 s. |
| `modules_count` stays `0` | No parsed status, or the bus was never scanned. Press **Scan bus**. |
| Layout error or disabled apps | **Settings → Display**: the row layout must describe every detected module and leave at most one row of blank cells. See [layout](../protocol/layout.md). |
| Old text after a restart | The last snapshot is restored; press **Sync** to refresh from the master. |
| Panel missing after install | Reload the integration once, then hard-refresh the browser. Check the log for `panel` or static-path errors. |
| Version warning | The master's `mqtt_compat` differs from `MQTT_COMPAT`. See [versioning](../protocol/versioning.md). |
| Module looks offline right after a move | Expected: moves block the bus and the refresh is deferred by 5 s. |

## Debug logging

```yaml
logger:
  logs:
    custom_components.splitflap_os: debug
```

Look for:

- `Published to splitflap/command/display` — the command left Home Assistant.
- `Cannot display: ...` — validation refused the text.
- `No status from Split-Flap ...` — the prefix or broker is wrong.
- `Split-Flap OS is not configured` — the config entry is not loaded.

## Script traces

**Settings → Scripts → your script → Traces** shows every variable, which
`choose` branch ran, and the exact error. This is faster than guessing from the
broker log: a failed service call never reaches MQTT.

## Check the broker

Subscribe to:

- `<prefix>/status` — the master's state.
- `<prefix>/command/#` — commands published by Home Assistant.

If no command appears, the problem is inside Home Assistant (service name,
condition, template, validation). If a command appears but the display does not
move, the problem is on the master or slave side (module IDs, blocking move, OTA
session, bus).

## Panel checks

- **Control** — send text and watch the preview.
- **Apps** — cards show why an app is unavailable.
- **Tuning → Commands** — module online state, home, goto, steps.
- **Settings → System** — connection details, versions, backup/restore.

## See also

- [Services](../use/services.md)
- [Protocol overview](../protocol/overview.md#diagnostics)
- [YAML examples](examples.md)
