/** Settings tab: display/app settings, drums, OTA and system info. */

import { DOMAIN, VERSION } from "../../constants.js?v=2.0.0";
import { escapeAttr, escapeHtml, formatMessage } from "../../utils.js?v=2.0.0";

const checkedSettingValue = (value) =>
  value === true ||
  value === 1 ||
  ["true", "yes", "on", "1"].includes(String(value).trim().toLowerCase());

// The backend still sends one Display group; the panel splits it into the
// three clean sections from the settings mock without changing the setting
// keys or the save path.
const DISPLAY_GEOMETRY_KEYS = new Set(["row_counts", "rows", "cols"]);
const DISPLAY_DEVELOPER_KEYS = new Set([
  "debug_ignore_module_limit",
  "debug_allow_incompatible_firmware",
]);
const DISPLAY_FIELD_HINTS = {
  row_counts: "display_hint_row_counts",
  ui_scale: "display_hint_ui_scale",
  debug_ignore_module_limit: "display_hint_debug_ignore_module_limit",
  debug_allow_incompatible_firmware:
    "display_hint_debug_allow_incompatible_firmware",
};

export const PanelMixin = (Base) =>
  class extends Base {
    _settingsPage() {
      return `
        <section class="page" data-page="settings">
          <nav class="subtabs">
            <button class="subtab active" data-action="subtab" data-group="settings" data-sub="display">${this._t("subtab_display")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="apps">${this._t("subtab_apps")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="drum">${this._t("subtab_drums")}</button>
            <button class="subtab" data-action="subtab" data-group="settings" data-sub="system">${this._t("subtab_system")}</button>
            <button class="btn settings-save hidden" data-action="save-settings">${this._t("save_settings")}</button>
          </nav>

          <div class="subpage active" data-subpage="settings" data-sub="display">
            <div class="card settings-card">
              <div class="settings-card-head">
                <div>
                  <h2>${this._t('display_settings')}</h2>
                  <p class="muted">${this._t('display_settings_hint')}</p>
                </div>
              </div>
              <div id="displaySettingsGroups" class="settings-groups"></div>
            </div>
          </div>

          <div class="subpage" data-subpage="settings" data-sub="apps">
            <div class="card app-settings-card">
              <div class="app-settings-split" id="appSettingsSplit">
                <aside class="app-settings-rail" id="appsSettingsSubtabs"></aside>
                <div class="app-settings-form">
                  <div class="app-settings-head">
                    <div class="row between" style="align-items:flex-start">
                      <div style="min-width:0">
                        <h2 id="appSettingsTitle">${this._t('app_settings')}</h2>
                        <p class="muted hidden" id="appSettingsDesc"></p>
                      </div>
                      <button class="btn" data-action="save-settings">${this._t("save_settings")}</button>
                    </div>
                  </div>
                  <div id="appsSettingsGroups" class="settings-groups"></div>
                </div>
              </div>
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
            <nav class="subtabs nested">
              <button class="subtab active" data-action="subtab" data-group="system" data-sub="module">${this._t('subtab_module_ota')}</button>
              <button class="subtab" data-action="subtab" data-group="system" data-sub="master">${this._t('subtab_master_ota')}</button>
              <button class="subtab" data-action="subtab" data-group="system" data-sub="connection">${this._t('subtab_connection_backup')}</button>
            </nav>

            <div class="subpage nested active" data-subpage="system" data-sub="module">
              <div class="card system-card">
                <div class="system-group">
                  <div class="system-group-head">
                    <h3 class="system-group-title">${this._t('system_group_ota')}</h3>
                    <span class="status-badge" id="otaInstalled">${this._t('firmware_installed_unknown')}</span>
                  </div>
                  <div class="ota-grid">
                    <label class="field">
                      <span>${this._t('firmware_target_module')}</span>
                      <input id="otaModule" type="number" min="1" max="255" step="1" list="otaModuleList" placeholder="1">
                      <datalist id="otaModuleList"></datalist>
                    </label>
                    <label class="field">
                      <span>${this._t('firmware_release_select')}</span>
                      <span class="inline-field">
                        <select id="firmwareRelease"><option value="">${this._t('firmware_release_none')}</option></select>
                        <button type="button" class="icon-action" data-action="refresh-firmware-releases" title="${escapeAttr(this._t('firmware_release_refresh'))}" aria-label="${escapeAttr(this._t('firmware_release_refresh'))}">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                            <polyline points="21 3 21 9 15 9"></polyline>
                          </svg>
                        </button>
                      </span>
                      <span class="ota-meta" id="firmwareReleaseInfo">${this._t('firmware_release_loading')}</span>
                    </label>
                  </div>
                  <div class="actions">
                    <button class="btn" data-action="flash-release-firmware">${this._t('firmware_release_flash')}</button>
                    <button class="btn secondary" data-action="flash-release-firmware-all">${this._t('firmware_release_flash_all')}</button>
                    <button class="btn cancel" data-action="cancel-firmware" disabled>${this._t('cancel')}</button>
                  </div>
                  <div class="muted" id="otaBulkStatus"></div>
                  <div class="ota-progress"><span id="otaBar"></span></div>
                  <div class="muted" id="otaStatus">${this._t('ota_state_idle')}</div>
                  <details>
                    <summary>${this._t('firmware_release_local_title')}</summary>
                    <div class="advanced-box">
                      <input id="otaFile" type="file" accept=".hex,text/plain">
                      <button class="btn secondary" data-action="flash-firmware">${this._t('flash_firmware')}</button>
                      <span class="muted">${this._t('firmware_release_local_help')}</span>
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <div class="subpage nested" data-subpage="system" data-sub="master">
              <div class="card system-card">
                <div class="system-group">
                  <div class="system-group-head">
                    <h3 class="system-group-title">${this._t('master_ota_title')}</h3>
                    <span class="status-badge" id="masterOtaInstalled">${this._t('master_version')}: ${this._t('unknown')}</span>
                  </div>
                  <label class="field">
                    <span>${this._t('firmware_release_select')}</span>
                    <span class="inline-field">
                      <select id="masterFirmwareRelease"><option value="">${this._t('firmware_release_none')}</option></select>
                      <button type="button" class="icon-action" data-action="refresh-master-firmware-releases" title="${escapeAttr(this._t('firmware_release_refresh'))}" aria-label="${escapeAttr(this._t('firmware_release_refresh'))}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                          <polyline points="21 3 21 9 15 9"></polyline>
                        </svg>
                      </button>
                    </span>
                    <span class="ota-meta" id="masterFirmwareReleaseInfo">${this._t('firmware_release_loading')}</span>
                  </label>
                  <div class="actions">
                    <button class="btn" data-action="flash-master-firmware-release">${this._t('firmware_release_flash')}</button>
                    <button class="btn cancel" data-action="cancel-master-firmware" disabled>${this._t('cancel')}</button>
                  </div>
                  <div class="ota-progress hidden"><span id="masterOtaBar"></span></div>
                  <div class="muted" id="masterOtaStatus">${this._t('master_ota_state_idle')}</div>
                  <details>
                    <summary>${this._t('master_ota_local_title')}</summary>
                    <div class="advanced-box">
                      <input id="masterOtaFile" type="file" accept=".bin,application/octet-stream">
                      <label class="field">
                        <span>${this._t('master_ota_expected_version')}</span>
                        <input id="masterOtaExpectedVersion" type="text" placeholder="1.2.0.0">
                      </label>
                      <button class="btn secondary" data-action="flash-master-firmware">${this._t('master_ota_flash_local')}</button>
                      <span class="muted">${this._t('master_ota_local_help')}</span>
                    </div>
                  </details>
                  <small class="muted">${this._t('master_ota_recovery_hint')}</small>
                </div>
              </div>
            </div>

            <div class="subpage nested" data-subpage="system" data-sub="connection">
              <div class="card system-card">
                <div class="system-group">
                  <div class="system-group-head">
                    <h3 class="system-group-title">${this._t('system_group_backup')}</h3>
                    <span class="system-group-hint">${this._t('system_hint_backup')}</span>
                  </div>
                  <div class="actions">
                    <button class="btn secondary" data-action="download-backup">${this._t('download_backup_json')}</button>
                    <button class="btn secondary" data-action="restore-backup">${this._t('restore_from_json')}</button>
                    <input id="restoreFile" type="file" accept="application/json,.json" style="display:none">
                  </div>
                  <div class="muted" id="backupStatus"></div>
                </div>

                <div class="system-group">
                  <div class="system-group-head">
                    <h3 class="system-group-title">${this._t('system_group_connection')}</h3>
                  </div>
                  <div class="kv-grid">
                    <div class="kv">
                      <span class="kv-label">${this._t('master')}</span>
                      <span class="kv-value" id="connMaster">${this._t('waiting_state')}</span>
                      <span class="kv-note" id="connMasterNote"></span>
                    </div>
                    <div class="kv">
                      <span class="kv-label">${this._t('mqtt_prefix')}</span>
                      <span class="kv-value" id="connMqtt">—</span>
                      <span class="kv-note" id="connMqttNote"></span>
                    </div>
                    <div class="kv">
                      <span class="kv-label">${this._t('hardware')}</span>
                      <span class="kv-value" id="connHardware">—</span>
                      <span class="kv-note" id="connHardwareNote"></span>
                    </div>
                    <div class="kv">
                      <span class="kv-label">${this._t('engine')}</span>
                      <span class="kv-value" id="connEngine">—</span>
                      <span class="kv-note" id="connEngineNote"></span>
                    </div>
                  </div>
                </div>
              </div>
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

    _displayFieldHint(key) {
      const hintKey = DISPLAY_FIELD_HINTS[key];
      return hintKey ? this._t(hintKey) : "";
    }

    _fieldHtml(field, value, displayGroup = null) {
      const type = field.type || "text";
      const key = escapeAttr(field.key);
      const current = value == null ? "" : String(value);
      const help = this._settingHelp(field.key, field.help || "");
      const visible =
        field.visible_when && field.visible_when.key
          ? ` data-visible-key="${escapeAttr(field.visible_when.key)}" data-visible-value="${escapeAttr(
              JSON.stringify(
                field.visible_when.equals == null ? "" : field.visible_when.equals
              )
            )}"`
          : "";
      const label = escapeHtml(
        this._settingLabel(field.key, field.label || field.key)
      );
      const hint = displayGroup ? this._displayFieldHint(field.key) : "";
      let input = "";

      if (type === "boolean") {
        input = `<input type="checkbox" data-setting="${key}"${
          checkedSettingValue(value) ? " checked" : ""
        }>`;
        if (displayGroup && displayGroup.toggle) {
          return `
          <label class="settings-toggle-row"${visible}${
            help ? ` title="${escapeAttr(help)}"` : ""
          }>
            <span class="settings-toggle-text">
              <span class="settings-toggle-title">${label}</span>
              ${
                hint
                  ? `<span class="settings-toggle-sub">${escapeHtml(hint)}</span>`
                  : ""
              }
            </span>
            <span class="settings-switch">
              ${input}
              <span class="settings-slider"></span>
            </span>
          </label>`;
        }
      } else if (type === "select") {
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

      const labelMarkup = hint
        ? `<span class="settings-label-row"><span>${label}</span><span class="settings-hint">${escapeHtml(
            hint
          )}</span></span>`
        : `<span>${label}</span>`;
      return `
      <label class="field"${visible}>
        ${labelMarkup}
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

    /** Split the backend Display group into the three mock sections. */
    _displayGroups(groups) {
      const fields = groups.flatMap((group) =>
        Array.isArray(group.fields) ? group.fields : []
      );
      const geometry = fields.filter((field) =>
        DISPLAY_GEOMETRY_KEYS.has(field.key)
      );
      const developer = fields.filter((field) =>
        DISPLAY_DEVELOPER_KEYS.has(field.key)
      );
      const preferences = fields.filter(
        (field) =>
          !DISPLAY_GEOMETRY_KEYS.has(field.key) &&
          !DISPLAY_DEVELOPER_KEYS.has(field.key)
      );
      return [
        {
          key: "display_geometry",
          display: true,
          name: this._t("display_group_geometry"),
          hint: this._t("display_group_geometry_hint"),
          columns: 3,
          fields: geometry,
        },
        {
          key: "display_preferences",
          display: true,
          name: this._t("display_group_preferences"),
          columns: 2,
          fields: preferences,
        },
        {
          key: "display_developer",
          display: true,
          name: this._t("display_group_developer"),
          columns: 2,
          toggle: true,
          fields: developer,
        },
      ].filter((group) => group.fields.length > 0);
    }

    _settingsGroupHtml(group, settings, showHeading = true, paneKey = null) {
      const pane =
        paneKey == null ? "" : ` data-app-pane="${escapeAttr(paneKey)}"`;
      const classes = [
        paneKey == null ? "settings-group" : "settings-group app-settings-pane",
        group.toggle ? "settings-group-toggles" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const heading = showHeading
        ? `<div class="settings-group-head">
            <h3>${escapeHtml(group.icon || "")} ${escapeHtml(
                this._settingGroup(group.key, group.name || group.key)
              )}</h3>
            ${
              group.hint
                ? `<span class="settings-group-hint">${escapeHtml(
                    group.hint
                  )}</span>`
                : ""
            }
          </div>`
        : "";
      const gridClass = group.toggle
        ? "settings-toggle-list"
        : group.columns === 3
          ? "settings-grid-3"
          : group.columns === 2
            ? "settings-grid-2"
            : "settings-grid";
      return `
      <div class="${classes}"${pane}>
        ${heading}
        <div class="${gridClass}">
          ${(group.fields || [])
            .map((field) =>
              this._fieldHtml(
                field,
                settings[field.key],
                group.display ? group : null
              )
            )
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
          displayNode.innerHTML = this._displayGroups(displayGroups)
            .map((group) => this._settingsGroupHtml(group, settings))
            .join("");
        }
        if (appsNav) {
          appsNav.innerHTML = appGroups
            .map(
              (group) =>
                `<button class="app-settings-item" data-action="settings-app" data-key="${escapeAttr(
                  group.key
                )}"><span class="app-settings-icon">${this._appIcon(
                  group.key
                )}</span><span>${escapeHtml(
                  this._settingGroup(group.key, group.name || group.key)
                )}</span></button>`
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
          if (input.type === "checkbox") {
            const next = checkedSettingValue(value);
            if (input.checked !== next) input.checked = next;
          } else {
            const next = value == null ? "" : String(value);
            if (input.value !== next) input.value = next;
          }
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
      const split = this.shadowRoot.getElementById("appSettingsSplit");
      const title = this.shadowRoot.getElementById("appSettingsTitle");
      const desc = this.shadowRoot.getElementById("appSettingsDesc");

      if (!buttons.length) {
        if (split) split.classList.add("empty");
        if (title) title.textContent = this._t("app_settings");
        if (desc) {
          desc.textContent = this._t("app_settings_empty");
          desc.classList.remove("hidden");
        }
        return;
      }
      if (split) split.classList.remove("empty");

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

      // Mirror the selected app in the form-pane header so the rail can stay
      // narrow and the fields always say which app they belong to.
      const key = this._appSettingsKey;
      if (title) {
        title.textContent = formatMessage(this._t("app_settings_named"), {
          name: this._settingGroup(key, key),
        });
      }
      if (desc) {
        const app = ((this._engine() && this._engine().apps) || []).find(
          (item) => item.key === key
        );
        const text = app ? this._appDescription(app) : "";
        desc.textContent = text || "";
        desc.classList.toggle("hidden", !text);
      }
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
      const compat = module && module.fw_bus_compat != null ? module.fw_bus_compat : null;
      const compatible = module ? module.fw_bus_compatible : undefined;
      const info = this._compat();
      if (!version) {
        node.textContent = this._t("firmware_installed_unknown");
      } else if (compatible === false) {
        node.textContent = formatMessage(this._t("firmware_incompatible"), {
          version,
          compat,
          expected:
            info.masterBus == null ? this._t("unknown") : info.masterBus,
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

    _firmwareReleaseLabel(release) {
      const channel = String(release.channel || "stable");
      const channelLabel = this._t(`firmware_release_channel_${channel}`);
      const commit = String(release.source_commit || "").slice(0, 7);
      return `${release.version || "—"} · ${channelLabel}${
        commit ? ` · ${commit}` : ""
      }`;
    }

    _selectedFirmwareRelease() {
      const select = this.shadowRoot.getElementById("firmwareRelease");
      const data = this._firmwareReleases;
      const releases = (data && data.releases) || [];
      return releases.find((release) => release.tag === select.value) || null;
    }

    _renderFirmwareReleaseInfo() {
      const node = this.shadowRoot.getElementById("firmwareReleaseInfo");
      if (!node) return;
      const data = this._firmwareReleases;
      if (!data || !Array.isArray(data.releases)) {
        node.textContent = this._t("firmware_release_loading");
        return;
      }
      if (!data.releases.length) {
        node.textContent = this._t("firmware_release_none");
        return;
      }
      const release = this._selectedFirmwareRelease();
      if (!release) {
        node.textContent = this._t("firmware_release_select_hint");
        return;
      }
      const parts = [
        formatMessage(this._t("firmware_release_built"), {
          built: release.built_at || this._t("unknown"),
          commit: String(release.source_commit || "").slice(0, 7) || "—",
        }),
      ];
      if (data.stale) parts.push(this._t("firmware_release_stale"));
      const compat = release.compatibility || {};
      if (compat.level) {
        parts.push(this._t(`firmware_release_compat_${compat.level}`));
      }
      for (const code of compat.codes || []) {
        parts.push(this._t(code));
      }
      node.textContent = parts.join(" — ");
    }

    _renderFirmwareReleases() {
      const select = this.shadowRoot.getElementById("firmwareRelease");
      if (!select) return;
      const data = this._firmwareReleases;
      const releases = (data && data.releases) || [];
      const signature = [
        data && data.stale ? "stale" : "fresh",
        ...releases.map(
          (release) =>
            `${release.tag}:${release.version}:${release.published_at}:${release.compatibility?.level}`
        ),
      ].join("|");
      if (select.dataset.signature !== signature) {
        const previous = select.value;
        select.innerHTML = releases.length
          ? releases
              .map(
                (release) =>
                  `<option value="${escapeAttr(release.tag)}">${escapeHtml(
                    this._firmwareReleaseLabel(release)
                  )}</option>`
              )
              .join("")
          : `<option value="">${escapeHtml(
              this._t("firmware_release_none")
            )}</option>`;
        select.dataset.signature = signature;
        if (releases.some((release) => release.tag === previous)) {
          select.value = previous;
        } else {
          const preferred =
            releases.find((release) => release.channel === "stable") ||
            releases[0];
          if (preferred) select.value = preferred.tag;
        }
      }
      this._renderFirmwareReleaseInfo();
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
      const bulk = this._bulkOta ? this._bulkOta.view() : { running: false };
      const masterBusy =
        typeof this._masterSlotBusy === "function" && this._masterSlotBusy();
      const busy = active || this._otaBusy || bulk.running || masterBusy;
      const cancelBtn = this.shadowRoot.querySelector(
        '[data-action="cancel-firmware"]'
      );
      // Keep cancel clickable for any non-idle state (including failed /
      // cancelled) so a stuck session can always be aborted, not just while
      // an active phase is reported. A bulk job routes the same button to
      // its own cancel so the whole queue stops, not only one module.
      if (cancelBtn) cancelBtn.disabled = !(busy || state !== "idle");
      const flashReleaseBtn = this.shadowRoot.querySelector(
        '[data-action="flash-release-firmware"]'
      );
      const flashLocalBtn = this.shadowRoot.querySelector(
        '[data-action="flash-firmware"]'
      );
      const flashAllBtn = this.shadowRoot.querySelector(
        '[data-action="flash-release-firmware-all"]'
      );
      if (flashReleaseBtn) flashReleaseBtn.disabled = busy;
      if (flashLocalBtn) flashLocalBtn.disabled = busy;
      if (flashAllBtn) flashAllBtn.disabled = busy;

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

      const bulkStatus = this.shadowRoot.getElementById("otaBulkStatus");
      if (bulkStatus) {
        if (!bulk.state || bulk.state === "idle") {
          bulkStatus.textContent = "";
        } else if (bulk.state === "running") {
          const module = bulk.module != null
            ? formatMessage(this._t("ota_module"), { module: bulk.module })
            : this._t("unknown");
          bulkStatus.textContent = formatMessage(
            this._t("firmware_release_bulk_progress"),
            {
              done: bulk.done,
              total: bulk.total,
              module: bulk.version ? `${module} · ${bulk.version}` : module,
            }
          );
        } else if (bulk.state === "done") {
          bulkStatus.textContent = formatMessage(
            this._t("firmware_release_bulk_done"),
            { count: bulk.done }
          );
        } else if (bulk.state === "failed") {
          bulkStatus.textContent = formatMessage(
            this._t("firmware_release_bulk_failed"),
            { error: this._t(bulk.error || "firmware_release_bulk_error") }
          );
        } else if (bulk.state === "cancelled") {
          bulkStatus.textContent = this._t("firmware_release_bulk_cancelled");
        }
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

    _renderMasterOtaInstalled() {
      const node = this.shadowRoot.getElementById("masterOtaInstalled");
      if (!node) return;
      const coordinator = this._coordinator() || {};
      const version = coordinator.master_version;
      if (!version) {
        node.textContent = this._t("master_ota_installed_unknown");
        return;
      }
      const compat = this._compat().masterMqtt;
      node.textContent = formatMessage(this._t("master_ota_installed"), {
        version,
        compat: compat == null ? this._t("unknown") : compat,
      });
    }

    _selectedMasterFirmwareRelease() {
      const select = this.shadowRoot.getElementById("masterFirmwareRelease");
      if (!select) return null;
      const releases = (this._masterFirmwareReleases || {}).releases || [];
      return releases.find((release) => release.tag === select.value) || null;
    }

    _renderMasterFirmwareReleaseInfo() {
      const node = this.shadowRoot.getElementById("masterFirmwareReleaseInfo");
      if (!node) return;
      const data = this._masterFirmwareReleases;
      if (!data || !Array.isArray(data.releases)) {
        node.textContent = this._t("firmware_release_loading");
        return;
      }
      if (!data.releases.length) {
        node.textContent = this._t("firmware_release_none");
        return;
      }
      const release = this._selectedMasterFirmwareRelease();
      if (!release) {
        node.textContent = this._t("master_ota_select_release");
        return;
      }
      const parts = [
        formatMessage(this._t("master_release_summary"), {
          version: release.version || "—",
          mqtt: release.mqtt_compat == null ? this._t("unknown") : release.mqtt_compat,
          bus: release.bus_compat == null ? this._t("unknown") : release.bus_compat,
        }),
      ];
      if (release.notes) {
        parts.push(
          formatMessage(this._t("master_release_notes"), { notes: release.notes })
        );
      }
      if (data.stale) parts.push(this._t("firmware_release_stale"));
      const compat = release.compatibility || {};
      if (compat.level) {
        parts.push(this._t(`firmware_release_compat_${compat.level}`));
      }
      for (const code of compat.codes || []) {
        parts.push(this._t(code));
      }
      node.textContent = parts.join(" — ");
    }

    _renderMasterFirmwareReleases() {
      const select = this.shadowRoot.getElementById("masterFirmwareRelease");
      if (!select) return;
      const data = this._masterFirmwareReleases;
      const releases = (data && data.releases) || [];
      const signature = [
        data && data.stale ? "stale" : "fresh",
        ...releases.map(
          (release) =>
            `${release.tag}:${release.version}:${release.published_at}:${release.compatibility?.level}`
        ),
      ].join("|");
      if (select.dataset.signature !== signature) {
        const previous = select.value;
        select.innerHTML = releases.length
          ? releases
              .map(
                (release) =>
                  `<option value="${escapeAttr(release.tag)}">${escapeHtml(
                    formatMessage(this._t("master_release_option"), {
                      version: release.version || "—",
                      channel: this._t(
                        `firmware_release_channel_${release.channel || "stable"}`
                      ),
                    })
                  )}</option>`
              )
              .join("")
          : `<option value="">${escapeHtml(
              this._t("firmware_release_none")
            )}</option>`;
        select.dataset.signature = signature;
        if (releases.some((release) => release.tag === previous)) {
          select.value = previous;
        } else {
          const preferred =
            releases.find((release) => release.channel === "stable") ||
            releases[0];
          if (preferred) select.value = preferred.tag;
        }
      }
      this._renderMasterFirmwareReleaseInfo();
    }

    _renderMasterOta() {
      const flow = this._masterOta ? this._masterOta.view() : null;
      this._renderMasterOtaInstalled();
      if (!flow) return;

      const state = flow.state;
      const phase = flow.phase || "idle";
      const active = ["collecting", "applying", "rebooting"].includes(phase);
      const busy = state === "running" || active;

      const cancelBtn = this.shadowRoot.querySelector(
        '[data-action="cancel-master-firmware"]'
      );
      if (cancelBtn) cancelBtn.disabled = phase !== "collecting";
      for (const action of [
        "flash-master-firmware-release",
        "flash-master-firmware",
      ]) {
        const button = this.shadowRoot.querySelector(`[data-action="${action}"]`);
        if (button) button.disabled = busy;
      }

      const bar = this.shadowRoot.getElementById("masterOtaBar");
      if (bar) {
        const track = bar.parentElement;
        if (track) track.classList.toggle("hidden", !busy);
        bar.style.width = busy && flow.progress != null ? `${flow.progress}%` : "0%";
      }

      const status = this.shadowRoot.getElementById("masterOtaStatus");
      if (!status) return;
      let text = this._t(`master_ota_state_${phase}`);
      if (state === "running" && phase === "uploading") {
        text = this._t("master_ota_uploading");
      } else if (state === "running" && flow.remainingSeconds != null) {
        text = `${text} — ${formatMessage(this._t("master_ota_remaining"), {
          seconds: flow.remainingSeconds,
        })}`;
      }
      if (flow.error) {
        text += ` — ${
          flow.error.startsWith("master_ota_") || flow.error.startsWith("master_")
            ? this._t(flow.error)
            : flow.error
        }`;
      }
      status.textContent = text;
    }

    _renderConnectionInfo() {
      const node = this.shadowRoot.getElementById("connMaster");
      if (!node || !this._state) return;
      const coordinator = this._coordinator();
      const engine = this._engine();
      const board = this._board();
      const info = this._compat();
      const unknown = this._t("unknown");
      const set = (id, value) => {
        const target = this.shadowRoot.getElementById(id);
        if (target) target.textContent = value;
      };

      set(
        "connMaster",
        this._t(coordinator.online ? "master_online" : "master_offline")
      );
      set(
        "connMasterNote",
        `${this._t("master_version")}: ${
          coordinator.master_version || unknown
        } · ${this._t("bus_compatibility")}: ${
          info.masterBus == null ? unknown : info.masterBus
        }`
      );
      set("connMqtt", coordinator.prefix || unknown);
      set(
        "connMqttNote",
        `${this._t("mqtt_compatibility")}: ${
          info.masterMqtt == null ? unknown : info.masterMqtt
        } (${this._t("integration")}: ${
          info.local == null ? unknown : info.local
        }) · ${this._t("last_status")}: ${
          coordinator.last_status || this._t("never")
        }`
      );
      set("connHardware", `${board.rows} × ${board.cols}`);
      set(
        "connHardwareNote",
        `${this._t("modules_label")}: ${coordinator.modules_count || 0} · ${this._t(
          "detected"
        )}: ${(coordinator.modules || []).length}`
      );
      set(
        "connEngine",
        `${this._modeLabel(engine.mode)}${
          engine.active_app ? ` · ${this._appName(engine.active_app)}` : ""
        }`
      );
      set(
        "connEngineNote",
        `${this._t("integration")}: v${this._state.version || VERSION}`
      );
    }
  };
