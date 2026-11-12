/** Control tab: live display, composer and preview. */

import { COLOR_MAP, PALETTE } from "../../constants.js?v=1.2.7";
import {
  centerLine,
  escapeAttr,
  escapeHtml,
  formatMessage,
} from "../../utils.js?v=1.2.7";

export const PanelMixin = (Base) =>
  class extends Base {
    _controlPage() {
      return `
        <section class="page active" data-page="control">
          <section class="section-wrap">
            <div class="section-header">
              <h2 class="section-title">${this._t('live_display')}</h2>
              <span class="meta-badge" id="liveMeta"></span>
            </div>
            <div class="preview" id="live"></div>
          </section>

          <section class="section-wrap">
            <div class="section-header">
              <h2 class="section-title">${this._t('compose')}</h2>
              <span class="meta-badge" id="composeMeta"></span>
            </div>
            <div class="compose-deck hardware-bezel">
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
              <div class="mini-preview-wrap">
                <span class="mini-label">${this._t('char_map_preview')}</span>
                <div class="mini-bezel" id="composePreview"></div>
              </div>
              <div class="actions">
                <button class="btn" data-action="push-text">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  ${this._t('push_to_display')}
                </button>
                <button class="btn secondary" data-action="add-playlist">${this._t('add_to_playlist')}</button>
                <button class="btn secondary" data-action="clear-text">${this._t("clear")}</button>
              </div>
            </div>
          </section>
        </section>`;
    }

    _renderLive() {
      const board = this._board();
      const engine = this._engine();
      const html = this._previewHtml(this._lines(), true);
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
          this._fitPreview(node);
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
      const lines = this._composeLines(
        this._composeText,
        board.rows,
        board.cols,
        start
      );
      const preview = this.shadowRoot.getElementById("composePreview");
      if (preview) {
        preview.innerHTML = this._previewHtml(lines, false, this._miniCell());
      }
      const meta = this.shadowRoot.getElementById("composeMeta");
      if (meta) {
        const total = Math.max(0, board.rows * board.cols);
        meta.textContent = `${this._plural(
          "characters",
          this._composeText.length
        )} / ${total} • ${this._t("start_column").toLocaleLowerCase(
          this._lang()
        )} ${start}`;
      }
    }
  };
