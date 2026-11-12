/** Playlists tab: builder and saved playlists. */

import { escapeAttr, escapeHtml } from "../../utils.js?v=1.2.8";

export const PanelMixin = (Base) =>
  class extends Base {
    _playlistsPage() {
      return `
        <section class="page" data-page="playlists">
          <div class="card">
            <div class="row between">
              <h2 style="margin:0">${this._t('playlist_builder')}</h2>
              <label class="field" style="max-width:120px"><span>${this._t('delay_seconds')}</span>
                <input id="builderDelay" type="number" min="0.1" max="120" step="0.5" value="${this._playDelay || 5}">
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
        </section>`;
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
  };
