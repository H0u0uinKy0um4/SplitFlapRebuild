/** Control tab: live display, composer and preview. */

import { COLOR_MAP, PALETTE } from "../../constants.js?v=1.2.6";
import {
  centerLine,
  escapeAttr,
  escapeHtml,
  formatMessage,
} from "../../utils.js?v=1.2.6";

export const PanelMixin = (Base) =>
  class extends Base {
    _controlPage() {
      return `
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
        </section>`;
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
      const lines = this._composeLines(
        this._composeText,
        board.rows,
        board.cols,
        start
      );
      const preview = this.shadowRoot.getElementById("composePreview");
      if (preview) {
        preview.innerHTML = this._previewHtml(lines, false);
        this._fitPreview(
          preview,
          this._gridMaxWidth(board.cols, this._previewCell(), 3)
        );
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
  };
