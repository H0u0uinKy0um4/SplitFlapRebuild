# Text composition

> [← Docs](../../../README.md) · [🇨🇿 Česky](../../cs/protocol/text.md)

The same rules apply to `send_text`, `notify`, playlists, the text entity, and app
pages.

## Rules

1. **Upper-case** normal text. `raw` pages keep their case.
2. **Quotes** `"` are sent as the drum's `q` flap.
3. **Colour emoji** become the firmware's lower-case colour flaps:
   🟥→`r`, 🟧→`o`, 🟨→`y`, 🟩→`g`, 🟦→`b`, 🟪→`p`, ⬜→`w`, ⬛→space.
4. **Wrap** each paragraph to the frame width. Lines beyond the frame height are
   dropped.
5. **Centre** the wrapped block vertically and each line horizontally.
6. **`start`** prepends `start - 1` spaces before wrapping, so `1` means no
   offset.
7. **`raw`** treats the text as a complete board: newlines are removed, the
   string is space-padded to `rows × cols`, and anything longer is truncated.

## The drum

The stock drum is exactly **64 flaps**:

```text
 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw
```

- Lower-case `roygbpw` are physical colour flaps.
- There are **no accented letters**, so Czech text must be written without
  diacritics (`PRACKA HOTOVA`).
- Drums are never space-padded to 64 characters; a shorter override is rejected.
- Line breaks are rejected in `drum_write` because they would terminate the RS485
  command.

## Validation

Before publishing, each module's `flap_list` is checked for the characters it
will receive. Padding spaces are ignored, modules without a reported list are
skipped, and a missing character aborts the whole publish. See
[display](commands.md#display).

## See also

- [Commands](commands.md)
- [Layout and geometry](layout.md)
- [Services](../use/services.md)
