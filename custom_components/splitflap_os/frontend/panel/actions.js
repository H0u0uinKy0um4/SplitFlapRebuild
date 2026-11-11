/** Panel component logic. */

import { formatMessage } from "../utils.js?v=1.0.1";
import { DEFAULT_DRUM } from "../constants.js?v=1.0.1";


export const PanelMixin = (Base) => class extends Base {
  _onInput(event) {
    const target = event.target;
    if (!target) return;

    if (target.id === "compose") {
      this._composeText = target.value;
      this._renderComposePreview();
      return;
    }
    if (target.id === "defaultDrum") {
      this._settingsDirty = true;
      this._updateDrumCharCount();
      return;
    }
    if (target.id === "drumEditor") {
      this._updateDrumEditorCharCount();
      return;
    }
    if (target.id === "startCol" || target.id === "styleSelect" || target.id === "speedInput") {
      this._renderComposePreview();
      return;
    }
    if (target.id === "builderDelay") {
      this._playDelay = Number(target.value) || 5;
      return;
    }
    if (target.id === "otaModule") {
      this._renderOtaInstalled();
      return;
    }
    if (target.dataset && target.dataset.setting && target.closest(".settings-groups")) {
      this._settingsDirty = true;
    }
  }

  async _onChange(event) {
    const target = event.target;
    if (!target) return;
    if (target.id === "restoreFile") {
      await this._restoreFile(target);
      return;
    }
    if (target.id === "moduleDrumSelect") {
      this._updateModuleDrumPreview();
    }
  }

  async _onClick(event) {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
      case "tab":
        this._setTab(target.dataset.tab);
        break;
      case "subtab":
        this._setSubtab(target.dataset.group, target.dataset.sub);
        break;
      case "refresh":
        await this._loadState();
        break;
      case "push-text":
        await this._pushText();
        break;
      case "clear-text":
        await this._clearText();
        break;
      case "insert-color":
        this._insertColor(target.dataset.char);
        break;
      case "add-playlist":
        this._addToBuilder();
        break;
      case "remove-builder":
        this._builder.splice(Number(target.dataset.index), 1);
        this._renderBuilder();
        break;
      case "play-builder":
        await this._playBuilder();
        break;
      case "save-builder":
        await this._saveBuilder();
        break;
      case "run-saved":
        await this._runSaved(target.dataset.name);
        break;
      case "delete-saved":
        await this._deleteSaved(target.dataset.name);
        break;
      case "save-drum":
        await this._saveDrum();
        break;
      case "delete-drum":
        await this._deleteDrum(target.dataset.name);
        break;
      case "edit-drum":
        this._loadDrumToEditor(target.dataset.name);
        break;
      case "write-drum":
        await this._writeSavedDrum(target.dataset.name);
        break;
      case "load-module-drum":
        this._loadModuleDrumToEditor();
        break;
      case "stop":
        await this._send("stop_app");
        break;
      case "start-app": {
        const apps = (this._engine() && this._engine().apps) || [];
        const app = apps.find((item) => item.key === target.dataset.app);
        if (app && app.available === false) {
          const reason =
            this._appRequirement(app, this._board()) ||
            this._t("display_too_small");
          this._toast(`${this._appName(target.dataset.app)}: ${reason}`, "warn");
          break;
        }
        await this._send("start_app", { app: target.dataset.app });
        break;
      }
      case "app-settings":
        this._openAppSettings(target.dataset.app);
        break;
      case "save-app-settings":
        await this._saveAppSettings();
        break;
      case "close-modal":
        this._closeModal();
        break;
      case "select-module":
        this._selectedModule = target.dataset.id;
        this._inspectorModule = null;
        this._renderTuning();
        break;
      case "module":
        await this._moduleAction(target.dataset.sub, target.dataset);
        break;
      case "hardware":
        await this._hardwareAction(target.dataset.sub);
        break;
      case "flash-firmware":
        await this._flashFirmware();
        break;
      case "cancel-firmware":
        await this._cancelFirmware();
        break;
      case "reset-firmware":
        await this._resetFirmware();
        break;
      case "save-settings":
        await this._saveSettings();
        break;
      case "download-backup":
        await this._downloadBackup();
        break;
      case "restore-backup":
        this.shadowRoot.getElementById("restoreFile").click();
        break;
      case "save-default-drum":
        await this._saveDefaultDrum();
        break;
      case "reset-default-drum":
        this._resetDefaultDrum();
        break;
      default:
        break;
    }
  }

  async _pushText() {
    const board = this._board();
    const startNode = this.shadowRoot.getElementById("startCol");
    const styleNode = this.shadowRoot.getElementById("styleSelect");
    const speedNode = this.shadowRoot.getElementById("speedInput");
    const text = this._composeText || "";
    if (!text.trim()) {
      this._toast(this._t("type_message"), "warn");
      return;
    }
    await this._send("send_text", {
      text,
      start: Math.max(1, Number(startNode.value) || 1),
      style: styleNode.value || "ltr",
      speed: Math.max(0, Number(speedNode.value) || 0),
      stop: true,
    });
    this._toast(
      formatMessage(this._t("sent_text"), {
        chars: text.length,
        rows: board.rows,
        cols: board.cols,
      })
    );
  }

  async _clearText() {
    const textarea = this.shadowRoot.getElementById("compose");
    if (textarea) textarea.value = "";
    this._composeText = "";
    this._renderComposePreview();
    await this._send("send_text", { text: "", stop: true });
    this._toast(this._t("display_cleared"));
  }

  _insertColor(char) {
    if (!char) return;
    const textarea = this.shadowRoot.getElementById("compose");
    if (!textarea) return;
    const start = textarea.selectionStart == null ? textarea.value.length : textarea.selectionStart;
    const end = textarea.selectionEnd == null ? start : textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + char + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + char.length;
    textarea.focus();
    this._composeText = textarea.value;
    this._renderComposePreview();
  }

  _addToBuilder() {
    const text = this._composeText || "";
    if (!text.trim()) {
      this._toast(this._t("compose_message_first"), "warn");
      return;
    }
    this._builder.push({ text });
    // The builder lives on the Playlists tab; switch to it so the new page
    // is actually visible instead of landing in a hidden list.
    this._setTab("playlists");
    this._renderBuilder();
    this._toast(
      formatMessage(this._t("page_added"), { index: this._builder.length })
    );
  }

  async _playBuilder() {
    if (!this._builder.length) {
      this._toast(this._t("playlist_empty"), "warn");
      return;
    }
    const delayNode = this.shadowRoot.getElementById("builderDelay");
    const delay = Math.max(0.1, Number(delayNode.value) || this._playDelay || 5);
    await this._send("play_playlist", {
      pages: this._builder.map((page) => ({ text: page.text })),
      delay,
      loop: true,
    });
    this._toast(
      formatMessage(this._t("playing_playlist"), {
        pages: this._plural("pages", this._builder.length),
      })
    );
  }

  async _saveBuilder() {
    if (!this._builder.length) {
      this._toast(this._t("playlist_empty"), "warn");
      return;
    }
    const nameNode = this.shadowRoot.getElementById("saveName");
    const name = String(nameNode.value || "").trim();
    if (!name) {
      this._toast(this._t("give_playlist_name"), "warn");
      return;
    }
    const delayNode = this.shadowRoot.getElementById("builderDelay");
    const delay = Math.max(0.1, Number(delayNode.value) || 5);
    await this._send("save_playlist", {
      name,
      pages: this._builder.map((page) => ({ text: page.text })),
      delay,
    });
    nameNode.value = "";
    this._toast(formatMessage(this._t("saved_playlist"), { name }));
  }

  async _runSaved(name) {
    if (!name) return;
    await this._send("run_saved_playlist", { name });
    this._toast(formatMessage(this._t("started"), { name }));
  }

  async _deleteSaved(name) {
    if (!name) return;
    const msg = formatMessage(this._t("delete_playlist_confirm"), { name });
    if (!window.confirm(msg)) return;
    await this._send("delete_playlist", { name });
    this._toast(formatMessage(this._t("deleted"), { name }));
  }

  async _saveDrum() {
    const editor = this.shadowRoot.getElementById("drumEditor");
    const nameNode = this.shadowRoot.getElementById("drumName");
    if (!editor || !nameNode) return;
    const drum = String(editor.value || "");
    if (!this._validDrum(drum)) {
      this._toast(this._t("drum_length_error"), "warn");
      return;
    }
    const name = String(nameNode.value || "").trim();
    if (!name) {
      this._toast(this._t("give_drum_name"), "warn");
      return;
    }
    await this._send("save_drum", { name, drum });
    this._toast(formatMessage(this._t("drum_saved"), { name }));
  }

  async _deleteDrum(name) {
    if (!name) return;
    const msg = formatMessage(this._t("delete_drum_confirm"), { name });
    if (!window.confirm(msg)) return;
    await this._send("delete_drum", { name });
    this._toast(formatMessage(this._t("drum_deleted"), { name }));
  }

  _savedDrum(name) {
    const drums = (this._engine() && this._engine().saved_drums) || {};
    return String(drums[name] || "");
  }

  _loadDrumToEditor(name) {
    if (!name) return;
    const drum = this._savedDrum(name);
    if (!this._validDrum(drum)) {
      this._toast(this._t("drum_length_error"), "warn");
      return;
    }
    const editor = this.shadowRoot.getElementById("drumEditor");
    const nameNode = this.shadowRoot.getElementById("drumName");
    if (editor) editor.value = drum;
    // Pre-fill the name so an edited drum saves over itself by default.
    if (nameNode) nameNode.value = name;
    this._updateDrumEditorCharCount();
    this._toast(formatMessage(this._t("drum_loaded"), { name }));
  }

  _loadModuleDrumToEditor() {
    const selected = this._moduleFor(this._selectedModule);
    if (!selected) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    const drum = Array.isArray(selected.effective_drum)
      ? selected.effective_drum.join("")
      : "";
    if (!this._validDrum(drum)) {
      this._toast(this._t("drum_length_error"), "warn");
      return;
    }
    const editor = this.shadowRoot.getElementById("drumEditor");
    if (editor) editor.value = drum;
    this._updateDrumEditorCharCount();
    this._toast(this._t("module_drum_loaded"));
  }

  async _writeSavedDrum(name) {
    if (!name) return;
    const drum = this._savedDrum(name);
    if (!this._validDrum(drum)) {
      this._toast(this._t("drum_length_error"), "warn");
      return;
    }
    const module = this._selectedModule;
    if (module === null || !this._moduleFor(module)) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    // Same path as the module drum editor: the master writes the EEPROM and
    // verifies it with a readback, reporting `verified`.
    const result = await this._send("calibrate", {
      module,
      action: "drum_write",
      drum,
    });
    if (result && result.verified === false) {
      this._toast(
        formatMessage(this._t("drum_verify_failed"), { module }),
        "error"
      );
    } else {
      this._toast(
        formatMessage(this._t("drum_written_named"), { name })
      );
    }
    // Re-sync the module drum editor with what the module now reports.
    this._inspectorModule = null;
    this._renderTuning();
  }

  _openAppSettings(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    if (!app) return;
    this._modalApp = key;
    const settings = (this._engine() && this._engine().settings) || {};
    const fields = app.fields || [];
    this.shadowRoot.getElementById("modalTitle").textContent = formatMessage(
      this._t("app_settings_named"),
      { name: this._appName(key) }
    );
    this.shadowRoot.getElementById("modalFields").innerHTML = fields.length
      ? fields.map((field) => this._fieldHtml(field, settings[field.key])).join("")
      : `<p class="muted">${escapeHtml(this._t("app_no_options"))}</p>`;
    this.shadowRoot.getElementById("modal").classList.remove("hidden");
  }

  _closeModal() {
    this._modalApp = null;
    this.shadowRoot.getElementById("modal").classList.add("hidden");
  }

  _collectSettings(root) {
    const values = {};
    if (!root) return values;
    root.querySelectorAll("[data-setting]").forEach((input) => {
      const key = input.dataset.setting;
      if (!key) return;
      let value = input.value;
      if (input.type === "number") {
        value = value === "" ? "" : Number(value);
      }
      values[key] = value;
    });
    return values;
  }

  async _saveSettings() {
    // Settings now live in two containers (Display and Apps sub-tabs);
    // saving always persists everything that is visible.
    const values = {};
    for (const id of ["displaySettingsGroups", "appsSettingsGroups"]) {
      const root = this.shadowRoot.getElementById(id);
      if (!root) continue;
      Object.assign(values, this._collectSettings(root));
    }
    await this._send("set_settings", { settings: values });
    this._settingsDirty = false;
    this._toast(this._t("settings_saved"));
  }

  async _saveAppSettings() {
    const key = this._modalApp;
    if (!key) {
      this._closeModal();
      return;
    }
    const root = this.shadowRoot.getElementById("modalFields");
    const settings = this._collectSettings(root);
    await this._send("set_settings", { settings });
    this._closeModal();
    this._toast(
      formatMessage(this._t("app_settings_saved"), {
        name: this._appName(key),
      })
    );
  }

  _moduleValue(id) {
    const node = this.shadowRoot.getElementById(id);
    return node ? node.value : "";
  }

  _parsePositions(text) {
    const positions = {};
    String(text || "")
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const match = part.match(/^(\d+)\s*[:=]\s*(\d+)$/);
        if (!match) return;
        const index = Number(match[1]);
        const position = Number(match[2]);
        if (index >= 0 && index < 64 && position >= 0) {
          positions[String(index)] = position;
        }
      });
    return positions;
  }

  async _moduleAction(sub, data) {
    const module = this._selectedModule;
    if (module === null || !this._moduleFor(module)) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }

    if (sub === "home") {
      await this._send("calibrate", { module, action: "home" });
      this._toast(
        formatMessage(this._t("module_homing"), { module })
      );
      return;
    }
    if (sub === "get_pos") {
      await this._send("calibrate", { module, action: "get_pos" });
      return;
    }
    if (sub === "goto_index") {
      const index = Number(this._moduleValue("gotoIndex"));
      if (!Number.isFinite(index) || index < 0) {
        this._toast(this._t("enter_drum_index"), "warn");
        return;
      }
      await this._send("calibrate", { module, action: "goto", index });
      return;
    }
    if (sub === "goto_flap") {
      const flap = data.flap;
      if (flap === undefined) return;
      await this._send("calibrate", { module, action: "goto", flap });
      return;
    }
    if (sub === "step") {
      const steps =
        data.step !== undefined
          ? Number(data.step)
          : Number(this._moduleValue("stepAmount"));
      if (!Number.isFinite(steps) || steps === 0) {
        this._toast(this._t("enter_nonzero_steps"), "warn");
        return;
      }
      await this._send("calibrate", { module, action: "step", steps });
      return;
    }
    if (sub === "record") {
      const index = Number(this._moduleValue("recordIndex"));
      if (!Number.isFinite(index) || index < 0) {
        this._toast(this._t("enter_index_to_record"), "warn");
        return;
      }
      if (
        index === 0 &&
        !window.confirm(this._t("index_zero_confirm"))
      ) {
        return;
      }
      await this._send("calibrate", { module, action: "record", index });
      this._toast(
        formatMessage(this._t("recorded_module"), { module, index })
      );
      return;
    }
    if (sub === "clear_map") {
      await this._send("calibrate", { module, action: "clear_map" });
      this._toast(
        formatMessage(this._t("cleared_eeprom"), { module })
      );
      return;
    }
    if (sub === "apply_offset") {
      const offset = Number(this._moduleValue("offsetValue"));
      if (!Number.isFinite(offset) || offset < 0) {
        this._toast(this._t("enter_valid_home_offset"), "warn");
        return;
      }
      await this._send("calibrate", {
        module,
        action: "apply",
        home_offset: offset,
      });
      this._toast(
        formatMessage(this._t("applied_offset"), { offset })
      );
      return;
    }
    if (sub === "apply_map") {
      const positions = this._parsePositions(this._moduleValue("posMap"));
      if (!Object.keys(positions).length) {
        this._toast(this._t("enter_index_step_pair"), "warn");
        return;
      }
      await this._send("calibrate", {
        module,
        action: "apply",
        positions,
      });
      this._toast(
        formatMessage(this._t("applied_map"), {
          entries: this._plural("entries", Object.keys(positions).length),
        })
      );
    }
    if (sub === "drum_write") {
      // The per-module editor is a dropdown: pick a saved drum set (or the
      // stock drum) from the library and write it to the module's EEPROM.
      const select = this.shadowRoot.getElementById("moduleDrumSelect");
      if (!select) return;
      const drum =
        select.value === "__stock__"
          ? DEFAULT_DRUM
          : this._savedDrum(select.value);
      if (!this._validDrum(drum)) {
        this._toast(this._t("drum_length_error"), "warn");
        return;
      }
      // The write also re-queries the module on the master, so the result
      // reports whether the EEPROM readback matches what we sent.
      const result = await this._send("calibrate", {
        module,
        action: "drum_write",
        drum,
      });
      if (result && result.verified === false) {
        this._toast(
          formatMessage(this._t("drum_verify_failed"), { module }),
          "error"
        );
      } else {
        this._toast(this._t("drum_written"));
      }
      // Re-sync the editor with the drum the module now reports.
      this._inspectorModule = null;
      this._renderTuning();
    }
  }

  async _hardwareAction(sub) {
    if (sub === "scan") {
      await this._send("scan");
      this._toast(this._t("scanning_bus"));
      return;
    }
    if (sub === "sync") {
      await this._send("sync");
      this._toast(this._t("requested_sync"));
      return;
    }
    if (sub === "update") {
      await this._send("update");
      this._toast(this._t("refreshing_modules"));
      return;
    }
    if (sub === "home_all") {
      await this._send("home_all");
      this._toast(this._t("homing_every_module"));
    }
  }

  async _cancelFirmware() {
    await this._send("cancel_firmware");
    this._toast(this._t("ota_cancel_requested"));
  }

  _otaModuleId() {
    const node = this.shadowRoot.getElementById("otaModule");
    const value = Number(node && node.value);
    return Number.isInteger(value) && value >= 1 && value <= 255 ? value : null;
  }

  async _resetFirmware() {
    const moduleId = this._otaModuleId();
    if (moduleId == null) {
      this._toast(this._t("ota_no_module"), "warn");
      return;
    }
    if (!window.confirm(formatMessage(this._t("ota_reset_confirm"), { module: moduleId }))) {
      return;
    }
    await this._send("reset_firmware", { module: moduleId });
    this._toast(formatMessage(this._t("ota_reset_requested"), { module: moduleId }));
  }

  async _flashFirmware() {
    const fileNode = this.shadowRoot.getElementById("otaFile");
    const file = fileNode && fileNode.files ? fileNode.files[0] : null;
    if (!file) {
      this._toast(this._t("ota_no_file"), "warn");
      return;
    }
    if (!/\.hex$/i.test(file.name)) {
      this._toast(this._t("ota_not_hex"), "warn");
      return;
    }
    const moduleId = this._otaModuleId();
    if (moduleId == null) {
      this._toast(this._t("ota_no_module"), "warn");
      return;
    }
    if (!window.confirm(formatMessage(this._t("ota_confirm"), { module: moduleId }))) {
      return;
    }

    let text;
    try {
      text = await file.text();
    } catch (err) {
      this._toast(
        formatMessage(this._t("ota_read_failed"), {
          error: err.message || err,
        }),
        "error"
      );
      return;
    }
    if (!text.trimStart().startsWith(":")) {
      this._toast(this._t("ota_not_hex"), "warn");
      return;
    }

    this._otaBusy = true;
    this._renderOta();
    try {
      const result = await this._send("flash_firmware", {
        module: moduleId,
        hex: text,
      });
      this._otaSize = Number(result && result.size) || 0;
      this._toast(
        formatMessage(this._t("ota_sent"), {
          size: this._otaSize,
          crc: (result && result.crc32) || "—",
        })
      );
    } catch (err) {
      /* _send already reported the error. */
    } finally {
      this._otaBusy = false;
      this._renderOta();
    }
  }

  async _downloadBackup() {
    const data = await this._send("backup");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `splitflap-os-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const status = this.shadowRoot.getElementById("backupStatus");
    if (status) {
      status.textContent = formatMessage(this._t("backup_downloaded_at"), {
        time: new Date().toLocaleTimeString(this._lang()),
      });
    }
    this._toast(this._t("backup_downloaded"));
  }

  async _restoreFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(this._t("backup_must_be_object"));
      }
      await this._send("restore", { data });
      const status = this.shadowRoot.getElementById("backupStatus");
      if (status) {
        status.textContent = formatMessage(this._t("restored_file"), {
          name: file.name,
        });
      }
      this._toast(this._t("backup_restored"));
      this._settingsDirty = false;
    } catch (err) {
      this._toast(
        formatMessage(this._t("restore_failed"), {
          error: err.message || err,
        }),
        "error"
      );
    } finally {
      input.value = "";
    }
  }

  async _saveDefaultDrum() {
    const textarea = this.shadowRoot.getElementById("defaultDrum");
    if (!textarea) return;
    const value = String(textarea.value || "");
    // An empty value clears the override. Anything else must be a complete
    // 64-character drum, otherwise the indices would shift.
    if (value !== "" && !this._validDrum(value)) {
      this._toast(this._t("drum_length_error"), "warn");
      return;
    }
    const settings = { default_drum: value };
    await this._send("set_settings", { settings });
    this._settingsDirty = false;
    this._toast(this._t("settings_saved"));
  }

  _resetDefaultDrum() {
    // Stage the stock drum in the editor; Save persists it as the fallback.
    const textarea = this.shadowRoot.getElementById("defaultDrum");
    if (textarea) {
      textarea.value = DEFAULT_DRUM;
      this._updateDrumCharCount();
      this._toast(
        formatMessage(this._t("drum_reset_staged"), {
          button: this._t("save"),
        })
      );
    }
  }

  _updateDrumCharCount() {
    const textarea = this.shadowRoot.getElementById("defaultDrum");
    const counter = this.shadowRoot.getElementById("drumCharCount");
    if (textarea && counter) {
      counter.textContent = `${textarea.value.length} / 64`;
    }
  }

  _updateDrumEditorCharCount() {
    const textarea = this.shadowRoot.getElementById("drumEditor");
    const counter = this.shadowRoot.getElementById("drumEditorCharCount");
    if (textarea && counter) {
      counter.textContent = `${textarea.value.length} / 64`;
    }
  }

  _validDrum(value) {
    const drum = String(value || "");
    return drum.length === 64 && !/[\r\n]/.test(drum);
  }


};
