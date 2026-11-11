/** Panel component logic. */

import { DOMAIN, STYLES } from "../constants.js?v=1.0.8";
import { PANEL_I18N, SETTINGS_I18N } from "../i18n/index.js?v=1.0.8";
import { escapeAttr, escapeHtml, formatMessage } from "../utils.js?v=1.0.8";


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
    this._settingsBuilt = false;
    this._settingsDirty = false;
    this._charSignature = "";
    this._lastChars = [];
    this._modalApp = null;
    this._shellRendered = false;

    try {
      const saved = window.localStorage.getItem(`${DOMAIN}_tab`);
      if (saved) this._tab = saved;
      // Only accept known sub-tabs so a stale stored value can never leave
      // a page with no visible subpage.
      const known = {
        tuning: ["commands", "map", "drum"],
        settings: ["display", "apps", "layout", "drum", "system"],
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
    this._state = state;
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
    let text = String(error || "");
    if (!text) return "";
    text = text.replace(
      /Row layout must contain whole numbers, not ([^\n]+)/g,
      (_match, value) =>
        formatMessage(this._t("layout_err_whole_numbers"), { value })
    );
    text = text.replace(
      /Row layout counts must be greater than zero/g,
      () => this._t("layout_err_positive")
    );
    text = text.replace(
      /Row layout has (\d+) row\(s\) but the frame is (\d+) row\(s\)/g,
      (_match, count, frame) =>
        formatMessage(this._t("layout_err_row_mismatch"), {
          count: this._plural("rows", Number(count)),
          frame: this._plural("rows", Number(frame)),
        })
    );
    text = text.replace(
      /Row layout needs at least (\d+) columns but the frame has (\d+)/g,
      (_match, needed, frame) =>
        formatMessage(this._t("layout_err_columns"), {
          needed: this._plural("columns", Number(needed)),
          frame: this._plural("columns", Number(frame)),
        })
    );
    text = text.replace(
      /Row layout describes (\d+) module\(s\) but (\d+) were detected/g,
      (_match, layout, detected) =>
        formatMessage(this._t("layout_err_describes"), {
          layout: this._plural("modules", Number(layout)),
          detected: this._plural("modules", Number(detected)),
        })
    );
    text = text.replace(
      /Row layout does not fit inside the frame/g,
      () => this._t("layout_err_no_fit")
    );
    text = text.replace(
      /Layout leaves (\d+) blank cell\(s\); at most one row \((\d+)\) is allowed(?:\. Set a row layout such as 3,3,1\.)?/g,
      (_match, blank, row) =>
        formatMessage(this._t("layout_err_blank"), {
          blank: this._plural("blank_cells", Number(blank)),
          row: Number(row),
        })
    );
    text = text.replace(
      /The (\d+)×(\d+) frame only fits (\d+) of (\d+) detected module\(s\)/g,
      (_match, rows, cols, capacity, detected) =>
        formatMessage(this._t("layout_err_capacity"), {
          frame: `${rows}×${cols}`,
          capacity: this._plural("modules", Number(capacity)),
          detected: this._plural("modules", Number(detected)),
        })
    );
    return text;
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

  _optionLabel(fieldKey, option) {
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    const group = dict.options && dict.options[fieldKey];
    return (group && group[option]) || String(option);
  }

  _settingLabel(key, fallback) {
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    return (dict.labels && dict.labels[key]) || fallback || key;
  }

  _settingHelp(key, fallback) {
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    return (dict.helps && dict.helps[key]) || fallback || "";
  }

  _settingGroup(key, fallback) {
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    return (dict.groups && dict.groups[key]) || fallback || key;
  }

  _settingPlaceholder(key, fallback) {
    const dict = SETTINGS_I18N[this._lang()] || SETTINGS_I18N.en;
    return (dict.placeholders && dict.placeholders[key]) || fallback || "";
  }

  _board() {
    const engine = this._engine();
    const board = (engine && engine.board) || {};
    const cols = Math.max(1, Number(board.cols) || 15);
    const rows = Math.max(1, Number(board.rows) || 1);
    let rowCounts = Array.isArray(board.row_counts) ? board.row_counts.map((n) => Number(n) || 0) : [];
    if (rowCounts.length !== rows) rowCounts = Array(rows).fill(cols);
    let rowOffsets = Array.isArray(board.row_offsets)
      ? board.row_offsets.map((n) => Math.max(0, Number(n) || 0))
      : [];
    if (rowOffsets.length !== rows) {
      rowOffsets = rowCounts.map((count) => Math.max(0, Math.floor((cols - count) / 2)));
    }
    return {
      rows,
      cols,
      modules: Number(board.module_count) || 0,
      rowCounts,
      rowOffsets,
      minCols: Number(board.min_cols) || 0,
      layoutModuleCount: Number(board.layout_module_count) || 0,
      error: board.error || "",
    };
  }

  _lines() {
    const engine = this._engine();
    const board = this._board();
    const lines =
      engine && engine.display && Array.isArray(engine.display.lines)
        ? engine.display.lines
        : [];
    const out = [];
    for (let row = 0; row < board.rows; row += 1) {
      out.push(String(lines[row] || "").padEnd(board.cols, " ").slice(0, board.cols));
    }
    return out;
  }

  _toast(message, type = "ok") {
    const host = this.shadowRoot.getElementById("toasts");
    if (!host) return;
    const node = document.createElement("div");
    node.className = `toast${type === "ok" ? "" : ` ${type}`}`;
    node.textContent = String(message);
    host.appendChild(node);
    window.setTimeout(() => {
      node.classList.add("out");
      window.setTimeout(() => node.remove(), 300);
    }, 3600);
  }

};
