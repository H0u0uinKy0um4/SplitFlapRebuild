/** Panel component logic. */

import { formatMessage } from "../utils.js?v=1.2.12";
import { DEFAULT_DRUM } from "../constants.js?v=1.2.12";

// The master blocks while a module moves and only then writes/refreshes the
// position map, so the auto-tune verification frame must not be requested in
// the same breath as the correction wrote it.
const AT_SETTLE_MS = 1200;


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
      case "toggle-theme":
        await this._toggleTheme();
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
      case "quick-offset":
        await this._quickOffset(target.dataset.delta);
        break;
      case "open-tune-flap":
        this._openTuneFlap(target.dataset.index);
        break;
      case "close-tune-modal":
        this._closeTuneModal();
        break;
      case "tune-nudge":
        this._tuneNudge(target.dataset.delta);
        break;
      case "tune-test-goto":
        await this._tuneTestGoto();
        break;
      case "tune-save":
        await this._tuneSave();
        break;
      case "tune-revert":
        await this._tuneRevert();
        break;
      case "at-begin":
        await this._atBegin();
        break;
      case "at-cell":
        this._atToggleCell(target.dataset.id);
        break;
      case "at-apply-ahead":
        await this._atApplyAhead();
        break;
      case "at-skip-ahead":
        this._atSkipAhead();
        break;
      case "at-apply-behind":
        await this._atApplyBehind();
        break;
      case "at-next-char":
        await this._atNextChar();
        break;
      case "at-recheck-ahead":
        this._atRecheckAhead();
        break;
      case "at-jump":
        await this._atJump();
        break;
      case "at-abort":
        this._atAbort();
        break;
      case "at-restart":
        this._atRestart();
        break;
      case "teach-start":
        await this._teachStart();
        break;
      case "teach-nudge":
        await this._teachNudge(target.dataset.delta);
        break;
      case "teach-record-next":
        await this._teachRecordNext();
        break;
      case "teach-skip":
        await this._teachSkip();
        break;
      case "teach-prev":
        await this._teachPrev();
        break;
      case "teach-abort":
        this._teachAbort();
        break;
      case "teach-restart":
        this._teachRestart();
        break;
      default:
        break;
    }
  }

  async _toggleTheme() {
    const next = this._themeValue() === "dark" ? "light" : "dark";
    // Optimistic switch so the button feels instant. `_themePending` keeps the
    // value pinned until the engine confirms it, then the persisted setting
    // wins again.
    this._themePending = next;
    this._applyTheme(next);
    try {
      await this._send("set_settings", { settings: { theme: next } });
    } finally {
      this._themePending = null;
      this._applyTheme();
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

  async _quickOffset(delta) {
    const selected = this._moduleFor(this._selectedModule);
    if (!selected) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    const current = Number(selected.home_offset) || 0;
    const next = Math.max(0, Math.min(65535, current + Number(delta)));
    await this._send("calibrate", {
      module: selected.id,
      action: "apply",
      home_offset: next,
    });
    selected.home_offset = next;
    const stat = this.shadowRoot.getElementById("statOffset");
    if (stat) stat.textContent = String(next);
    const input = this.shadowRoot.getElementById("offsetValue");
    if (input) input.value = String(next);
    this._toast(formatMessage(this._t("applied_offset"), { offset: next }));
  }

  _openTuneFlap(index) {
    this._openTuneModal(index);
  }

  _tuneNudge(delta) {
    if (!this._tuneFlapState) return;
    const input = this.shadowRoot.getElementById("tuneStepInput");
    const current = input ? Number(input.value) : this._tuneFlapState.active;
    const next = Math.max(0, Math.min(65535, current + Number(delta)));
    this._tuneFlapState.active = next;
    if (input) input.value = String(next);
    this._renderTuneModal();
  }

  async _tuneTestGoto() {
    if (!this._tuneFlapState) return;
    const { moduleId, index } = this._tuneFlapState;
    await this._send("calibrate", {
      module: moduleId,
      action: "goto",
      index,
    });
    this._toast(formatMessage(this._t("goto_named"), { index }));
  }

  async _tuneSave() {
    if (!this._tuneFlapState) return;
    const input = this.shadowRoot.getElementById("tuneStepInput");
    const active = input ? Number(input.value) : this._tuneFlapState.active;
    const { moduleId, index } = this._tuneFlapState;
    await this._send("calibrate", {
      module: moduleId,
      action: "apply",
      positions: { [String(index)]: active },
    });
    const module = this._moduleFor(moduleId);
    if (module) {
      if (!module.map_of_positions) module.map_of_positions = {};
      module.map_of_positions[String(index)] = active;
    }
    this._tuneFlapState.tuned = active;
    this._tuneFlapState.active = active;
    this._toast(
      formatMessage(this._t("applied_map"), {
        entries: this._plural("entries", 1),
      })
    );
    this._renderTuneModal();
    this._renderMapFlaps(module);
  }

  async _tuneRevert() {
    if (!this._tuneFlapState) return;
    const { moduleId, index, expected } = this._tuneFlapState;
    await this._send("calibrate", {
      module: moduleId,
      action: "apply",
      positions: { [String(index)]: 0xFFFF },
    });
    const module = this._moduleFor(moduleId);
    if (module && module.map_of_positions) {
      delete module.map_of_positions[String(index)];
    }
    this._tuneFlapState.tuned = null;
    this._tuneFlapState.active = expected;
    this._toast(
      formatMessage(this._t("cleared_eeprom"), { module: moduleId })
    );
    this._renderTuneModal();
    this._renderMapFlaps(module);
  }

  /** Drum used by the auto-tune wizard.
   *
   * The wizard walks one character index at a time on the whole board, so it
   * needs a single drum. Use the first module that reports one; a custom drum
   * has to agree with what the master maps, otherwise the shown character and
   * the measured index would disagree. Falls back to the stock drum before the
   * first scan reported anything.
   */
  _atDrum() {
    const coordinator = this._coordinator();
    const modules = (coordinator && coordinator.modules) || [];
    for (const module of modules) {
      const drum =
        module && Array.isArray(module.effective_drum) && module.effective_drum.length
          ? module.effective_drum
          : module && Array.isArray(module.flap_list) && module.flap_list.length
            ? module.flap_list
            : null;
      if (drum) return drum.slice(0, 64);
    }
    return DEFAULT_DRUM.split("");
  }

  _atMaxIndex() {
    return Math.max(1, Math.min(63, this._atDrum().length - 1));
  }

  /** Absolute step the master uses for one flap index.
   *
   * Mirrors ``derive_flap_state`` in coordinator.py:
   * ``(home_offset + index * total_steps / drum) % total_steps``.  The home
   * offset is part of the physical mapping, so a map entry written without it
   * lands ``home_offset`` steps away from the flap that was asked for.
   */
  _expectedStep(module, index, drumLen = 64) {
    const cal = Math.max(1, Number(module && module.total_steps) || 4096);
    const offset = Number(module && module.home_offset) || 0;
    const length = Math.max(1, Number(drumLen) || 64);
    const step = Math.floor((Number(index) * cal + length / 2) / length);
    return ((offset % cal) + step) % cal;
  }

  async _atBegin() {
    const startInput = this.shadowRoot.getElementById("atStartIdx");
    const stepInput = this.shadowRoot.getElementById("atStepSize");
    const maxIdx = this._atMaxIndex();
    const startIdx = Math.max(1, Math.min(maxIdx, startInput ? Number(startInput.value) || maxIdx : maxIdx));
    const stepSize = Math.max(1, Math.min(100, stepInput ? Number(stepInput.value) || 25 : 25));

    this._atState = {
      running: true,
      phase: "homing",
      charIndex: startIdx,
      stepSize,
      selected: new Set(),
      countdown: 12,
    };
    this._renderAutoTune();

    // There is no standalone `stop` or `hardware` websocket command. Stop any
    // running app/playlist first (otherwise it repaints the board while we
    // home and measure) and then home every module through the real command.
    try {
      await this._send("stop_app");
    } catch (e) {
      // Nothing was running; the display is already idle.
    }

    try {
      await this._send("home_all");
    } catch (e) {
      // _send() already reported the failure; do not continue the wizard on a
      // board that was not homed, every measurement would be meaningless.
      this._atState = null;
      this._renderAutoTune();
      return;
    }

    for (let c = 12; c > 0; c--) {
      if (!this._atState || !this._atState.running) return;
      this._atState.countdown = c;
      this._renderAutoTune();
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!this._atState || !this._atState.running) return;
    await this._atGoToChar(startIdx);
  }

  async _atGoToChar(idx) {
    if (!this._atState) return;
    this._atState.charIndex = idx;
    this._atState.phase = "ahead";
    this._atState.selected.clear();
    const drum = this._atDrum();
    const ch = drum[idx] || " ";
    const board = this._board();
    const coordinator = this._coordinator();
    const modules = coordinator.modules || [];
    const count = (board.rows * board.cols) || modules.length || 45;

    this._renderAutoTune();

    try {
      await this._send("send_text", {
        text: ch.repeat(count),
        start: 1,
        style: "ltr",
        speed: 0,
        stop: true,
        raw: true,
      });
    } catch (e) {
      console.error(e);
    }
  }

  _atToggleCell(modId) {
    if (!this._atState || this._atState.phase === "verify") return;
    if (this._atState.selected.has(modId)) {
      this._atState.selected.delete(modId);
    } else {
      this._atState.selected.add(modId);
    }
    this._renderAutoTune();
  }

  async _atApplyAhead() {
    if (!this._atState || !this._atState.selected.size) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    const stepInput = this.shadowRoot.getElementById("atStepSizeActive");
    const step = stepInput ? Number(stepInput.value) || 25 : this._atState.stepSize || 25;
    this._atState.stepSize = step;
    const charIdx = this._atState.charIndex;
    const drum = this._atDrum();

    for (const modId of this._atState.selected) {
      const module = this._moduleFor(modId);
      if (!module) continue;
      const cal = Number(module.total_steps) || 4096;
      const expected = this._expectedStep(module, charIdx, drum.length);
      const positions = module.map_of_positions || {};
      const tuned = positions[String(charIdx)];
      // A sane map entry is within half a flap of the geometric position.
      // Further away it points at a different flap (old wizard maps that
      // omitted home_offset), so start from the model instead of moving a
      // whole revolution in 25-step clicks.
      const near =
        tuned !== undefined && Math.abs(Number(tuned) - expected) <= cal / 128;
      const base = near ? Number(tuned) : expected;
      const newVal = Math.max(0, Math.min(cal - 1, base - step));
      await this._send("calibrate", {
        module: modId,
        action: "apply",
        positions: { [String(charIdx)]: newVal },
      });
      if (!module.map_of_positions) module.map_of_positions = {};
      module.map_of_positions[String(charIdx)] = newVal;
    }

    // The user may have pressed Abort while the calibrate round-trips were in
    // flight; _atState is null then and the rest of the flow must not run.
    if (!this._atState) return;
    this._toast(formatMessage(this._t("at_ahead_apply"), { step, count: this._atState.selected.size }));
    this._atState.selected.clear();
    this._atState.phase = "verify";
    this._renderAutoTune();

    // Master moves are blocking and the map write has to reach EEPROM, so
    // give the modules a moment before requesting the verification frame.
    await new Promise((r) => setTimeout(r, AT_SETTLE_MS));
    if (!this._atState) return;

    // Re-send to verify
    const ch = drum[charIdx] || " ";
    const board = this._board();
    const count = (board.rows * board.cols) || (this._coordinator().modules || []).length || 45;
    try {
      await this._send("send_text", {
        text: ch.repeat(count),
        start: 1,
        style: "ltr",
        speed: 0,
        stop: true,
        raw: true,
      });
    } catch (e) {
      console.error(e);
    }
  }

  async _atApplyBehind() {
    if (!this._atState || !this._atState.selected.size) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    const stepInput = this.shadowRoot.getElementById("atStepSizeActive");
    const step = stepInput ? Number(stepInput.value) || 25 : this._atState.stepSize || 25;
    this._atState.stepSize = step;
    const charIdx = this._atState.charIndex;
    const drum = this._atDrum();

    for (const modId of this._atState.selected) {
      const module = this._moduleFor(modId);
      if (!module) continue;
      const cal = Number(module.total_steps) || 4096;
      const expected = this._expectedStep(module, charIdx, drum.length);
      const positions = module.map_of_positions || {};
      const tuned = positions[String(charIdx)];
      const near =
        tuned !== undefined && Math.abs(Number(tuned) - expected) <= cal / 128;
      const base = near ? Number(tuned) : expected;
      const newVal = Math.max(0, Math.min(cal - 1, base + step));
      await this._send("calibrate", {
        module: modId,
        action: "apply",
        positions: { [String(charIdx)]: newVal },
      });
      if (!module.map_of_positions) module.map_of_positions = {};
      module.map_of_positions[String(charIdx)] = newVal;
    }

    if (!this._atState) return;
    this._toast(formatMessage(this._t("at_behind_apply"), { step, count: this._atState.selected.size }));
    this._atState.selected.clear();
    this._atState.phase = "verify";
    this._renderAutoTune();

    await new Promise((r) => setTimeout(r, AT_SETTLE_MS));
    if (!this._atState) return;

    // Re-send to verify
    const ch = drum[charIdx] || " ";
    const board = this._board();
    const count = (board.rows * board.cols) || (this._coordinator().modules || []).length || 45;
    try {
      await this._send("send_text", {
        text: ch.repeat(count),
        start: 1,
        style: "ltr",
        speed: 0,
        stop: true,
        raw: true,
      });
    } catch (e) {
      console.error(e);
    }
  }

  _atSkipAhead() {
    if (!this._atState) return;
    this._atState.phase = "behind";
    this._atState.selected.clear();
    this._renderAutoTune();
  }

  _atRecheckAhead() {
    if (!this._atState) return;
    this._atState.phase = "ahead";
    this._atState.selected.clear();
    this._renderAutoTune();
  }

  async _atNextChar() {
    if (!this._atState) return;
    const next = this._atState.charIndex - 1;
    if (next < 1) {
      this._atState.phase = "done";
      this._renderAutoTune();
      return;
    }
    await this._atGoToChar(next);
  }

  async _atJump() {
    const input = this.shadowRoot.getElementById("atJumpIdx");
    const val = input ? Number(input.value) : 1;
    const maxIdx = this._atMaxIndex();
    if (val >= 1 && val <= maxIdx) {
      await this._atGoToChar(val);
    }
  }

  _atAbort() {
    this._atState = null;
    this._renderAutoTune();
    this._toast(this._t("at_abort_btn"));
  }

  _atRestart() {
    this._atState = null;
    this._renderAutoTune();
  }

  async _teachStart() {
    const module = this._moduleFor(this._selectedModule);
    if (!module) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }
    const positions = module.map_of_positions || {};
    const tuned = positions["0"];
    const active = tuned !== undefined ? Number(tuned) : 0;
    this._teachState = {
      running: true,
      moduleId: module.id,
      flapIndex: 0,
      currentStep: active,
      done: false,
    };
    await this._send("calibrate", {
      module: module.id,
      action: "goto",
      index: 0,
    });
    this._renderTeach();
  }

  async _teachNudge(delta) {
    if (!this._teachState || !this._teachState.running) return;
    const module = this._moduleFor(this._teachState.moduleId);
    if (!module) return;
    const input = this.shadowRoot.getElementById("teachStepInput");
    const current = input ? Number(input.value) : this._teachState.currentStep;
    const next = Math.max(0, Math.min(65535, current + Number(delta)));
    this._teachState.currentStep = next;
    if (input) input.value = String(next);
    await this._send("calibrate", {
      module: module.id,
      action: "step",
      steps: Number(delta),
    });
    this._renderTeach();
  }

  async _teachRecordNext() {
    if (!this._teachState || !this._teachState.running) return;
    const input = this.shadowRoot.getElementById("teachStepInput");
    const step = input ? Number(input.value) : this._teachState.currentStep;
    const { moduleId, flapIndex } = this._teachState;
    const module = this._moduleFor(moduleId);
    if (!module) return;

    await this._send("calibrate", {
      module: moduleId,
      action: "apply",
      positions: { [String(flapIndex)]: step },
    });
    if (!module.map_of_positions) module.map_of_positions = {};
    module.map_of_positions[String(flapIndex)] = step;

    const nextFlap = flapIndex + 1;
    if (nextFlap > 63) {
      this._teachState.done = true;
      this._renderTeach();
      this._toast(this._t("teach_done"));
      return;
    }

    const expectedNext = this._expectedStep(module, nextFlap);
    const tunedNext = module.map_of_positions[String(nextFlap)];
    this._teachState.flapIndex = nextFlap;
    this._teachState.currentStep = tunedNext !== undefined ? Number(tunedNext) : expectedNext;

    await this._send("calibrate", {
      module: moduleId,
      action: "goto",
      index: nextFlap,
    });
    this._renderTeach();
  }

  async _teachSkip() {
    if (!this._teachState || !this._teachState.running) return;
    const { moduleId, flapIndex } = this._teachState;
    const module = this._moduleFor(moduleId);
    if (!module) return;

    const nextFlap = flapIndex + 1;
    if (nextFlap > 63) {
      this._teachState.done = true;
      this._renderTeach();
      this._toast(this._t("teach_done"));
      return;
    }

    const expectedNext = this._expectedStep(module, nextFlap);
    const tunedNext = (module.map_of_positions || {})[String(nextFlap)];
    this._teachState.flapIndex = nextFlap;
    this._teachState.currentStep = tunedNext !== undefined ? Number(tunedNext) : expectedNext;

    await this._send("calibrate", {
      module: moduleId,
      action: "goto",
      index: nextFlap,
    });
    this._renderTeach();
  }

  async _teachPrev() {
    if (!this._teachState || !this._teachState.running || this._teachState.flapIndex <= 0) return;
    const { moduleId, flapIndex } = this._teachState;
    const module = this._moduleFor(moduleId);
    if (!module) return;

    const prevFlap = flapIndex - 1;
    const expectedPrev = this._expectedStep(module, prevFlap);
    const tunedPrev = (module.map_of_positions || {})[String(prevFlap)];
    this._teachState.flapIndex = prevFlap;
    this._teachState.currentStep = tunedPrev !== undefined ? Number(tunedPrev) : expectedPrev;

    await this._send("calibrate", {
      module: moduleId,
      action: "goto",
      index: prevFlap,
    });
    this._renderTeach();
  }

  _teachAbort() {
    this._teachState = null;
    this._renderTeach();
    this._toast(this._t("teach_abort"));
  }

  _teachRestart() {
    this._teachState = null;
    this._renderTeach();
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
