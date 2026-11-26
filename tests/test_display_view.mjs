/** Structural probe for the grouped Display settings view.
 *
 * Run with ``node --test tests/test_display_view.mjs``. The mock preset is a
 * visual redesign, so this probe makes sure every data-setting seam survives
 * and the single backend Display group is split into the three mock sections.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PanelMixin } from "../custom_components/splitflap_os/frontend/panel/views/settings.js";

class Base {
  _t(key) {
    return key;
  }
  _settingGroup(key, fallback) {
    return fallback || key;
  }
  _settingLabel(key, fallback) {
    return fallback || key;
  }
  _settingHelp(key, fallback) {
    return fallback || "";
  }
  _settingPlaceholder(key, fallback) {
    return fallback || "";
  }
  _optionLabel(key, option) {
    return String(option);
  }
}

class SettingsPanel extends PanelMixin(Base) {}

const FIELDS = [
  { key: "row_counts", type: "text" },
  { key: "rows", type: "number" },
  { key: "cols", type: "number" },
  { key: "theme", type: "select", options: ["auto", "light", "dark"] },
  { key: "timezone", type: "text" },
  { key: "units", type: "select", options: ["auto", "metric"] },
  { key: "ui_scale", type: "number" },
  { key: "page_delay", type: "number" },
  { key: "debug_ignore_module_limit", type: "boolean" },
  { key: "debug_allow_incompatible_firmware", type: "boolean" },
];

const html = new SettingsPanel()._settingsPage();

test("Display sub-tab keeps its render seam and the save button in the bar", () => {
  assert.match(html, /class="card settings-card"/);
  assert.match(html, /id="displaySettingsGroups" class="settings-groups"/);
  assert.match(
    html,
    /class="btn settings-save hidden" data-action="save-settings"/
  );
});

test("one backend group becomes the three mock sections", () => {
  const panel = new SettingsPanel();
  const groups = panel._displayGroups([{ key: "display", fields: FIELDS }]);

  assert.deepEqual(groups.map((group) => group.key), [
    "display_geometry",
    "display_preferences",
    "display_developer",
  ]);
  assert.deepEqual(groups[0].fields.map((field) => field.key), [
    "row_counts",
    "rows",
    "cols",
  ]);
  assert.deepEqual(groups[1].fields.map((field) => field.key), [
    "theme",
    "timezone",
    "units",
    "ui_scale",
    "page_delay",
  ]);
  assert.deepEqual(groups[2].fields.map((field) => field.key), [
    "debug_ignore_module_limit",
    "debug_allow_incompatible_firmware",
  ]);
  assert.equal(groups[0].columns, 3);
  assert.equal(groups[2].toggle, true);
});

test("generated markup keeps every input and the toggle switch seams", () => {
  const panel = new SettingsPanel();
  const values = Object.fromEntries(
    FIELDS.map((field) => [field.key, field.type === "boolean" ? false : ""])
  );
  const groups = panel._displayGroups([{ key: "display", fields: FIELDS }]);
  const markup = groups
    .map((group) => panel._settingsGroupHtml(group, values))
    .join("");

  for (const field of FIELDS) {
    assert.ok(markup.includes(`data-setting="${field.key}"`), `missing ${field.key}`);
  }
  assert.match(markup, /settings-grid-3/);
  assert.match(markup, /settings-grid-2/);
  assert.match(markup, /settings-toggle-row/);
  assert.match(markup, /settings-slider/);
  assert.match(markup, /display_hint_row_counts/);
  assert.match(markup, /display_hint_debug_ignore_module_limit/);
});
