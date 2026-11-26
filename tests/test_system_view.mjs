/** Structural probe for the nested System settings view.
 *
 * Run with ``node --test tests/test_system_view.mjs``. Settings -> System has
 * three independent sub-tabs (Module OTA, Master OTA, Connection & Backup), so
 * this probe keeps every control and render seam the panel logic depends on.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PanelMixin } from "../custom_components/splitflap_os/frontend/panel/views/settings.js";

class Base {
  _t(key) {
    return key;
  }
}

class SettingsPanel extends PanelMixin(Base) {}

const html = new SettingsPanel()._settingsPage();

test("System sub-tab nests three independent pages", () => {
  assert.match(html, /class="subtabs nested"/);
  for (const sub of ["module", "master", "connection"]) {
    assert.ok(
      html.includes(`data-action="subtab" data-group="system" data-sub="${sub}"`),
      `missing nested tab ${sub}`
    );
    assert.ok(
      html.includes(`data-subpage="system" data-sub="${sub}"`),
      `missing nested page ${sub}`
    );
  }
  assert.match(html, /class="card system-card"/);
  assert.match(html, /class="kv-grid"/);
});

test("every OTA render seam survives the redesign", () => {
  for (const id of [
    "otaModule",
    "otaModuleList",
    "firmwareRelease",
    "firmwareReleaseInfo",
    "otaInstalled",
    "otaBulkStatus",
    "otaBar",
    "otaStatus",
    "otaFile",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const id of [
    "masterOtaInstalled",
    "masterFirmwareRelease",
    "masterFirmwareReleaseInfo",
    "masterOtaBar",
    "masterOtaStatus",
    "masterOtaFile",
    "masterOtaExpectedVersion",
    "connMaster",
    "connMasterNote",
    "connMqtt",
    "connMqttNote",
    "connHardware",
    "connHardwareNote",
    "connEngine",
    "connEngineNote",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

test("all existing panel actions remain wired", () => {
  for (const action of [
    "flash-release-firmware",
    "flash-release-firmware-all",
    "cancel-firmware",
    "refresh-firmware-releases",
    "flash-firmware",
    "refresh-master-firmware-releases",
    "flash-master-firmware-release",
    "flash-master-firmware",
    "cancel-master-firmware",
    "download-backup",
    "restore-backup",
  ]) {
    assert.ok(html.includes(`data-action="${action}"`), `missing ${action}`);
  }
});

test("boot buttons are gone because modules restart after flashing", () => {
  for (const action of ["reset-firmware", "boot-all-firmware"]) {
    assert.ok(!html.includes(`data-action="${action}"`), `stale ${action}`);
  }
});
