/** Panel component logic. */

import { APP_ICONS, COLOR_MAP, DEFAULT_DRUM, PALETTE, VERSION } from "../constants.js?v=0.1.6";
import { APPS_I18N } from "../i18n/index.js?v=0.1.6";
import { escapeAttr, escapeHtml, numberText, centerLine, formatMessage } from "../utils.js?v=0.1.6";
import { PANEL_STYLES } from "../styles.js?v=0.1.6";


export const PanelMixin = (Base) => class extends Base {
  _renderShell() {
    this._settingsBuilt = false;
    this._inspectorModule = null;
    this._charSignature = "";
    this.shadowRoot.innerHTML = `
      <style>${PANEL_STYLES}</style>
      <div class="app">
        <header>
          <div class="brand">
            <div class="mark">▦</div>
            <div>
              <h1>SPLIT-FLAP OS <span style="font-size:.58rem;opacity:.45;font-weight:600;vertical-align:middle">v${VERSION}</span></h1>
              <div class="sub" id="subtitle">${this._t('connecting_subtitle')}</div>
            </div>
          </div>
          <div class="conn">
            <span class="pill connecting" id="statusPill">${this._t('connecting')}</span>
            <button class="icon-btn" data-action="refresh" title="${escapeAttr(this._t('refresh_state'))}">⟳</button>
          </div>
        </header>

        <div class="banner hidden" id="banner">
          <span class="dot"></span>
          <span id="bannerText"></span>
          <button class="btn mini danger stop" data-action="stop">${this._t("stop")}</button>
        </div>

        <nav class="tabs">
          <button class="tab active" data-action="tab" data-tab="control">${this._t("tab_control")}</button>
          <button class="tab" data-action="tab" data-tab="apps">${this._t("tab_apps")}</button>
          <button class="tab" data-action="tab" data-tab="tuning">${this._t("tab_tuning")}</button>
          <button class="tab" data-action="tab" data-tab="settings">${this._t("tab_settings")}</button>
        </nav>

        <main>
          <section class="page active" data-page="control">
            <div class="card">
              <h2>${this._t('live_display')}</h2>
              <div class="preview wide" id="live"></div>
              <div class="muted" id="liveMeta" style="margin-top:8px"></div>
            </div>

            <div class="card">
              <h2>${this._t('compose')}</h2>
              <textarea id="compose" class="compose-input" rows="3"
                placeholder="${escapeAttr(this._t('compose_placeholder'))}"></textarea>
              <div class="palette">
                ${PALETTE.map(
                  ([emoji, code]) =>
                    `<button class="palette-${code}" data-action="insert-color" data-char="${emoji}" title="${escapeAttr(this._t('color_' + code))}" aria-label="${escapeAttr(this._t('color_' + code))}"></button>`
                ).join("")}
              </div>
              <div class="options">
                <label class="field"><span>${this._t('start_column')}</span>
                  <input id="startCol" type="number" min="1" max="512" value="1">
                </label>
                <label class="field"><span>${this._t('send_order')}</span>
                  <select id="styleSelect">${this._styleOptions()}</select>
                </label>
                <label class="field"><span>${this._t('speed')}</span>
                  <input id="speedInput" type="number" min="0" max="500" step="5" value="15">
                </label>
              </div>
              <div class="preview" id="composePreview"></div>
              <div class="muted" id="composeMeta" style="margin-top:8px"></div>
              <div class="actions">
                <button class="btn" data-action="push-text">${this._t('push_to_display')}</button>
                <button class="btn secondary" data-action="add-playlist">${this._t('add_to_playlist')}</button>
                <button class="btn secondary" data-action="clear-text">${this._t("clear")}</button>
              </div>
            </div>

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('playlist_builder')}</h2>
                <label class="field" style="max-width:120px"><span>${this._t('delay_seconds')}</span>
                  <input id="builderDelay" type="number" min="0.1" max="120" step="0.5" value="5">
                </label>
              </div>
              <div class="list" id="builderList"></div>
              <div class="actions">
                <button class="btn" data-action="play-builder">${this._t('play_playlist')}</button>
                <input id="saveName" type="text" placeholder="${escapeAttr(this._t('playlist_name'))}" style="max-width:190px">
                <button class="btn secondary" data-action="save-builder">${this._t("save")}</button>
              </div>
            </div>

            <div class="card">
              <h2>${this._t('saved_playlists')}</h2>
              <div class="list" id="savedList"></div>
            </div>
          </section>

          <section class="page" data-page="apps">
            <div class="card">
              <h2>${this._t('live_display')}</h2>
              <div class="preview wide" id="liveApps"></div>
              <div class="muted" id="liveAppsMeta" style="margin-top:8px"></div>
            </div>
            <div class="card">
              <h2>${this._t('available_apps')}</h2>
              <div class="apps-grid" id="appsGrid"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._t('apps_help')}
              </p>
            </div>
          </section>

          <section class="page" data-page="tuning">
            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('hardware')}</h2>
                <div class="actions" style="margin:0">
                  <button class="btn mini secondary" data-action="hardware" data-sub="scan">${this._t("scan_bus")}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="sync">${this._t("sync")}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="update">${this._t('refresh')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="home_all">${this._t("home_all")}</button>
                </div>
              </div>
              <div class="mod-matrix" id="moduleMatrix" style="margin-top:12px"></div>
              <div class="muted" id="matrixMeta" style="margin-top:8px"></div>
            </div>

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
            </div>

            <div class="card inspector hidden" id="inspector">
              <div class="row between">
                <h2 style="margin:0" id="inspectTitle">${this._t('module')}</h2>
                <span class="muted" id="inspectState"></span>
              </div>
              <div class="stats">
                <div class="stat"><b id="statFlap">–</b><span>${this._t('flap')}</span></div>
                <div class="stat"><b id="statActual">–</b><span>${this._t('reported')}</span></div>
                <div class="stat"><b id="statStep">–</b><span>${this._t('step')}</span></div>
                <div class="stat"><b id="statIndex">–</b><span>${this._t('index')}</span></div>
                <div class="stat"><b id="statOffset">–</b><span>${this._t('offset')}</span></div>
                <div class="stat"><b id="statTotal">–</b><span>${this._t('total_steps')}</span></div>
              </div>
              <div class="grid2">
                <label class="field"><span>${this._t('goto_drum_index')}</span>
                  <input id="gotoIndex" type="number" min="0" max="63" placeholder="0-63">
                </label>
                <div class="row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="goto_index">${this._t('goto_index')}</button>
                  <button class="btn secondary" data-action="module" data-sub="get_pos">${this._t('get_position')}</button>
                </div>
                <label class="field"><span>${this._t('step_steps')}</span>
                  <input id="stepAmount" type="number" step="1" value="32">
                </label>
                <div class="step-row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="-32">-32</button>
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="-1">-1</button>
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="1">+1</button>
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="32">+32</button>
                  <button class="btn secondary" data-action="module" data-sub="step">${this._t('step')}</button>
                </div>
                <label class="field"><span>${this._t('record_at_index')}</span>
                  <input id="recordIndex" type="number" min="0" max="63" placeholder="0-63">
                </label>
                <div class="row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="record">${this._t('record')}</button>
                  <button class="btn danger" data-action="module" data-sub="home">${this._t('home_motor')}</button>
                  <button class="btn secondary" data-action="module" data-sub="clear_map">${this._t('clear_map')}</button>
                </div>
                <label class="field"><span>${this._t('home_offset')}</span>
                  <input id="offsetValue" type="number" min="0" max="65535" placeholder="${escapeAttr(this._t('steps'))}">
                </label>
                <div class="row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="apply_offset">${this._t('set_offset')}</button>
                </div>
              </div>
              <label class="field" style="margin-top:12px"><span>${this._t('position_map')}</span>
                <textarea id="posMap" rows="3" placeholder="0:2832&#10;1:2896"></textarea>
              </label>
              <div class="actions">
                <button class="btn secondary" data-action="module" data-sub="apply_map">${this._t('apply_map_to_eeprom')}</button>
                <span class="muted">${this._t('position_map_hint')}</span>
              </div>
            </div>

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('character_map')}</h2>
                <span class="muted" id="charMapTitle"></span>
              </div>
              <div class="char-map" id="charMap" style="margin-top:12px"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._t('char_map_help')}
              </p>
            </div>
          </section>

          <section class="page" data-page="settings">
            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('hardware_actions')}</h2>
                <div class="actions" style="margin:0">
                  <button class="btn mini secondary" data-action="hardware" data-sub="scan">${this._t('scan')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="sync">${this._t('sync')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="update">${this._t('refresh')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="home_all">${this._t("home_all")}</button>
                </div>
              </div>
            </div>

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

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('settings')}</h2>
                <button class="btn" data-action="save-settings">${this._t("save_settings")}</button>
              </div>
              <div id="settingsGroups" style="margin-top:14px"></div>
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
          </section>
        </main>

        <div class="toasts" id="toasts"></div>

        <div class="modal hidden" id="modal">
          <div class="modal-card">
            <h3 id="modalTitle">${escapeHtml(this._t('app_settings_title'))}</h3>
            <div id="modalFields"></div>
            <div class="actions">
              <button class="btn" data-action="save-app-settings">${this._t("save")}</button>
              <button class="btn secondary" data-action="close-modal">${this._t('cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (!this._eventsBound) {
      this._eventsBound = true;
      this.shadowRoot.addEventListener("click", (event) => {
        this._onClick(event).catch((err) => console.error(err));
      });
      this.shadowRoot.addEventListener("input", (event) => this._onInput(event));
      this.shadowRoot.addEventListener("change", (event) =>
        this._onChange(event)
      );
    }

    this._applyTab();
  }

  _applyTab() {
    this.shadowRoot.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === this._tab);
    });
    this.shadowRoot.querySelectorAll("[data-page]").forEach((page) => {
      page.classList.toggle("active", page.dataset.page === this._tab);
    });
  }

  _setTab(tab) {
    this._tab = tab;
    try {
      window.localStorage.setItem(`${DOMAIN}_tab`, tab);
    } catch (err) {
      /* ignore */
    }
    this._applyTab();
    if (tab === "control") this._renderComposePreview();
  }


  _renderAll() {
    if (!this._state) return;
    this._renderStatus();
    this._renderLive();
    this._renderComposePreview();
    this._renderBuilder();
    this._renderSaved();
    this._renderApps();
    this._renderBanner();
    this._renderTuning();
    this._renderLayout();
    this._renderSettings();
    this._renderConnectionInfo();
  }

  _renderStatus() {
    const pill = this.shadowRoot.getElementById("statusPill");
    const subtitle = this.shadowRoot.getElementById("subtitle");
    if (!this._state) {
      pill.textContent = this._t('connecting');
      pill.className = "pill connecting";
      subtitle.textContent = this._t('connecting_subtitle');
      return;
    }

    const coordinator = this._coordinator();
    const engine = this._engine();
    const board = this._board();
    const online = Boolean(coordinator.online);
    pill.textContent = this._t(online ? "online" : "offline");
    pill.className = `pill ${online ? "online" : "offline"}`;

    const prefix = coordinator.prefix || "—";
    const mode = engine.active_app
      ? this._appName(engine.active_app)
      : this._modeLabel(engine.mode);
    const parts = [
      prefix,
      `${board.rows}×${board.cols}`,
      this._plural("modules", board.modules),
      mode,
    ];
    if (board.error) parts.push(this._t("layout_error_short"));
    subtitle.textContent = parts.join(" • ");
  }

  _flapHtml(char, flip) {
    const value = char == null ? " " : String(char).slice(0, 1);
    const blank = value === " " || value === "";
    const color = "roygbpw".includes(value) ? ` color-${value}` : "";
    return `<span class="flap${blank ? " blank" : ""}${color}${flip ? " flip" : ""}">${
      blank ? "" : escapeHtml(value)
    }</span>`;
  }

  _uiScale() {
    const engine = this._engine();
    const settings = (engine && engine.settings) || {};
    const raw = Number(settings.ui_scale);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.max(0.5, Math.min(2, raw / 100));
  }

  _previewCell() {
    return Math.round(48 * this._uiScale());
  }

  _moduleCell() {
    return Math.round(56 * this._uiScale());
  }

  _gridMaxWidth(cols, maxCell, gap) {
    const count = Math.max(1, Number(cols) || 1);
    return Math.round(count * maxCell + Math.max(0, count - 1) * gap);
  }

  _fitPreview(node, contentWidth) {
    if (!node) return;
    node.style.maxWidth = `${Math.min(Math.round(contentWidth) + 22, 940)}px`;
    node.style.marginLeft = "auto";
    node.style.marginRight = "auto";
  }

  _previewHtml(lines, animate) {
    const board = this._board();
    const chars = [];
    let html = "";
    let slotBase = 0;
    for (let row = 0; row < board.rows; row += 1) {
      const count = Math.max(0, Math.min(board.cols, Number(board.rowCounts[row]) || 0));
      const offset = Math.max(0, Number(board.rowOffsets[row]) || 0);
      const line = String(lines[row] || "")
        .padEnd(board.cols, " ")
        .slice(0, board.cols);
      for (let col = 0; col < board.cols; col += 1) {
        if (col < offset || col >= offset + count) {
          html += '<span class="flap void"></span>';
          continue;
        }
        const char = line[col] || " ";
        const index = slotBase + (col - offset);
        html += this._flapHtml(
          char,
          animate && this._lastChars[index] !== undefined && this._lastChars[index] !== char
        );
        chars[index] = char;
      }
      slotBase += count;
    }
    if (animate) this._lastChars = chars;
    const maxCell = this._previewCell();
    const width = this._gridMaxWidth(board.cols, maxCell, 3);
    const fontSize = Math.max(8, Math.round(maxCell * 0.55));
    return `<div class="grid" style="--cols:${board.cols};--flap-max:${maxCell}px;--flap-font:${fontSize}px;max-width:${width}px;margin:0 auto">${html}</div>`;
  }

  _renderLive() {
    const board = this._board();
    const engine = this._engine();
    const html = this._previewHtml(this._lines(), true);
    const width = this._gridMaxWidth(board.cols, this._previewCell(), 3);
    const parts = [
      engine.active_app
        ? this._appName(engine.active_app)
        : this._modeLabel(engine.mode),
    ];
    if (engine.current_page_count) {
      parts.push(
        formatMessage(this._t("page_of"), {
          page: Number(engine.current_page_index || 0) + 1,
          total: engine.current_page_count,
        })
      );
    }
    parts.push(
      `${this._plural("rows", board.rows)} × ${this._plural(
        "columns",
        board.cols
      )}`
    );
    if (board.error) parts.push(this._t("layout_error_short"));
    const meta = parts.join(" • ");

    for (const id of ["live", "liveApps"]) {
      const node = this.shadowRoot.getElementById(id);
      if (node) {
        node.innerHTML = html;
        this._fitPreview(node, width);
      }
    }
    for (const id of ["liveMeta", "liveAppsMeta"]) {
      const node = this.shadowRoot.getElementById(id);
      if (node) node.textContent = meta;
    }
  }

  _composeLines(text, rows, cols, start) {
    let value = String(text == null ? "" : text).toUpperCase();
    value = value.replace(/"/g, "q");
    for (const [emoji, code] of Object.entries(COLOR_MAP)) {
      value = value.split(emoji).join(code);
    }
    // `start` is 1-based, matching the service and the backend engine.
    const offset = Math.max(0, Math.floor(Number(start) || 0) - 1);
    if (offset > 0) value = " ".repeat(offset) + value;

    const wrapped = [];
    for (const paragraph of value.split("\n")) {
      if (paragraph.length <= cols) {
        wrapped.push(paragraph);
        continue;
      }
      if (paragraph.includes("  ")) {
        for (let i = 0; i < paragraph.length; i += cols) {
          wrapped.push(paragraph.slice(i, i + cols));
        }
        continue;
      }

      let line = "";
      for (const rawWord of paragraph.split(/\s+/)) {
        if (!rawWord) continue;
        let word = rawWord;
        if (line && line.length + 1 + word.length <= cols) {
          line += ` ${word}`;
          continue;
        }
        if (line) {
          wrapped.push(line);
          line = "";
        }
        while (word.length > cols) {
          wrapped.push(word.slice(0, cols));
          word = word.slice(cols);
        }
        line = word;
      }
      if (line || paragraph === "") wrapped.push(line);
    }

    const body = wrapped.slice(0, rows);
    const top = Math.floor((rows - body.length) / 2);
    const out = Array(top).fill("");
    out.push(...body);
    while (out.length < rows) out.push("");
    return out.slice(0, rows).map((line) => centerLine(line, cols));
  }

  _renderComposePreview() {
    if (!this._state) return;
    const board = this._board();
    const textarea = this.shadowRoot.getElementById("compose");
    if (textarea && textarea.value !== this._composeText) {
      this._composeText = textarea.value;
    }
    const startNode = this.shadowRoot.getElementById("startCol");
    const start = Math.max(1, Number(startNode ? startNode.value : 1) || 1);
    const lines = this._composeLines(this._composeText, board.rows, board.cols, start);
    const preview = this.shadowRoot.getElementById("composePreview");
    if (preview) {
      preview.innerHTML = this._previewHtml(lines, false);
      this._fitPreview(preview, this._gridMaxWidth(board.cols, this._previewCell(), 3));
    }
    const meta = this.shadowRoot.getElementById("composeMeta");
    if (meta) {
      meta.textContent = `${this._plural(
        "characters",
        this._composeText.length
      )} • ${this._t("start_column").toLocaleLowerCase(
        this._lang()
      )} ${start}`;
    }
  }

  _renderBuilder() {
    const node = this.shadowRoot.getElementById("builderList");
    if (!node) return;
    if (!this._builder.length) {
      node.innerHTML = `<div class="empty">${escapeHtml(
        this._t("builder_empty")
      )}</div>`;
      return;
    }
    node.innerHTML = this._builder
      .map(
        (page, index) => `
          <div class="list-item">
            <span class="idx">${index + 1}</span>
            <span class="text">${escapeHtml(
              String(page.text || "").replace(/\n/g, " / ") || this._t('blank')
            )}</span>
            <button class="icon-btn" data-action="remove-builder" data-index="${index}" title="${escapeAttr(this._t('remove'))}">✕</button>
          </div>`
      )
      .join("");
  }

  _renderSaved() {
    const node = this.shadowRoot.getElementById("savedList");
    if (!node) return;
    const playlists = this._engine().saved_playlists || {};
    const names = Object.keys(playlists);
    if (!names.length) {
      node.innerHTML = `<div class="empty">${escapeHtml(
        this._t("saved_empty")
      )}</div>`;
      return;
    }
    node.innerHTML = names
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const saved = playlists[name] || {};
        const count = Array.isArray(saved.pages) ? saved.pages.length : 0;
        return `
          <div class="list-item">
            <span class="idx">▶</span>
            <span class="text">${escapeHtml(name)}</span>
            <span class="muted">${escapeHtml(
              this._plural("pages", count)
            )}</span>
            <button class="btn mini" data-action="run-saved" data-name="${escapeAttr(name)}">${this._t('run')}</button>
            <button class="btn mini danger" data-action="delete-saved" data-name="${escapeAttr(name)}">${this._t('delete')}</button>
          </div>`;
      })
      .join("");
  }

  _appI18n(key) {
    const dict = APPS_I18N[this._lang()] || APPS_I18N.en;
    return (dict && dict[key]) || null;
  }

  _appName(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    const fallback = app ? app.name : key || this._t("app_idle");
    const t = this._appI18n(key);
    return (t && t.name) || fallback;
  }

  _appDescription(app) {
    if (!app) return "";
    const t = this._appI18n(app.key);
    return (t && t.description) || app.description || "";
  }

  _appIcon(key) {
    return APP_ICONS[key] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/></svg>`;
  }

  _appRequirement(app, board) {
    if (!app || app.available !== false) return "";
    const needRows = Math.max(1, Number(app.min_rows) || 1);
    const needCols = Math.max(1, Number(app.min_cols) || 1);
    const rows = Number(board && board.rows) || 0;
    const minCols = Number(board && (board.minCols ?? board.min_cols)) || 0;
    const layoutError = board && board.error
      ? this._layoutErrorText(board.error)
      : "";
    if (layoutError && (needRows > 1 || needCols > 1)) {
      return formatMessage(this._t("fix_layout_first"), { error: layoutError });
    }
    if (rows < needRows) {
      return formatMessage(this._t("app_needs_rows"), {
        needed: this._plural("rows", needRows),
        actual: this._plural("rows", rows),
      });
    }
    if (minCols < needCols) {
      return formatMessage(this._t("app_needs_cols"), {
        needed: this._plural("columns", needCols),
        actual: this._plural("columns", minCols),
      });
    }
    return app.unavailable_reason || "";
  }

  _renderApps() {
    const node = this.shadowRoot.getElementById("appsGrid");
    if (!node) return;
    const engine = this._engine();
    const board = this._board();
    const apps = engine.apps || [];
    if (!apps.length) {
      node.innerHTML = `<div class="empty">${escapeHtml(
        this._t("no_apps")
      )}</div>`;
      return;
    }
    node.innerHTML = apps
      .map((app) => {
        const available = app.available !== false;
        const running = engine.active_app === app.key;
        const requirement = this._appRequirement(app, board);
        const description = this._appDescription(app);
        return `
          <div class="app-card${running ? " running" : ""}${available ? "" : " disabled"}"
               ${available ? `data-action="start-app" data-app="${escapeAttr(app.key)}" role="button" tabindex="0"` : 'aria-disabled="true"'}
               title="${escapeAttr(requirement || description)}">
            ${running ? `<span class="app-live">${escapeHtml(this._t("live_badge"))}</span>` : ""}
            <button class="gear" data-action="app-settings" data-app="${escapeAttr(app.key)}" title="${escapeAttr(this._t('app_settings'))}">⚙</button>
            <div class="app-icon">${this._appIcon(app.key)}</div>
            <div class="app-name">${escapeHtml(this._appName(app.key))}</div>
            <div class="app-desc">${escapeHtml(description)}</div>
            ${available ? "" : `<div class="app-req">${escapeHtml(requirement)}</div>`}
          </div>`;
      })
      .join("");
  }

  _renderBanner() {
    const banner = this.shadowRoot.getElementById("banner");
    const text = this.shadowRoot.getElementById("bannerText");
    if (!banner || !text) return;
    const engine = this._engine();
    if (!engine || engine.mode === "idle") {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");
    if (engine.active_app) {
      text.textContent = formatMessage(this._t("app_running"), {
        name: this._appName(engine.active_app),
      });
    } else if (engine.mode === "playlist") {
      const total = engine.current_page_count || (engine.playlist || []).length || 0;
      const current = total ? Number(engine.current_page_index || 0) + 1 : 0;
      text.textContent = total
        ? formatMessage(this._t("playlist_running_progress"), {
            current,
            total,
          })
        : this._t("playlist_running");
    } else {
      text.textContent = this._modeLabel(engine.mode);
    }
  }

  _moduleFor(moduleId) {
    const coordinator = this._coordinator();
    const modules = (coordinator && coordinator.modules) || [];
    return modules.find((module) => String(module.id) === String(moduleId));
  }

  _renderTuning() {
    if (!this._state) return;
    const coordinator = this._coordinator();
    const board = this._board();
    const modules = coordinator.modules || [];
    const matrix = this.shadowRoot.getElementById("moduleMatrix");
    const meta = this.shadowRoot.getElementById("matrixMeta");

    if (matrix) {
      const rows = Math.max(board.rows, Math.ceil(modules.length / board.cols) || 1);
      let html = "";
      let slotBase = 0;
      for (let row = 0; row < rows; row += 1) {
        const inLayout = row < board.rows;
        const count = inLayout
          ? Math.max(0, Math.min(board.cols, Number(board.rowCounts[row]) || 0))
          : board.cols;
        const offset = inLayout
          ? Math.max(0, Number(board.rowOffsets[row]) || 0)
          : 0;
        for (let col = 0; col < board.cols; col += 1) {
          if (col < offset || col >= offset + count) {
            html += '<div class="mod void"></div>';
            continue;
          }
          const module = modules[slotBase + col - offset];
          if (!module) {
            html += '<div class="mod empty"></div>';
            continue;
          }
          const selected =
            this._selectedModule !== null &&
            String(this._selectedModule) === String(module.id);
          const flap =
            module.displayed_flap != null ? module.displayed_flap : module.flap || " ";
          const offline = module.online === false;
          html += `
            <button class="mod${selected ? " selected" : ""}${offline ? " offline" : ""}"
                    data-action="select-module" data-id="${escapeAttr(module.id)}"
                    title="${escapeAttr(this._t('module'))} ${escapeAttr(module.id)} • ${escapeAttr(
                      module.state || this._t("unknown")
                    )}">
              <span class="mid">${escapeHtml(module.id)}</span>
              <span class="mchar">${flap === " " ? "␣" : escapeHtml(flap)}</span>
            </button>`;
        }
        slotBase += count;
      }
      matrix.style.setProperty("--cols", String(board.cols));
      if (modules.length) {
        const maxCell = this._moduleCell();
        const width = this._gridMaxWidth(board.cols, maxCell, 4);
        matrix.style.setProperty("--mod-max", `${maxCell}px`);
        matrix.style.setProperty(
          "--mod-char",
          `${Math.max(10, Math.round(maxCell * 0.26))}px`
        );
        matrix.style.setProperty(
          "--mod-id",
          `${Math.max(8, Math.round(maxCell * 0.13))}px`
        );
        matrix.style.maxWidth = `${width}px`;
        matrix.style.marginLeft = "auto";
        matrix.style.marginRight = "auto";
      } else {
        matrix.style.maxWidth = "";
        matrix.style.marginLeft = "";
        matrix.style.marginRight = "";
      }
      matrix.innerHTML =
        html ||
        `<div class="empty">${escapeHtml(this._t("no_modules"))}</div>`;
    }

    if (meta) {
      meta.textContent = `${this._plural("modules", modules.length)} • ${
        coordinator.prefix || "—"
      } • ${this._t(coordinator.online ? "master_online" : "master_offline")}`;
    }

    // Load default drum into the editor textarea.
    const drumTextarea = this.shadowRoot.getElementById("defaultDrum");
    if (drumTextarea && !this._settingsDirty) {
      const engine = this._engine();
      const settings = (engine && engine.settings) || {};
      const drum = settings.default_drum || "";
      if (drumTextarea.value !== drum) drumTextarea.value = drum;
    }
    this._updateDrumCharCount();

    const selected = this._moduleFor(this._selectedModule);
    if (!selected) {
      this._selectedModule = null;
      this._inspectorModule = null;
      const inspector = this.shadowRoot.getElementById("inspector");
      if (inspector) inspector.classList.add("hidden");
      this._renderCharMap(null);
      return;
    }

    const inspector = this.shadowRoot.getElementById("inspector");
    if (inspector) inspector.classList.remove("hidden");

    const title = this.shadowRoot.getElementById("inspectTitle");
    if (title) {
      title.textContent = formatMessage(this._t("module_named"), {
        id: selected.id,
      });
    }
    const state = this.shadowRoot.getElementById("inspectState");
    if (state) {
      state.textContent = `${String(
        selected.state || this._t("unknown")
      ).toUpperCase()} • ${this._t(
        selected.online === false ? "offline" : "online"
      )}`;
    }

    const values = {
      statFlap: selected.displayed_flap != null ? selected.displayed_flap : selected.flap,
      statActual: selected.actual_flap != null ? selected.actual_flap : selected.flap,
      statStep: selected.current_step,
      statIndex: selected.display_flap_index != null ? selected.display_flap_index : selected.flap_index,
      statOffset: selected.home_offset,
      statTotal: selected.total_steps,
    };
    for (const [id, value] of Object.entries(values)) {
      const node = this.shadowRoot.getElementById(id);
      if (node) node.textContent = value === " " ? "␣" : numberText(value);
    }

    if (this._inspectorModule !== String(selected.id)) {
      this._inspectorModule = String(selected.id);
      const index =
        selected.display_flap_index != null
          ? selected.display_flap_index
          : selected.flap_index;
      const set = (id, value) => {
        const node = this.shadowRoot.getElementById(id);
        if (node) node.value = value == null ? "" : String(value);
      };
      set("gotoIndex", index);
      set("recordIndex", index);
      set("offsetValue", selected.home_offset);
      const positions = selected.map_of_positions || {};
      const text = Object.keys(positions)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => `${key}:${positions[key]}`)
        .join("\n");
      set("posMap", text);
    }

    this._renderCharMap(selected);
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
      const count = Math.max(0, Math.min(board.cols, Number(board.rowCounts[row]) || 0));
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
    this._fitPreview(node, width);

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

  _renderCharMap(module) {
    const node = this.shadowRoot.getElementById("charMap");
    const title = this.shadowRoot.getElementById("charMapTitle");
    if (!node) return;
    if (!module) {
      if (title) title.textContent = this._t('select_module');
      node.innerHTML = `<div class="empty">${escapeHtml(
        this._t("select_module_hint")
      )}</div>`;
      this._charSignature = "";
      return;
    }

    const drum =
      Array.isArray(module.flap_list) && module.flap_list.length
        ? module.flap_list
        : DEFAULT_DRUM.split("");
    const positions = module.map_of_positions || {};
    const currentIndex =
      module.display_flap_index != null
        ? Number(module.display_flap_index)
        : module.flap_index != null
          ? Number(module.flap_index)
          : -1;
    const signature = [
      String(module.id),
      drum.join(""),
      String(currentIndex),
      Object.keys(positions)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => `${key}:${positions[key]}`)
        .join(","),
    ].join("|");
    if (signature === this._charSignature) return;
    this._charSignature = signature;

    if (title) {
      title.textContent = formatMessage(this._t("char_map_title"), {
        id: module.id,
        flaps: this._plural("flaps", drum.length),
      });
    }
    node.innerHTML = drum
      .map((char, index) => {
        const color = "roygbpw".includes(char) ? ` color-${char}` : "";
        const tuned = positions[String(index)] !== undefined;
        return `<button class="char${color}${tuned ? " tuned" : ""}${
          index === currentIndex ? " current" : ""
        }" data-action="module" data-sub="goto_flap" data-flap="${escapeAttr(
          char
        )}" title="${escapeAttr(
          formatMessage(this._t("index_named"), { index })
        )}${tuned ? ` • ${positions[String(index)]}` : ""}">
          ${char === " " ? "␣" : escapeHtml(char)}<small>${index}</small>
        </button>`;
      })
      .join("");
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
    return `
      <label class="field">
        <span>${escapeHtml(this._settingLabel(field.key, field.label || field.key))}</span>
        ${input}
        ${help ? `<small>${escapeHtml(help)}</small>` : ""}
      </label>`;
  }

  _renderSettings() {
    const node = this.shadowRoot.getElementById("settingsGroups");
    if (!node) return;
    const engine = this._engine();
    const groups = engine.settings_groups || [];
    const settings = engine.settings || {};

    if (!this._settingsBuilt) {
      node.innerHTML = groups
        .map(
          (group) => `
            <div class="settings-group">
              <h3>${escapeHtml(group.icon || "")} ${escapeHtml(this._settingGroup(group.key, group.name || group.key))}</h3>
              <div class="settings-grid">
                ${(group.fields || [])
                  .map((field) => this._fieldHtml(field, settings[field.key]))
                  .join("")}
              </div>
            </div>`
        )
        .join("");
      this._settingsBuilt = true;
    }

    if (this._settingsDirty) return;
    const active = this.shadowRoot.activeElement;
    node.querySelectorAll("[data-setting]").forEach((input) => {
      if (input === active) return;
      const key = input.dataset.setting;
      const value = settings[key];
      const next = value == null ? "" : String(value);
      if (input.value !== next) input.value = next;
    });
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
      `${this._t("last_status")}: ${coordinator.last_status || this._t("never")}`,
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
