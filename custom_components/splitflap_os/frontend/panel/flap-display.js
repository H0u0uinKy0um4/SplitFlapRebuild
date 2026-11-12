/** Stateful 3D split-flap preview rendering. */

import { COLOR_CODES } from "../constants.js?v=1.2.8";
import { escapeHtml } from "../utils.js?v=1.2.8";

/**
 * Owns the per-board flap memory used to decide which flaps should animate.
 *
 * Keeping the previous character map here (instead of on the panel class)
 * means the animation state survives view-only re-renders and is reset in one
 * place when the shell is rebuilt.
 */
export class FlapDisplay {
  constructor() {
    this._lastChars = [];
  }

  reset() {
    this._lastChars = [];
  }

  flapHtml(char, flip) {
    const value = char == null ? " " : String(char).slice(0, 1);
    const blank = value === " " || value === "";
    const color = COLOR_CODES.includes(value) ? ` color-${value}` : "";
    return `<span class="flap${blank ? " blank" : ""}${color}${flip ? " flip" : ""}">${
      blank ? "" : escapeHtml(value)
    }</span>`;
  }

  scale(settings) {
    const raw = Number(settings && settings.ui_scale);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.max(0.5, Math.min(2, raw / 100));
  }

  previewCell(settings, cols = 15) {
    // A one-module board should read like a real single flap, not a tiny dot;
    // short rows get a middle size, and full boards keep the compact grid.
    const count = Math.max(1, Number(cols) || 15);
    const base = count <= 1 ? 92 : count <= 6 ? 68 : 48;
    return Math.round(base * this.scale(settings));
  }

  miniCell(settings) {
    return Math.round(24 * this.scale(settings));
  }

  moduleCell(settings) {
    return Math.round(56 * this.scale(settings));
  }

  gridMaxWidth(cols, maxCell, gap) {
    const count = Math.max(1, Number(cols) || 1);
    return Math.round(count * maxCell + Math.max(0, count - 1) * gap);
  }

  fitPreview(node) {
    if (!node) return;
    // The dark bezel spans the full card; the grid inside stays centred and
    // scrolls horizontally only when the board is wider than the viewport.
    node.style.maxWidth = "";
    node.style.marginLeft = "";
    node.style.marginRight = "";
    node.style.width = "100%";
  }

  previewHtml(board, lines, { animate = false, maxCell = 48, gap = null } = {}) {
    const cellGap =
      gap != null
        ? gap
        : maxCell >= 80
          ? 8
          : maxCell >= 60
            ? 7
            : maxCell >= 40
              ? 5
              : 3;
    const chars = [];
    let html = "";
    let slotBase = 0;
    for (let row = 0; row < board.rows; row += 1) {
      const count = Math.max(
        0,
        Math.min(board.cols, Number(board.rowCounts[row]) || 0)
      );
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
        html += this.flapHtml(
          char,
          animate &&
            this._lastChars[index] !== undefined &&
            this._lastChars[index] !== char
        );
        chars[index] = char;
      }
      slotBase += count;
    }
    if (animate) this._lastChars = chars;
    const width = this.gridMaxWidth(board.cols, maxCell, cellGap);
    const fontSize = Math.max(8, Math.round(maxCell * 0.6));
    // Keep glyphs inside their tiles when the grid is squeezed on a phone.
    const fontCap = `calc((100vw - 96px) / ${Math.max(
      1,
      board.cols
    )} * 0.6)`;
    const fontValue = `min(${fontSize}px, ${fontCap})`;
    return `<div class="grid" style="--cols:${board.cols};--flap-max:${maxCell}px;--flap-font:${fontValue};--flap-gap:${cellGap}px;max-width:${width}px;margin:0 auto">${html}</div>`;
  }
}

export const PanelMixin = (Base) =>
  class extends Base {
    _flapDisplay() {
      if (!this.__flapDisplay) this.__flapDisplay = new FlapDisplay();
      return this.__flapDisplay;
    }

    _resetFlapDisplay() {
      this._flapDisplay().reset();
    }

    _flapHtml(char, flip) {
      return this._flapDisplay().flapHtml(char, flip);
    }

    _uiScale() {
      const engine = this._engine();
      const settings = (engine && engine.settings) || {};
      return this._flapDisplay().scale(settings);
    }

    _previewCell() {
      const engine = this._engine();
      const settings = (engine && engine.settings) || {};
      const board = this._board() || {};
      return this._flapDisplay().previewCell(settings, board.cols);
    }

    _miniCell() {
      const engine = this._engine();
      const settings = (engine && engine.settings) || {};
      return this._flapDisplay().miniCell(settings);
    }

    _moduleCell() {
      const engine = this._engine();
      const settings = (engine && engine.settings) || {};
      return this._flapDisplay().moduleCell(settings);
    }

    _gridMaxWidth(cols, maxCell, gap) {
      return this._flapDisplay().gridMaxWidth(cols, maxCell, gap);
    }

    _fitPreview(node, contentWidth) {
      this._flapDisplay().fitPreview(node, contentWidth);
    }

    _previewHtml(lines, animate, maxCell = null) {
      return this._flapDisplay().previewHtml(this._board(), lines, {
        animate,
        maxCell: maxCell == null ? this._previewCell() : maxCell,
      });
    }
  };
