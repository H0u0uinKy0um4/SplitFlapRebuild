/** Shared panel chrome: header, tabs, modal shells, banners and toasts. */

import { DOMAIN, VERSION } from "../constants.js?v=1.2.11";
import { escapeAttr, escapeHtml, formatMessage } from "../utils.js?v=1.2.11";
import { PANEL_STYLES } from "../styles.js?v=1.2.11";

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
        <header class="topbar">
          <div class="brand">
            <div class="logo" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="4" y="4" width="16" height="16" rx="2.5" />
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="9" y1="4" x2="9" y2="20" />
                <line x1="15" y1="4" x2="15" y2="20" />
              </svg>
            </div>
            <h1 class="title">SPLIT-FLAP OS</h1>
          </div>
          <div class="topbar-right">
            <span class="status-pill connecting" id="statusPill">
              <span class="status-dot"></span>
              <span id="statusText">${this._t("connecting")}</span>
            </span>
            <button class="icon-btn" data-action="toggle-theme" id="themeBtn" title="${escapeAttr(this._t('toggle_theme'))}" aria-label="${escapeAttr(this._t('toggle_theme'))}"></button>
            <button class="icon-btn" data-action="refresh" title="${escapeAttr(this._t('refresh_state'))}" aria-label="${escapeAttr(this._t('refresh_state'))}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
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

        <footer class="footer">
          <div class="footer-info">
            <span class="version-tag">v${VERSION}</span>
            <span id="footerMeta">${escapeHtml(this._t("connecting_subtitle"))}</span>
          </div>
          <span class="version-tag" id="compatMeta">MQTT —</span>
        </footer>

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
      this._applyTheme();
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
      this._applyTheme();
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

    _themeValue() {
      // A toggle in flight wins over the engine snapshot so a state push that
      // lands before persistence cannot flip the panel back for one frame.
      if (this._themePending) return this._themePending;
      const engine = this._engine();
      const settings = (engine && engine.settings) || {};
      const stored = String(settings.theme || "").toLowerCase();
      if (stored === "dark" || stored === "light") return stored;
      // "auto" (or a snapshot from before the setting existed) follows the
      // theme Home Assistant resolved for this user.
      return this._systemTheme();
    }

    _systemTheme() {
      const themes = this._hass && this._hass.themes;
      if (themes && typeof themes.darkMode === "boolean") {
        return themes.darkMode ? "dark" : "light";
      }
      // Before `hass` is attached, mirror the OS preference so the first paint
      // matches what Home Assistant will resolve to.
      try {
        if (
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
        ) {
          return "dark";
        }
      } catch (err) {
        /* matchMedia may be unavailable in unusual embeds. */
      }
      return this._theme === "dark" ? "dark" : "light";
    }

    _applyTheme(theme = null) {
      const next = theme == null ? this._themeValue() : theme;
      const applied = next === "dark" ? "dark" : "light";
      if (this._theme !== applied) {
        this._theme = applied;
        // Cache so the next page load paints the right theme immediately.
        try {
          window.localStorage.setItem(`${DOMAIN}_theme`, applied);
        } catch (err) {
          /* local storage may be unavailable in private windows. */
        }
      }
      // `data-theme` drives the `:host([data-theme="dark"])` token block.
      if (this.getAttribute("data-theme") !== applied) {
        this.setAttribute("data-theme", applied);
      }
      this._renderThemeButton(applied);
    }

    _renderThemeButton(theme) {
      const btn = this.shadowRoot && this.shadowRoot.getElementById("themeBtn");
      if (!btn || btn.dataset.theme === theme) return;
      btn.dataset.theme = theme;
      const label = this._t("toggle_theme");
      btn.title = label;
      btn.setAttribute("aria-label", label);
      // The icon shows the theme the button switches to.
      btn.innerHTML =
        theme === "dark"
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>`;
    }

    _renderStatus() {
      const pill = this.shadowRoot.getElementById("statusPill");
      const pillText = this.shadowRoot.getElementById("statusText");
      const footer = this.shadowRoot.getElementById("footerMeta");
      if (!pill) return;
      if (!this._state) {
        pill.className = "status-pill connecting";
        if (pillText) pillText.textContent = this._t("connecting");
        if (footer) footer.textContent = this._t("connecting_subtitle");
        return;
      }

      const coordinator = this._coordinator();
      const engine = this._engine();
      const board = this._board();
      const online = Boolean(coordinator.online);
      pill.className = `status-pill ${online ? "online" : "offline"}`;
      if (pillText) pillText.textContent = this._t(online ? "online" : "offline");

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
      if (footer) footer.textContent = parts.join(" • ");

      const compat = this.shadowRoot.getElementById("compatMeta");
      if (compat) {
        // Prefer what the master reports; fall back to the generation this
        // integration expects so the badge is meaningful before the first
        // versioned status payload arrives.
        const master = coordinator.master_mqtt_compat;
        const local =
          coordinator.mqtt_compat != null
            ? coordinator.mqtt_compat
            : coordinator.compat;
        const shown = master != null ? master : local;
        compat.textContent = shown != null ? `MQTT ${shown}` : "MQTT —";
      }
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
