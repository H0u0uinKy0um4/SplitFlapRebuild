/** Panel component logic. */

import { formatMessage } from "../utils.js?v=0.1.6";


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
      this._updateDrumCharCount();
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
    if (target.dataset && target.dataset.setting && target.closest("#settingsGroups")) {
      this._settingsDirty = true;
    }
  }

  async _onChange(event) {
    const target = event.target;
    if (!target) return;
    if (target.id === "restoreFile") {
      await this._restoreFile(target);
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
    const root = this.shadowRoot.getElementById("settingsGroups");
    const settings = this._collectSettings(root);
    await this._send("set_settings", { settings });
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
    const value = String(textarea.value || "").slice(0, 64);
    const settings = { default_drum: value };
    await this._send("set_settings", { settings });
    this._settingsDirty = false;
    this._toast(this._t("settings_saved"));
  }

  _resetDefaultDrum() {
    const textarea = this.shadowRoot.getElementById("defaultDrum");
    if (textarea) {
      textarea.value = this._t("default_drum_placeholder");
      this._updateDrumCharCount();
    }
  }

  _updateDrumCharCount() {
    const textarea = this.shadowRoot.getElementById("defaultDrum");
    const counter = this.shadowRoot.getElementById("drumCharCount");
    if (textarea && counter) {
      counter.textContent = `${textarea.value.length} / 64`;
    }
  }


};
