/** Panel component logic. */

import { COLOR_CODES, DEFAULT_DRUM, DOMAIN, STYLES } from "../constants.js?v=1.2.22";
import { PANEL_I18N, SETTINGS_I18N } from "../i18n/index.js?v=1.2.22";
import { escapeAttr, escapeHtml, formatMessage } from "../utils.js?v=1.2.22";
import {
  normalizeBoard,
  normalizeLayoutError,
  normalizeSnapshot,
} from "../snapshot-adapter.js?v=1.2.22";
import { createCalibrationFlow } from "./calibration-flow.js?v=1.2.22";
import { createBulkOtaFlow } from "./bulk-ota-flow.js?v=1.2.22";


export const PanelMixin = (Base) => class extends Base {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this._state = null;
    this._unsub = null;
    this._connecting = false;
    this._connected = false;
    this._retryTimer = null;

    this._tab = "control";
    this._subtabs = { tuning: "commands", settings: "display" };
    this._appSettingsKey = null;
    this._composeText = "";
    this._playDelay = 5;
    this._builder = [];
    this._playlistTouched = false;
    this._selectedModule = null;
    this._inspectorModule = null;
    this._otaBusy = false;
    this._otaSize = 0;
    this._firmwareReleases = null;
    this._releasesLoaded = false;
    this._releasesLoading = false;
    this._settingsBuilt = false;
    this._settingsDirty = false;
    this._charSignature = "";
    this._modalApp = null;
    this._shellRendered = false;
    this._theme = "light";
    this._themePending = null;

    // Every calibration flow behind one interface. The panel only supplies
    // adapters: snapshot, send, clock, notifications and rendering.
    this._calibration = createCalibrationFlow({
      snapshot: () => this._state,
      selectedModule: () => this._moduleFor(this._selectedModule),
      send: (type, payload) => this._send(type, payload),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      notify: (key, params, level) =>
        this._toast(formatMessage(this._t(key), params || {}), level),
      plural: (key, count) => this._plural(key, count),
      render: () => {
        this._renderAutoTune();
        this._renderTeach();
        this._renderTuneModal();
        this._renderMapFlaps(this._moduleFor(this._selectedModule));
      },
      colors: COLOR_CODES,
      stockDrum: DEFAULT_DRUM,
    });

    // Bulk boot/flash keeps the same adapter shape: the panel only supplies
    // adapters and renders the progress model it gets back.
    this._bulkOta = createBulkOtaFlow({
      snapshot: () => this._state,
      send: (type, payload) => this._send(type, payload),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      notify: (key, params, level) =>
        this._toast(formatMessage(this._t(key), params || {}), level),
      render: () => this._renderOta(),
    });

    try {
      const saved = window.localStorage.getItem(`${DOMAIN}_tab`);
      if (saved) this._tab = saved;
      const savedTheme = window.localStorage.getItem(`${DOMAIN}_theme`);
      if (savedTheme === "light" || savedTheme === "dark") {
        this._theme = savedTheme;
      }
      // Only accept known sub-tabs so a stale stored value can never leave
      // a page with no visible subpage.
      const known = {
        tuning: ["commands", "map", "autotune", "teach", "drum"],
        settings: ["display", "apps", "drum", "system"],
      };
      for (const [group, subs] of Object.entries(known)) {
        const savedSub = window.localStorage.getItem(
          `${DOMAIN}_subtab_${group}`
        );
        if (savedSub && subs.includes(savedSub)) this._subtabs[group] = savedSub;
      }
      const savedAppSettings = window.localStorage.getItem(
        `${DOMAIN}_app_settings`
      );
      if (savedAppSettings) this._appSettingsKey = savedAppSettings;
    } catch (err) {
      /* local storage may be unavailable in private windows. */
    }

    // Do NOT set attributes here: a custom element constructor must not add
    // attributes to itself, otherwise document.createElement() throws
    // `NotSupportedError: The result must not have attributes`. `_renderShell`
    // applies the cached theme (via `_applyTheme`) once the element exists.
  }

  set hass(hass) {
    const previousLanguage = this._lang();
    this._hass = hass;
    const newLanguage = this._lang();
    if (!this._shellRendered) {
      this._renderShell();
      this._shellRendered = true;
    } else if (previousLanguage !== newLanguage) {
      this._renderShell();
      this._shellRendered = true;
      if (this._state) this._renderAll();
    }
    // Home Assistant re-sends `hass` when the user's theme (or its Auto
    // light/dark resolution) changes. Re-apply only when the effective theme
    // actually changed so explicit Light/Dark settings stay pinned.
    if (this._themeValue() !== this._theme) this._applyTheme();
    if (this.isConnected) this._connect();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (!this._shellRendered) {
      this._renderShell();
      this._shellRendered = true;
    }
    if (this._hass) this._connect();
  }

  disconnectedCallback() {
    this._disconnect();
  }

  async _connect() {
    if (this._connecting || this._unsub || !this._hass || !this._hass.connection) {
      return;
    }
    this._connecting = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        (event) => this._setState(event),
        { type: `${DOMAIN}/subscribe` }
      );
      this._connected = true;
      this._renderStatus();
    } catch (err) {
      this._connected = false;
      this._unsub = null;
      this._toast(
        formatMessage(this._t("connect_failed"), {
          error: err.message || err,
        }),
        "error"
      );
      this._scheduleReconnect();
    } finally {
      this._connecting = false;
    }
  }

  _scheduleReconnect() {
    if (this._retryTimer) return;
    this._retryTimer = window.setTimeout(() => {
      this._retryTimer = null;
      this._connect();
    }, 5000);
  }

  _disconnect() {
    if (this._retryTimer) {
      window.clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._unsub) {
      try {
        this._unsub();
      } catch (err) {
        /* already closed */
      }
      this._unsub = null;
    }
    this._connected = false;
  }

  _setState(state) {
    if (!state || !state.engine || !state.coordinator) return;
    // One adapter resolves aliases, geometry and layout errors before any
    // view reads the snapshot.
    this._state = normalizeSnapshot(state, { stockDrum: DEFAULT_DRUM });
    this._connected = true;
    this._renderAll();
  }

  async _send(type, payload = {}) {
    if (!this._hass || !this._hass.connection) {
      throw new Error(this._t("not_connected"));
    }
    try {
      return await this._hass.connection.sendMessagePromise({
        type: `${DOMAIN}/${type}`,
        ...payload,
      });
    } catch (err) {
      const message =
        (err && (err.message || err.error || err.code)) || String(err);
      this._toast(this._layoutErrorText(message), "error");
      throw err;
    }
  }

  async _loadState() {
    try {
      const state = await this._send("get_state");
      this._setState(state);
    } catch (err) {
      /* _send already reported it */
    }
  }


  _engine() {
    return this._state ? this._state.engine : null;
  }

  _coordinator() {
    return this._state ? this._state.coordinator : null;
  }

  _compat() {
    return (this._state && this._state.compatInfo) || {
      local: null,
      masterMqtt: null,
      masterBus: null,
      ok: null,
      missing: true,
    };
  }

  _moduleFor(moduleId) {
    const coordinator = this._coordinator();
    const modules = (coordinator && coordinator.modules) || [];
    return modules.find((module) => String(module.id) === String(moduleId));
  }

  _lang() {
    const lang =
      (this._hass && (this._hass.language || (this._hass.locale && this._hass.locale.language))) ||
      "en";
    return String(lang).toLowerCase().startsWith("cs") ? "cs" : "en";
  }

  _t(key) {
    const dict = PANEL_I18N[this._lang()] || PANEL_I18N.en;
    return dict[key] || PANEL_I18N.en[key] || key;
  }

  _pluralCategory(count) {
    const value = Math.abs(Number(count) || 0);
    if (this._lang() !== "cs") return value === 1 ? "one" : "many";
    if (value === 1) return "one";
    if (Number.isInteger(value) && value >= 2 && value <= 4) return "few";
    return "many";
  }

  _plural(key, count, params = {}) {
    const category = this._pluralCategory(count);
    const template = this._t(`${key}_${category}`);
    return formatMessage(template, { count, ...params });
  }

  _modeLabel(mode) {
    if (!mode) return this._t("mode_idle");
    const key = `mode_${mode}`;
    const dict = PANEL_I18N[this._lang()] || PANEL_I18N.en;
    return dict[key] || PANEL_I18N.en[key] || String(mode);
  }

  _layoutErrorText(error) {
    const info = normalizeLayoutError(error);
    if (!info) return "";
    const params = { ...(info.params || {}) };
    switch (info.code) {
      case "layout_err_row_mismatch":
        params.count = this._plural("rows", params.count);
        params.frame = this._plural("rows", params.frame);
        break;
      case "layout_err_columns":
        params.needed = this._plural("columns", params.needed);
        params.frame = this._plural("columns", params.frame);
        break;
      case "layout_err_describes":
        params.layout = this._plural("modules", params.layout);
        params.detected = this._plural("modules", params.detected);
        break;
      case "layout_err_blank":
        params.blank = this._plural("blank_cells", params.blank);
        break;
      case "layout_err_capacity":
        params.frame = `${params.rows}×${params.cols}`;
        params.capacity = this._plural("modules", params.capacity);
        params.detected = this._plural("modules", params.detected);
        break;
      case "raw":
        return params.text;
      default:
        break;
    }
    return formatMessage(this._t(info.code), params);
  }

  _styleOptions() {
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    const labels = (dict.options && dict.options.anim_style) || {};
    return STYLES.map(
      (style) =>
        `<option value="${escapeAttr(style)}">${escapeHtml(
          labels[style] || style
        )}</option>`
    ).join("");
  }

  // App settings are namespaced as "<app>.<local key>".  Translation tables
  // stay keyed by the local name, so look up the full key first and then the
  // part after the dot.
  _settingKey(key) {
    const value = String(key || "");
    const dot = value.indexOf(".");
    return dot >= 0 ? value.slice(dot + 1) : value;
  }

  _appForSetting(key) {
    const value = String(key || "");
    const dot = value.indexOf(".");
    if (dot < 0) return null;
    const appKey = value.slice(0, dot);
    const apps = (this._engine() && this._engine().apps) || [];
    return apps.find((item) => item.key === appKey) || null;
  }

  _appFieldTranslation(key) {
    const app = this._appForSetting(key);
    if (!app || !app.translations) return null;
    const lang = this._lang();
    const table = app.translations[lang] || app.translations.en || null;
    if (!table || !table.fields) return null;
    const local = this._settingKey(key);
    return table.fields[local] || null;
  }

  _appTranslation(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    if (!app || !app.translations) return null;
    const lang = this._lang();
    return app.translations[lang] || app.translations.en || null;
  }

  _optionLabel(fieldKey, option) {
    const app = this._appForSetting(fieldKey);
    if (app) {
      const ft = this._appFieldTranslation(fieldKey);
      if (ft && ft.options && ft.options[option]) return ft.options[option];
      return String(option);
    }
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    const table = (dict.options && dict.options[fieldKey]) ||
      (dict.options && dict.options[this._settingKey(fieldKey)]);
    return (table && table[option]) || String(option);
  }

  _settingLabel(key, fallback) {
    const app = this._appForSetting(key);
    if (app) {
      const ft = this._appFieldTranslation(key);
      if (ft && ft.label) return ft.label;
      const field = (app.fields || []).find(
        (item) => item.key === this._settingKey(key)
      );
      return (field && field.label) || fallback || key;
    }
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    const labels = dict.labels || {};
    return labels[key] || labels[this._settingKey(key)] || fallback || key;
  }

  _settingHelp(key, fallback) {
    const app = this._appForSetting(key);
    if (app) {
      const ft = this._appFieldTranslation(key);
      if (ft && ft.help) return ft.help;
      const field = (app.fields || []).find(
        (item) => item.key === this._settingKey(key)
      );
      return (field && field.help) || fallback || "";
    }
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    const helps = dict.helps || {};
    return helps[key] || helps[this._settingKey(key)] || fallback || "";
  }

  _settingGroup(key, fallback) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    if (app) {
      const tr = this._appTranslation(key);
      if (tr && tr.name) return tr.name;
      return app.name || fallback || key;
    }
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    return (dict.groups && dict.groups[key]) || fallback || key;
  }

  _settingPlaceholder(key, fallback) {
    const app = this._appForSetting(key);
    if (app) {
      const ft = this._appFieldTranslation(key);
      if (ft && ft.placeholder) return ft.placeholder;
      const field = (app.fields || []).find(
        (item) => item.key === this._settingKey(key)
      );
      return (field && field.placeholder) || fallback || "";
    }
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    const placeholders = dict.placeholders || {};
    return (
      placeholders[key] ||
      placeholders[this._settingKey(key)] ||
      fallback ||
      ""
    );
  }

  _board() {
    if (this._state && this._state.board) return this._state.board;
    const engine = this._engine();
    return normalizeBoard((engine && engine.board) || {}, []);
  }

  _lines() {
    const engine = this._engine();
    return engine && engine.display && Array.isArray(engine.display.lines)
      ? engine.display.lines
      : [];
  }

};
