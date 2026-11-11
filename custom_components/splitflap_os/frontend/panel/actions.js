/** Panel component logic. */

import { formatMessage } from "../utils.js?v=1.2.0";
import { DEFAULT_DRUM } from "../constants.js?v=1.2.0";


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
    if (target.dataset && target.dataset.setting) {
      if (target.closest(".settings-groups")) this._settingsDirty = true;
      this._applyFieldVisibility(
        target.closest(".settings-groups, #modalFields")
      );
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
    if (target.dataset && target.dataset.setting) {
      this._applyFieldVisibility(
        target.closest(".settings-groups, #modalFields")
      );
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
      case "app-mode":
        this._openAppMode(target.dataset.app);
        break;
      case "start-app-mode":
        await this._startAppMode(target.dataset.app, target.dataset.mode);
        break;
      case "settings-app":
        this._setAppSettingsTab(target.dataset.key);
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
      case "inspector":
        await this._inspectorAction(target.dataset.sub, target.dataset);
        break;
      case "inspector-value":
        this._inspectorValueChanged(target.dataset.sub, target.dataset);
        break;
      case "char-tuning":
        await this._charTuningAction(target.dataset.sub, target.dataset);
        break;
      case "char-tuning-value":
        this._charTuningValueChanged(target.dataset.sub, target.dataset);
        break;
      case "auto-tune":
        await this._autoTuneAction(target.dataset.sub, target.dataset);
        break;
      case "auto-tune-value":
        this._autoTuneValueChanged(target.dataset.sub, target.dataset);
        break;
      case "teach":
        await this._teachAction(target.dataset.sub, target.dataset);
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
    const modalFields = this.shadowRoot.getElementById("modalFields");
    modalFields.innerHTML = fields.length
      ? fields.map((field) => this._fieldHtml(field, settings[field.key])).join("")
      : `<p class="muted">${escapeHtml(this._t("app_no_options"))}</p>`;
    this._applyFieldVisibility(modalFields);
    const saveBtn = this.shadowRoot.querySelector('[data-action="save-app-settings"]');
    if (saveBtn) saveBtn.classList.remove("hidden");
    this.shadowRoot.getElementById("modal").classList.remove("hidden");
  }

  _openAppMode(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    if (!app) return;
    const modes = Array.isArray(app.modes) ? app.modes : [];
    if (!modes.length) {
      // No variants: launch the app directly.
      this._startApp(key);
      return;
    }
    this._modalApp = key;
    this.shadowRoot.getElementById("modalTitle").textContent = formatMessage(
      this._t("app_mode_named"),
      { name: this._appName(key) }
    );
    this.shadowRoot.getElementById("modalFields").innerHTML = modes
      .map(
        (mode) =>
          `<button class="btn secondary" data-action="start-app-mode" data-app="${escapeAttr(
            key
          )}" data-mode="${escapeAttr(mode)}">${escapeHtml(
            this._appModeLabel(key, mode)
          )}</button>`
      )
      .join("");
    const saveBtn = this.shadowRoot.querySelector('[data-action="save-app-settings"]');
    if (saveBtn) saveBtn.classList.add("hidden");
    this.shadowRoot.getElementById("modal").classList.remove("hidden");
  }

  async _startApp(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    if (app && app.available === false) {
      const reason =
        this._appRequirement(app, this._board()) || this._t("display_too_small");
      this._toast(`${this._appName(key)}: ${reason}`, "warn");
      return;
    }
    await this._send("start_app", { app: key });
  }

  async _startAppMode(app, mode) {
    const apps = (this._engine() && this._engine().apps) || [];
    const found = apps.find((item) => item.key === app);
    if (found && found.available === false) {
      const reason =
        this._appRequirement(found, this._board()) || this._t("display_too_small");
      this._toast(`${this._appName(app)}: ${reason}`, "warn");
      return;
    }
    await this._send("start_app", { app, mode });
    this._closeModal();
  }

  _closeModal() {
    this._modalApp = null;
    const saveBtn = this.shadowRoot.querySelector('[data-action="save-app-settings"]');
    if (saveBtn) saveBtn.classList.remove("hidden");
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

  async _inspectorAction(sub, data) {
    const module = this._selectedModule;
    if (module == null || !this._moduleFor(module)) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }

    if (sub === "offset") {
      const value =
        data && data.value != null
          ? Number(data.value)
          : null;
      if (value == null || !Number.isFinite(value)) {
        this._toast("Enter an offset value", "warn");
        return;
      }
      const current = this._moduleValue("inspector-offset");
      const currentNumber = Number(current);
      const base =
        Number.isFinite(currentNumber) && currentNumber >= 0
          ? currentNumber
          : 0;
      const next = Math.max(0, base + value);
      this._setInspectorValue("inspector-offset", next);
      return;
    }

    if (sub === "set_offset") {
      const input = this.shadowRoot.getElementById("inspector-offset");
      const offset =
        input && input.value != null
          ? Number(input.value)
          : NaN;
      if (!Number.isFinite(offset) || offset < 0 || offset > 65535) {
        this._toast("Enter a valid home offset (0-65535)", "warn");
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
      this._renderTuning();
      return;
    }

    if (sub === "goto") {
      const input = this.shadowRoot.getElementById("inspector-goto");
      const index =
        input && input.value != null
          ? Number(input.value)
          : NaN;
      if (!Number.isFinite(index) || index < 0 || index > 63) {
        this._toast("Enter a drum index (0-63)", "warn");
        return;
      }
      await this._send("calibrate", {
        module,
        action: "goto",
        index,
      });
      this._toast(
        formatMessage(this._t("module_homing"), { module })
      );
      this._renderTuning();
      return;
    }

    if (sub === "home") {
      await this._send("calibrate", { module, action: "home" });
      this._toast(
        formatMessage(this._t("module_homing"), { module })
      );
      this._renderTuning();
      return;
    }

    if (sub === "clear_eeprom") {
      await this._send("calibrate", {
        module,
        action: "clear_map",
      });
      this._toast(
        formatMessage(this._t("cleared_eeprom"), { module })
      );
      this._renderTuning();
      return;
    }

    if (sub === "open_char_map") {
      await this._openCharMapFor(module);
      return;
    }
  }

  _inspectorValueChanged(sub, data) {
    const input = this.shadowRoot.getElementById(
      sub === "offset" ? "inspector-offset" : "inspector-goto"
    );
    if (!input) return;
    const value =
      data && data.value != null ? String(data.value) : input.value;
    if (input.value !== value) input.value = value;
  }

  _setInspectorValue(id, value) {
    const node = this.shadowRoot.getElementById(id);
    if (node) node.value = value;
  }

  async _openCharMapFor(moduleId) {
    if (this._selectedModule == null || !this._moduleFor(moduleId)) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    this._openCharTuningModalFor(moduleId);
  }

  async _charTuningAction(sub, data) {
    if (
      this._charTuningModule == null ||
      this._charTuningDrum == null
    ) {
      return;
    }

    const moduleId = this._charTuningModule;

    if (sub === "set") {
      const indexNode = this.shadowRoot.querySelector(
        "input[data-action=\"char-tuning-value\"][data-sub=\"index\"]"
      );
      const stepNode = this.shadowRoot.querySelector(
        "input[data-action=\"char-tuning-value\"][data-sub=\"step\"]"
      );
      const index =
        indexNode && indexNode.value != null ? Number(indexNode.value) : NaN;
      const step =
        stepNode && stepNode.value != null ? Number(stepNode.value) : NaN;
      if (!
        (Number.isFinite(index) &&
          index >= 0 &&
          index < 64 &&
          Number.isFinite(step) &&
          step >= 0)
      ) {
        this._toast("Enter a valid index and step", "warn");
        return;
      }
      const positions = { [String(index)]: step };
      await this._send("calibrate", {
        module: moduleId,
        action: "apply",
        positions,
      });
      this._charTuningPositions = {
        ...this._charTuningPositions,
        [String(index)]: step,
      };
      this._toast(
        formatMessage(this._t("char_tuning_saved"), {
          entries: this._plural("entries", 1),
        })
      );
      this._renderCharTuningModal();
      return;
    }

    if (sub === "clear") {
      const selectedIndex =
        this._charTuningSelectedIndex != null
          ? this._charTuningSelectedIndex
          : -1;
      if (selectedIndex < 0) {
        this._toast("Select a character first", "warn");
        return;
      }
      await this._send("calibrate", {
        module: moduleId,
        positions: { [String(selectedIndex)]: "0xFFFF" },
      });
      delete this._charTuningPositions[String(selectedIndex)];
      this._toast(
        formatMessage(this._t("cleared_eeprom"), { module: moduleId })
      );
      this._renderCharTuningModal();
      return;
    }

    if (sub === "select") {
      const index =
        data && data.index != null ? Number(data.index) : NaN;
      if (Number.isFinite(index)) {
        this._charTuningSelectedIndex = index;
        this._renderCharTuningModal();
      }
    }
  }

  _charTuningValueChanged(sub, data) {
    const indexNode = this.shadowRoot.querySelector(
      "input[data-action=\"char-tuning-value\"][data-sub=\"index\"]"
    );
    const stepNode = this.shadowRoot.querySelector(
      "input[data-action=\"char-tuning-value\"][data-sub=\"step\"]"
    );
    if (sub === "index") {
      const value =
        data && data.value != null ? String(data.value) : indexNode.value;
      if (indexNode.value !== value) indexNode.value = value;
      return;
    }
    if (sub === "step") {
      const value =
        data && data.value != null ? String(data.value) : stepNode.value;
      if (stepNode.value !== value) stepNode.value = value;
    }
  }

  async _autoTuneAction(sub, data) {
    const module = this._selectedModule;
    if (module == null || !this._moduleFor(module)) {
      this._toast(this._t("auto_tune_no_module"), "warn");
      return;
    }

    if (sub === "start") {
      await this._send("calibrate", {
        module,
        action: "auto",
      });
      this._autoTuneState = {
        module,
        total: 64,
        done: 0,
        phase: this._t("auto_tune_progress"),
        chars: DEFAULT_DRUM.split(""),
        selectedIndex: 0,
        waiting_for_char: true,
        repeat_offenders: [],
        done: false,
      };
      this._renderAutoFineTune();
      return;
    }

    if (sub === "abort") {
      this._autoTuneState = null;
      this._toast(this._t("auto_tune_abort"));
      this._renderAutoFineTune();
      return;
    }

    if (sub === "reset") {
      this._autoTuneState = null;
      this._renderAutoFineTune();
      return;
    }

    if (sub === "submit_char") {
      const input = this.shadowRoot.getElementById("auto-tune-char");
      const char =
        input && input.value != null
          ? String(input.value).slice(0, 1)
          : "";
      if (!char) {
        this._toast("Pick a character", "warn");
        return;
      }
      const state = this._autoTuneState;
      if (state == null) return;
      const index = state.done;
      const submittedChar =
        index < state.chars.length ? state.chars[index] : char;
      await this._send("calibrate", {
        module,
        action: "record",
        index,
        flap: submittedChar,
      });
      state.done += 1;
      state.selectedIndex = index + 1;
      state.waiting_for_char = state.done < state.total;
      state.chars[index] = submittedChar;
      if (state.done >= state.total) {
        state.done = true;
        state.phase = this._t("auto_tune_done");
        state.waiting_for_char = false;
      }
      this._renderAutoFineTune();
      return;
    }
  }

  _autoTuneValueChanged(sub, data) {
    const input = this.shadowRoot.getElementById("auto-tune-char");
    if (!input) return;
    const value =
      data && data.value != null ? String(data.value).slice(0, 1) : input.value;
    if (input.value !== value) input.value = value;
  }

  async _teachAction(sub, data) {
    const module = this._selectedModule;
    if (module == null || !this._moduleFor(module)) {
      this._toast(this._t("teach_no_module"), "warn");
      return;
    }

    if (sub === "start") {
      await this._send("calibrate", {
        module,
        action: "teach",
      });
      this._teachState = {
        module,
        currentIndex: 0,
        done: false,
        phase: this._t("teach_phase_label"),
      };
      this._renderTeachMode();
      return;
    }

    if (sub === "abort") {
      this._teachState = null;
      this._toast(this._t("teach_abort"));
      this._renderTeachMode();
      return;
    }

    if (sub === "reset") {
      this._teachState = null;
      this._renderTeachMode();
      return;
    }

    if (sub === "nudge") {
      const dir =
        data && data.dir != null ? Number(data.dir) : NaN;
      if (!Number.isFinite(dir)) {
        this._toast("Invalid nudge", "warn");
        return;
      }
      const state = this._teachState;
      if (state == null) return;
      const index =
        state.currentIndex != null
          ? state.currentIndex + dir
          : 0;
      if (index < 0 || index > 63) {
        this._toast("Out of range", "warn");
        return;
      }
      state.currentIndex = index;
      this._renderTeachMode();
      return;
    }

    if (sub === "apply") {
      const state = this._teachState;
      if (state == null) return;
      const index = state.currentIndex;
      if (index == null || index < 0 || index > 63) {
        this._toast("Invalid index", "warn");
        return;
      }
      const moduleData =
        (this._coordinator && this._coordinator().modules) || [];
      const moduleRecord = moduleData.find((m) =>
        String(m.id) === String(module)
      );
      const drum =
        moduleRecord &&
        Array.isArray(moduleRecord.effective_drum) &&
        moduleRecord.effective_drum.length
          ? moduleRecord.effective_drum
          : DEFAULT_DRUM.split("");
      const char =
        index < drum.length ? drum[index] : " ";
      await this._send("calibrate", {
        module,
        action: "record",
        index,
        flap: char,
      });        state.currentIndex = index + 1;
      if (state.currentIndex > 63) {
        state.done = true;
        state.phase = this._t("teach_done");
        this._toast(this._t("teach_done"));
      } else {
        state.phase = formatMessage(
          this._t("teach_phase_label"),
          { current: state.currentIndex, total: 64 }
        );
      }
      this._renderTeachMode();
      return;
    }

    if (sub === "skip") {
      const state = this._teachState;
      if (state == null) return;
      state.currentIndex = (state.currentIndex ?? 0) + 1;
      if (state.currentIndex > 63) {
        state.done = true;
        state.phase = this._t("teach_done");
        this._toast(this._t("teach_done"));
      } else {
        state.phase = formatMessage(
          this._t("teach_phase_label"),
          { current: state.currentIndex, total: 64 }
        );
      }
      this._renderTeachMode();
      return;
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
