/** Settings tab: display/app settings, layout, drums, OTA and system info. */

import { DOMAIN, VERSION } from "../../constants.js?v=1.2.7";
import { escapeAttr, escapeHtml, formatMessage } from "../../utils.js?v=1.2.7";

export const PanelMixin = (Base) =>
  class extends Base {
    _settingsPage() {
      return `
        <section class="page" data-page="settings">
          <nav class="subtabs">
            <button class="subtab active" data-action="subtab" data-group="settings" data-sub="display">${this._t("subtab_display")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="apps">${this._t("subtab_apps")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="layout">${this._t("subtab_layout")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="drum">${this._t("subtab_drums")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="system">${this._t("subtab_system")}</button>
          </nav>

          <div class="subpage active" data-subpage="settings" data-sub="display">
            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('display_settings')}</h2>
                <button class="btn" data-action="save-settings">${this._t("save_settings")}</button>
              </div>
              <div id="displaySettingsGroups" class="settings-groups" style="margin-top:14px"></div>
            </div>
          </div>

          <div class="subpage" data-subpage="settings" data-sub="apps">
            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('app_settings')}</h2>
                <button class="btn" data-action="save-settings">${this._t("save_settings")}</button>
              </div>
              <nav class="subtabs nested" id="appsSettingsSubtabs"></nav>
              <div id="appsSettingsGroups" class="settings-groups"></div>
            </div>
          </div>

          <div class="subpage" data-subpage="settings" data-sub="layout">
            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('physical_layout')}</h2>
                <span class="muted" id="layoutSummary"></span>
              </div>
              <div class="preview" id="layoutPreview" style="margin-top:12px"></div>
              <div class="layout-alert" id="layoutError"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._t('layout_help')}
              </p>
            </div>
          </div>

          <div class="subpage" data-subpage="settings" data-sub="drum">
            <div class="card">
              <h2 style="margin:0">${this._t('default_drum')}</h2>
              <label class="field" style="margin-top:12px">
                <span>${this._t('drum_editor_help')}</span>
                <textarea id="defaultDrum" rows="2" maxlength="64" placeholder="${escapeAttr(this._t('default_drum_placeholder'))}"></textarea>
              </label>
              <div class="row" style="margin-top:8px;align-items:center">
                <button class="btn secondary" data-action="save-default-drum">${this._t('save')}</button>
                <button class="btn secondary" data-action="reset-default-drum">${this._t('reset_to_stock')}</button>
                <span class="muted" id="drumCharCount"></span>
              </div>
              <small class="muted">${this._t('default_drum_fallback_note')}</small>
            </div>

            <div class="card" id="drumLibraryCard">
              <h2 style="margin:0">${this._t('drum_library')}</h2>
              <p class="muted" style="margin:6px 0 0">
                ${this._t('drum_library_help')}
              </p>
              <label class="field" style="margin-top:12px">
                <span>${this._t('drum_editor_help')}</span>
                <textarea id="drumEditor" rows="2" maxlength="64" placeholder="${escapeAttr(this._t('default_drum_placeholder'))}"></textarea>
              </label>
              <div class="row" style="margin-top:8px;align-items:center">
                <input id="drumName" type="text" placeholder="${escapeAttr(this._t('drum_name'))}" style="max-width:190px">
                <button class="btn secondary" data-action="save-drum">${this._t('save')}</button>
                <span class="muted" id="drumEditorCharCount"></span>
              </div>
              <div class="list" id="savedDrums" style="margin-top:14px"></div>
            </div>
          </div>

          <div class="subpage" data-subpage="settings" data-sub="system">
            <div class="card">
              <h2>${this._t('firmware_update')}</h2>
              <p class="muted" style="margin-top:0">
                ${this._t('firmware_help')}
              </p>
              <div class="row" style="align-items:flex-end">
                <label class="field" style="flex:1 1 120px">
                  <span>${this._t('module')}</span>
                  <input id="otaModule" type="number" min="1" max="255" step="1" list="otaModuleList" placeholder="1">
                  <datalist id="otaModuleList"></datalist>
                </label>
                <label class="field" style="flex:2 1 240px">
                  <span>${this._t('firmware_file')}</span>
                  <input id="otaFile" type="file" accept=".hex,text/plain">
                </label>
              </div>
              <div class="muted" id="otaInstalled" style="margin-top:8px"></div>
              <div class="actions">
                <button class="btn secondary" data-action="flash-firmware">${this._t('flash_firmware')}</button>
                <button class="btn secondary" data-action="cancel-firmware" disabled>${this._t('cancel')}</button>
                <button class="btn secondary" data-action="reset-firmware">${this._t('ota_reset')}</button>
              </div>
              <div class="ota-progress"><span id="otaBar"></span></div>
              <div class="muted" id="otaStatus" style="margin-top:8px">${this._t('ota_state_idle')}</div>
            </div>

            <div class="card">
              <h2>${escapeHtml(this._t('backup_restore'))}</h2>
              <p class="muted" style="margin-top:0">
                ${this._t('backup_help')}
              </p>
              <div class="actions">
                <button class="btn secondary" data-action="download-backup">${this._t('download_backup_json')}</button>
                <button class="btn secondary" data-action="restore-backup">${this._t('restore_from_json')}</button>
                <input id="restoreFile" type="file" accept="application/json,.json" style="display:none">
              </div>
              <div class="muted" id="backupStatus" style="margin-top:8px"></div>
            </div>

            <div class="card">
              <h2>${this._t('connection')}</h2>
              <div class="muted" id="connectionInfo">${this._t('waiting_state')}</div>
            </div>
          </div>
        </section>`;
    }

    _renderDrumLibrary() {
      const node = this.shadowRoot.getElementById("savedDrums");
      if (!node) return;
      const drums = (this._engine() && this._engine().saved_drums) || {};
      const names = Object.keys(drums);
      if (!names.length) {
        node.innerHTML = `<div class="empty">${escapeHtml(
          this._t("no_saved_drums")
        )}</div>`;
        return;
      }
      node.innerHTML = names
        .sort((a, b) => a.localeCompare(b))
        .map((name) => {
          const drum = String(drums[name] || "");
          // Show a readable preview; the full 64 characters ride along in
          // the title tooltip. Trim only the display: flap 0 is a space.
          const preview =
            drum.length > 24 ? `${drum.slice(0, 24).trimEnd()}…` : drum.trim();
          return `
          <div class="list-item">
            <span class="text" title="${escapeAttr(drum)}">${escapeHtml(name)}</span>
            <span class="muted mono" title="${escapeAttr(drum)}">${escapeHtml(
              preview || "␣"
            )}</span>
            <button class="icon-btn" data-action="edit-drum" data-name="${escapeAttr(name)}" title="${escapeAttr(this._t('edit'))}">✎</button>
            <button class="icon-btn" data-action="delete-drum" data-name="${escapeAttr(name)}" title="${escapeAttr(this._t('delete'))}">✕</button>
          </div>`;
        })
        .join("");
    }

    _renderLayout() {
      if (!this._state) return;
      const node = this.shadowRoot.getElementById("layoutPreview");
      const summary = this.shadowRoot.getElementById("layoutSummary");
      const errorNode = this.shadowRoot.getElementById("layoutError");
      if (!node) return;

      const board = this._board();
      const coordinator = this._coordinator() || {};
      const modules = coordinator.modules || [];
      let html = "";
      let slotBase = 0;
      for (let row = 0; row < board.rows; row += 1) {
        const count = Math.max(
          0,
          Math.min(board.cols, Number(board.rowCounts[row]) || 0)
        );
        const offset = Math.max(0, Number(board.rowOffsets[row]) || 0);
        for (let col = 0; col < board.cols; col += 1) {
          if (col < offset || col >= offset + count) {
            html += `<div class="mod void" title="${escapeAttr(
              this._t("blank_cell")
            )}"></div>`;
            continue;
          }
          const slot = slotBase + col - offset;
          const module = modules[slot];
          const label = module ? module.id : slot + 1;
          const flap =
            module && module.displayed_flap != null
              ? module.displayed_flap
              : module && module.flap
                ? module.flap
                : "";
          html += `
          <div class="mod" title="${escapeAttr(this._t('module'))} ${escapeAttr(label)}${module ? "" : ` (${escapeAttr(this._t('expected'))})`}">
            <span class="mid">${escapeHtml(label)}</span>
            <span class="mchar">${flap === " " || flap === "" ? "·" : escapeHtml(flap)}</span>
          </div>`;
        }
        slotBase += count;
      }
      const maxCell = this._moduleCell();
      const width = this._gridMaxWidth(board.cols, maxCell, 4);
      const charFont = Math.max(10, Math.round(maxCell * 0.26));
      const idFont = Math.max(8, Math.round(maxCell * 0.13));
      node.innerHTML = `<div class="mod-matrix" style="--cols:${board.cols};--mod-max:${maxCell}px;--mod-char:${charFont}px;--mod-id:${idFont}px;max-width:${width}px;margin:0 auto">${html}</div>`;
      this._fitPreview(node);

      if (summary) {
        summary.textContent = formatMessage(this._t("layout_summary"), {
          rows: board.rows,
          cols: board.cols,
          counts: board.rowCounts.join(","),
          detected: this._plural("modules", board.modules),
        });
      }
      if (errorNode) {
        errorNode.textContent = board.error
          ? formatMessage(this._t("layout_error"), {
              error: this._layoutErrorText(board.error),
            })
          : "";
        errorNode.style.display = board.error ? "block" : "none";
      }
    }

    _fieldHtml(field, value) {
      const type = field.type || "text";
      const key = escapeAttr(field.key);
      const current = value == null ? "" : String(value);
      let input = "";

      if (type === "select") {
        const options = Array.isArray(field.options) ? field.options.slice() : [];
        if (current !== "" && !options.includes(current)) options.unshift(current);
        input = `<select data-setting="${key}">${options
          .map(
            (option) =>
              `<option value="${escapeAttr(option)}"${
                String(option) === current ? " selected" : ""
              }>${escapeHtml(this._optionLabel(field.key, option))}</option>`
          )
          .join("")}</select>`;
      } else {
        const inputType =
          type === "number"
            ? "number"
            : type === "password"
              ? "password"
              : type === "datetime-local"
                ? "datetime-local"
                : "text";
        const attrs = [`type="${inputType}"`, `data-setting="${key}"`];
        const placeholder = this._settingPlaceholder(
          field.key,
          field.placeholder || ""
        );
        if (placeholder) attrs.push(`placeholder="${escapeAttr(placeholder)}"`);
        if (field.min != null) attrs.push(`min="${escapeAttr(field.min)}"`);
        if (field.max != null) attrs.push(`max="${escapeAttr(field.max)}"`);
        if (field.step != null) attrs.push(`step="${escapeAttr(field.step)}"`);
        if (inputType === "password") attrs.push('autocomplete="new-password"');
        input = `<input ${attrs.join(" ")} value="${escapeAttr(current)}">`;
      }

      const help = this._settingHelp(field.key, field.help || "");
      const visible =
        field.visible_when && field.visible_when.key
          ? ` data-visible-key="${escapeAttr(field.visible_when.key)}" data-visible-value="${escapeAttr(
              JSON.stringify(
                field.visible_when.equals == null ? "" : field.visible_when.equals
              )
            )}"`
          : "";
      return `
      <label class="field"${visible}>
        <span>${escapeHtml(this._settingLabel(field.key, field.label || field.key))}</span>
        ${input}
        ${help ? `<small>${escapeHtml(help)}</small>` : ""}
      </label>`;
    }

    _applyFieldVisibility(root) {
      if (!root) return;
      const inputs = new Map();
      root.querySelectorAll("[data-setting]").forEach((input) => {
        inputs.set(input.dataset.setting, input);
      });
      root.querySelectorAll("[data-visible-key]").forEach((label) => {
        const source = inputs.get(label.dataset.visibleKey);
        let expected = "";
        try {
          expected = JSON.parse(label.dataset.visibleValue);
        } catch (err) {
          expected = label.dataset.visibleValue;
        }
        let actual = source ? source.value : "";
        if (source && source.type === "number" && actual !== "") {
          actual = Number(actual);
        }
        label.classList.toggle("hidden", String(actual) !== String(expected));
      });
    }

    _settingsGroupHtml(group, settings, showHeading = true, paneKey = null) {
      const pane =
        paneKey == null ? "" : ` data-app-pane="${escapeAttr(paneKey)}"`;
      const classes =
        paneKey == null ? "settings-group" : "settings-group app-settings-pane";
      return `
      <div class="${classes}"${pane}>
        ${
          showHeading
            ? `<h3>${escapeHtml(group.icon || "")} ${escapeHtml(
                this._settingGroup(group.key, group.name || group.key)
              )}</h3>`
            : ""
        }
        <div class="settings-grid">
          ${(group.fields || [])
            .map((field) => this._fieldHtml(field, settings[field.key]))
            .join("")}
        </div>
      </div>`;
    }

    _renderSettings() {
      if (!this._state) return;
      const engine = this._engine();
      const groups = engine.settings_groups || [];
      const settings = engine.settings || {};

      const displayNode = this.shadowRoot.getElementById("displaySettingsGroups");
      const appsNode = this.shadowRoot.getElementById("appsSettingsGroups");
      const appsNav = this.shadowRoot.getElementById("appsSettingsSubtabs");
      if (!displayNode && !appsNode) return;

      // The group's "category" field routes it; anything unrecognized falls to
      // Display so a new backend group can never end up invisible.
      const displayGroups = groups.filter((group) => group.category !== "apps");
      const appGroups = groups.filter((group) => group.category === "apps");

      if (!this._settingsBuilt) {
        if (displayNode) {
          displayNode.innerHTML = displayGroups
            .map((group) => this._settingsGroupHtml(group, settings))
            .join("");
        }
        if (appsNav) {
          appsNav.innerHTML = appGroups
            .map(
              (group) =>
                `<button class="subtab" data-action="settings-app" data-key="${escapeAttr(
                  group.key
                )}">${escapeHtml(
                  `${group.icon ? `${group.icon} ` : ""}${this._settingGroup(
                    group.key,
                    group.name || group.key
                  )}`
                )}</button>`
            )
            .join("");
        }
        if (appsNode) {
          // Render every app group but show only the active one. Switching the
          // third-level tab then only toggles CSS, so unsaved inputs survive.
          appsNode.innerHTML = appGroups
            .map((group) =>
              this._settingsGroupHtml(group, settings, false, group.key)
            )
            .join("");
        }
        this._settingsBuilt = true;
      }

      this._applyAppSettingsTab();

      if (this._settingsDirty) return;
      const active = this.shadowRoot.activeElement;
      for (const node of [displayNode, appsNode]) {
        if (!node) continue;
        node.querySelectorAll("[data-setting]").forEach((input) => {
          if (input === active) return;
          const key = input.dataset.setting;
          const value = settings[key];
          const next = value == null ? "" : String(value);
          if (input.value !== next) input.value = next;
        });
        this._applyFieldVisibility(node);
      }
    }

    _applyAppSettingsTab() {
      const buttons = Array.from(
        this.shadowRoot.querySelectorAll(
          '#appsSettingsSubtabs [data-action="settings-app"]'
        )
      );
      if (!buttons.length) return;
      const keys = buttons.map((button) => button.dataset.key);
      if (!keys.includes(this._appSettingsKey)) this._appSettingsKey = keys[0];
      for (const button of buttons) {
        button.classList.toggle(
          "active",
          button.dataset.key === this._appSettingsKey
        );
      }
      this.shadowRoot.querySelectorAll("[data-app-pane]").forEach((pane) => {
        pane.classList.toggle(
          "active",
          pane.dataset.appPane === this._appSettingsKey
        );
      });
    }

    _setAppSettingsTab(key) {
      if (!key) return;
      this._appSettingsKey = key;
      try {
        window.localStorage.setItem(`${DOMAIN}_app_settings`, key);
      } catch (err) {
        /* ignore */
      }
      this._applyAppSettingsTab();
    }

    _renderOtaInstalled() {
      const node = this.shadowRoot.getElementById("otaInstalled");
      if (!node) return;
      const input = this.shadowRoot.getElementById("otaModule");
      const moduleId = input ? String(input.value || "").trim() : "";
      const module = moduleId ? this._moduleFor(moduleId) : null;
      const version = module && module.fw_version ? String(module.fw_version) : "";
      // fw_bus_compat/fw_bus_compatible are the bus-side values; the old
      // fw_compat/fw_compatible names remain as aliases for older masters.
      const compat =
        module && module.fw_bus_compat != null
          ? module.fw_bus_compat
          : module && module.fw_compat != null
            ? module.fw_compat
            : null;
      const compatible =
        module && module.fw_bus_compatible !== undefined
          ? module.fw_bus_compatible
          : module
            ? module.fw_compatible
            : undefined;
      const coordinator = this._coordinator() || {};
      if (!version) {
        node.textContent = this._t("firmware_installed_unknown");
      } else if (compatible === false) {
        node.textContent = formatMessage(this._t("firmware_incompatible"), {
          version,
          compat,
          expected:
            coordinator.master_bus_compat == null
              ? this._t("unknown")
              : coordinator.master_bus_compat,
        });
      } else if (compat != null) {
        node.textContent = formatMessage(this._t("firmware_installed_compat"), {
          version,
          compat,
        });
      } else {
        node.textContent = formatMessage(this._t("firmware_installed"), {
          version,
        });
      }
    }

    _renderOta() {
      const coordinator = this._coordinator() || {};
      const modules = coordinator.modules || [];
      const ids = modules.map((module) => String(module.id));
      const list = this.shadowRoot.getElementById("otaModuleList");
      if (list) {
        const signature = ids.join(",");
        if (list.dataset.signature !== signature) {
          list.innerHTML = ids
            .map((id) => `<option value="${escapeAttr(id)}"></option>`)
            .join("");
          list.dataset.signature = signature;
        }
      }
      // The id is freely editable: a module stuck in the bootloader no longer
      // answers the scan, so it must still be targetable for a re-flash or a
      // reset back into its application.
      const input = this.shadowRoot.getElementById("otaModule");
      if (input && !input.value && ids.length) input.value = ids[0];
      this._renderOtaInstalled();

      const ota = coordinator.ota || { state: "idle" };
      const state = String(ota.state || "idle");
      const active = ["collecting", "entering", "flashing", "verifying"].includes(
        state
      );
      const cancelBtn = this.shadowRoot.querySelector(
        '[data-action="cancel-firmware"]'
      );
      // Keep cancel clickable for any non-idle state (including failed /
      // cancelled) so a stuck session can always be aborted, not just while
      // an active phase is reported.
      if (cancelBtn) cancelBtn.disabled = !(this._otaBusy || state !== "idle");
      const resetBtn = this.shadowRoot.querySelector(
        '[data-action="reset-firmware"]'
      );
      if (resetBtn) resetBtn.disabled = active || this._otaBusy;

      let percent = null;
      if (typeof ota.progress === "number") {
        percent = Math.max(0, Math.min(100, ota.progress));
      } else if (state === "collecting" && this._otaSize && ota.received) {
        percent = Math.min(
          100,
          Math.round((ota.received / this._otaSize) * 100)
        );
      }
      const bar = this.shadowRoot.getElementById("otaBar");
      if (bar) {
        // The progress track only belongs to a running session. A finished
        // session keeps state "done" and the master reports progress 100, so
        // hiding only on "idle" would leave a full blue bar on screen.
        const showProgress = active || (this._otaBusy && !active);
        const track = bar.parentElement;
        if (track) track.classList.toggle("hidden", !showProgress);
        bar.style.width = showProgress && percent != null ? `${percent}%` : "0%";
      }

      const status = this.shadowRoot.getElementById("otaStatus");
      if (!status) return;
      if (this._otaBusy && !active) {
        status.textContent = this._t("ota_uploading");
        return;
      }
      const parts = [this._t(`ota_state_${state}`)];
      if (ota.module != null) {
        parts.push(formatMessage(this._t("ota_module"), { module: ota.module }));
      }
      if (percent != null) parts.push(`${percent}%`);
      let text = parts.join(" — ");
      if (ota.error) text += ` — ${ota.error}`;
      status.textContent = text;
    }

    _renderConnectionInfo() {
      const node = this.shadowRoot.getElementById("connectionInfo");
      if (!node || !this._state) return;
      const coordinator = this._coordinator();
      const engine = this._engine();
      const board = this._board();
      const parts = [
        `${this._t("mqtt_prefix")}: ${coordinator.prefix || "—"}`,
        `${this._t("master")}: ${this._t(
          coordinator.online ? "master_online" : "master_offline"
        )}`,
        `${this._t("master_version")}: ${
          coordinator.master_version || this._t("unknown")
        }`,
        `${this._t("bus_compatibility")}: ${
          coordinator.master_bus_compat == null
            ? this._t("unknown")
            : coordinator.master_bus_compat
        }`,
        `${this._t("mqtt_compatibility")}: ${
          coordinator.master_mqtt_compat == null
            ? this._t("unknown")
            : coordinator.master_mqtt_compat
        } (${this._t("integration")}: ${
          coordinator.mqtt_compat == null
            ? this._t("unknown")
            : coordinator.mqtt_compat
        })`,
        `${this._t("last_status")}: ${
          coordinator.last_status || this._t("never")
        }`,
        `${this._t("modules_label")}: ${coordinator.modules_count || 0}`,
        `${this._t("board")}: ${board.rows} × ${board.cols}`,
        `${this._t("engine")}: ${this._modeLabel(engine.mode)}${
          engine.active_app ? ` (${this._appName(engine.active_app)})` : ""
        }`,
        `${this._t("integration")}: v${this._state.version || VERSION}`,
      ];
      node.textContent = parts.join(" • ");
    }
  };
