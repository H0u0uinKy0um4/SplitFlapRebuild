/** Shared panel chrome: header, tabs, modal shells, banners and toasts. */

import { DOMAIN, VERSION } from "../constants.js?v=1.2.6";
import { escapeAttr, escapeHtml, formatMessage } from "../utils.js?v=1.2.6";
import { PANEL_STYLES } from "../styles.js?v=1.2.6";

export const PanelMixin = (Base) =>
  class extends Base {
    _renderShell() {
      this._settingsBuilt = false;
      this._inspectorModule = null;
      this._charSignature = "";
      this._resetFlapDisplay();
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

        <div class="banner warn hidden" id="compatBanner">
          <span class="dot"></span>
          <span id="compatBannerText"></span>
        </div>

        <nav class="tabs">
          <button class="tab active" data-action="tab" data-tab="control">${this._t("tab_control")}</button>
          <button class="tab" data-action="tab" data-tab="playlists">${this._t("tab_playlists")}</button>
          <button class="tab" data-action="tab" data-tab="apps">${this._t("tab_apps")}</button>
          <button class="tab" data-action="tab" data-tab="tuning">${this._t("tab_tuning")}</button>
          <button class="tab" data-action="tab" data-tab="settings">${this._t("tab_settings")}</button>
        </nav>

        <main>
          ${this._controlPage()}
          ${this._playlistsPage()}
          ${this._appsPage()}
          ${this._tuningPage()}
          ${this._settingsPage()}
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

        <div class="modal hidden" id="tuneModal">
          <div class="modal-card">
            <h3 id="tuneModalTitle"></h3>
            <div id="tuneModalBody"></div>
            <div class="actions">
              <button class="btn secondary" data-action="close-tune-modal">${this._t('cancel')}</button>
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
      this._applySubtabs();
    }

    _applySubtabs() {
      this.shadowRoot
        .querySelectorAll('[data-action="subtab"]')
        .forEach((button) => {
          const group = button.dataset.group;
          button.classList.toggle(
            "active",
            this._subtabs[group] === button.dataset.sub
          );
        });
      this.shadowRoot.querySelectorAll("[data-subpage]").forEach((node) => {
        const group = node.dataset.subpage;
        node.classList.toggle(
          "active",
          this._subtabs[group] === node.dataset.sub
        );
      });
    }

    _setSubtab(group, sub) {
      if (!this._subtabs || !(group in this._subtabs)) return;
      this._subtabs[group] = sub;
      try {
        window.localStorage.setItem(`${DOMAIN}_subtab_${group}`, sub);
      } catch (err) {
        /* ignore */
      }
      this._applySubtabs();
      // Opening Tuning -> Drum must show the current library, even if no
      // module has been selected yet (the selector is otherwise only rebuilt
      // by _renderTuning).
      if (group === "tuning" && sub === "drum") this._renderModuleDrumSelect();
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
      this._renderDrumLibrary();
      // Populate the module drum selector from the library on every state
      // update, even when no module is selected yet. _renderTuning() returns
      // early without a selection, so relying on it alone left the selector
      // stale until the module was re-selected.
      this._renderModuleDrumSelect();
      this._renderApps();
      this._renderBanner();
      this._renderCompat();
      this._renderTuning();
      this._renderLayout();
      this._renderSettings();
      this._renderOta();
      this._renderConnectionInfo();
      this._renderAutoTune();
      this._renderTeach();
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
        const total =
          engine.current_page_count || (engine.playlist || []).length || 0;
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

    _renderCompat() {
      const banner = this.shadowRoot.getElementById("compatBanner");
      const text = this.shadowRoot.getElementById("compatBannerText");
      if (!banner || !text) return;
      const coordinator = this._coordinator();
      if (!coordinator || !coordinator.online) {
        banner.classList.add("hidden");
        return;
      }
      // mqtt_compat_ok is false for a reported mismatch, null when the master
      // predates the version protocol. Never treat "unknown" as compatible.
      // "compat_ok"/"compat" are aliases emitted for older panel builds.
      const mqttOk =
        coordinator.mqtt_compat_ok !== undefined
          ? coordinator.mqtt_compat_ok
          : coordinator.compat_ok;
      if (mqttOk === false) {
        banner.classList.remove("hidden");
        text.textContent = formatMessage(this._t("compat_mismatch"), {
          master:
            coordinator.master_mqtt_compat != null
              ? coordinator.master_mqtt_compat
              : coordinator.master_compat,
          local:
            coordinator.mqtt_compat != null
              ? coordinator.mqtt_compat
              : coordinator.compat,
        });
        return;
      }
      if (mqttOk === null) {
        banner.classList.remove("hidden");
        text.textContent = this._t("compat_missing");
        return;
      }
      banner.classList.add("hidden");
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
