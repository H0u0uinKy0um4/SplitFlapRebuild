/** Apps tab: live preview and app launcher grid. */

import { APP_ICONS } from "../../constants.js?v=1.2.7";
import { escapeAttr, escapeHtml, formatMessage } from "../../utils.js?v=1.2.7";

export const PanelMixin = (Base) =>
  class extends Base {
    _appsPage() {
      return `
        <section class="page" data-page="apps">
          <section class="section-wrap">
            <div class="section-header">
              <h2 class="section-title">${this._t('live_display')}</h2>
              <span class="meta-badge" id="liveAppsMeta"></span>
            </div>
            <div class="preview wide" id="liveApps"></div>
          </section>
          <section class="section-wrap">
            <div class="section-header">
              <h2 class="section-title">${this._t('available_apps')}</h2>
            </div>
            <div class="card">
              <div class="apps-grid" id="appsGrid"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._t('apps_help')}
              </p>
            </div>
          </section>
        </section>`;
    }

    _appManifestTranslation(key) {
      return this._appTranslation(key);
    }

    _appName(key) {
      const apps = (this._engine() && this._engine().apps) || [];
      const app = apps.find((item) => item.key === key);
      const fallback = app ? app.name : key || this._t("app_idle");
      const manifestTranslation = this._appManifestTranslation(key);
      if (manifestTranslation && manifestTranslation.name)
        return manifestTranslation.name;
      return fallback;
    }

    _appModeLabel(appKey, mode) {
      const manifestTranslation = this._appManifestTranslation(appKey);
      const manifestModes =
        manifestTranslation && manifestTranslation.modes
          ? manifestTranslation.modes
          : null;
      if (manifestModes && manifestModes[mode]) return manifestModes[mode];
      return String(mode || "").toUpperCase();
    }

    _appDescription(app) {
      if (!app) return "";
      const manifestTranslation = this._appManifestTranslation(app.key);
      if (manifestTranslation && manifestTranslation.description)
        return manifestTranslation.description;
      return app.description || "";
    }

    _appIcon(key, app = null) {
      if (APP_ICONS[key]) return APP_ICONS[key];
      const target =
        app ||
        ((this._engine() && this._engine().apps) || []).find(
          (item) => item.key === key
        );
      if (target && target.icon) {
        const icon = String(target.icon).trim();
        if (icon.startsWith("<svg")) {
          return icon;
        }
        if (icon.startsWith("mdi:")) {
          return `<ha-icon icon="${escapeAttr(icon)}"></ha-icon>`;
        }
        return `<span class="app-icon-emoji">${escapeHtml(icon)}</span>`;
      }
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/></svg>`;
    }

    _appRequirement(app, board) {
      if (!app || app.available !== false) return "";
      const needRows = Math.max(1, Number(app.min_rows) || 1);
      const needCols = Math.max(1, Number(app.min_cols) || 1);
      const rows = Number(board && board.rows) || 0;
      const minCols = Number(board && (board.minCols ?? board.min_cols)) || 0;
      const layoutError =
        board && board.error ? this._layoutErrorText(board.error) : "";
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
            <button class="gear" data-action="app-mode" data-app="${escapeAttr(app.key)}" title="${escapeAttr(this._t('app_mode'))}">▦</button>
            <div class="app-card-body">
              <div class="app-icon">${this._appIcon(app.key, app)}</div>
              <div class="app-name">${escapeHtml(this._appName(app.key))}</div>
              <div class="app-desc">${escapeHtml(description)}</div>
              ${available ? "" : `<div class="app-req">${escapeHtml(requirement)}</div>`}
            </div>
          </div>`;
        })
        .join("");
    }
  };
