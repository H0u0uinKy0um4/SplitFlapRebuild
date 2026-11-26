/** Structural probe for the Tuning sub-tabs.
 *
 * Run with ``node --test tests/test_tuning_view.mjs``. The Drum sub-tab writes
 * a whole drum; the character map belongs only to the Map sub-tab.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PanelMixin } from "../custom_components/splitflap_os/frontend/panel/views/tuning.js";

class Base {
  _t(key) {
    return key;
  }
}

class TuningPanel extends PanelMixin(Base) {}

const html = new TuningPanel()._tuningPage();

const subpage = (name) => {
  const start = html.indexOf(`data-subpage="tuning" data-sub="${name}"`);
  assert.notEqual(start, -1, `missing ${name} subpage`);
  const end = html.indexOf('data-subpage="tuning"', start + 1);
  return html.slice(start, end === -1 ? html.length : end);
};

test("Drum sub-tab writes a drum without a second character map", () => {
  const drum = subpage("drum");
  assert.match(drum, /data-sub="drum_write"/);
  assert.match(drum, /id="moduleDrumPreview"/);
  assert.ok(!drum.includes("charMap"), "stale charMap in Drum sub-tab");
  assert.ok(!drum.includes("character_map"), "stale map heading in Drum sub-tab");
});

test("Map sub-tab keeps the character map", () => {
  const map = subpage("map");
  assert.match(map, /class="char-map" id="mapFlaps"/);
  assert.match(map, /data-sub="apply_map"/);
  assert.match(map, /char_map_help/);
});

test("removed click-to-goto map leaves no renderer or action behind", () => {
  assert.equal(typeof TuningPanel.prototype._renderCharMap, "undefined");
  assert.ok(!html.includes("goto_flap"));
});
