/** Tuning tab: module matrix, commands, map, auto-tune, teach and drum. */

import { COLOR_CODES, DEFAULT_DRUM } from "../../constants.js?v=1.2.11";
import {
  escapeAttr,
  escapeHtml,
  formatMessage,
  numberText,
} from "../../utils.js?v=1.2.11";

export const PanelMixin = (Base) =>
  class extends Base {
    _tuningPage() {
      return `
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

          <nav class="subtabs">
            <button class="subtab active" data-action="subtab" data-group="tuning" data-sub="commands">${this._t("subtab_commands")}</button>
            <button class="subtab" data-action="subtab" data-group="tuning" data-sub="map">${this._t("subtab_map")}</button>
            <button class="subtab" data-action="subtab" data-group="tuning" data-sub="autotune">${this._t("subtab_autotune")}</button>
            <button class="subtab" data-action="subtab" data-group="tuning" data-sub="teach">${this._t("subtab_teach")}</button>
            <button class="subtab" data-action="subtab" data-group="tuning" data-sub="drum">${this._t("subtab_drum")}</button>
          </nav>

          <div class="subpage active" data-subpage="tuning" data-sub="commands">
            <div class="card inspector" id="controlsCard">
              <div class="row between">
                <h2 style="margin:0" id="inspectTitle">${this._t('module')}</h2>
                <span class="muted" id="inspectState"></span>
              </div>
              <div class="empty hidden" id="controlsEmpty">${escapeHtml(this._t('select_module_hint'))}</div>
              <div class="hidden" id="controlsBody">
                <div class="stats">
                  <div class="stat"><b id="statFlap">–</b><span>${this._t('flap')}</span></div>
                  <div class="stat"><b id="statActual">–</b><span>${this._t('reported')}</span></div>
                  <div class="stat"><b id="statStep">–</b><span>${this._t('step')}</span></div>
                  <div class="stat"><b id="statIndex">–</b><span>${this._t('index')}</span></div>
                  <div class="stat"><b id="statOffset">–</b><span>${this._t('offset')}</span></div>
                  <div class="stat"><b id="statTotal">–</b><span>${this._t('total_steps')}</span></div>
                  <div class="stat"><b id="statFirmware">–</b><span>${this._t('firmware')}</span></div>
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
                  <div class="row" style="align-items:flex-end">
                    <button class="btn secondary" data-action="module" data-sub="step">${this._t('step')}</button>
                    <button class="btn danger" data-action="module" data-sub="home">${this._t('home_motor')}</button>
                  </div>
                  <label class="field"><span>${this._t('home_offset')}</span>
                    <input id="offsetValue" type="number" min="0" max="65535" placeholder="${escapeAttr(this._t('steps'))}">
                    <div class="quick-offsets">
                      <button data-action="quick-offset" data-delta="-16">-16</button>
                      <button data-action="quick-offset" data-delta="-4">-4</button>
                      <button data-action="quick-offset" data-delta="-1">-1</button>
                      <button data-action="quick-offset" data-delta="1">+1</button>
                      <button data-action="quick-offset" data-delta="4">+4</button>
                      <button data-action="quick-offset" data-delta="16">+16</button>
                    </div>
                  </label>
                  <div class="row" style="align-items:flex-start;padding-top:24px">
                    <button class="btn secondary" data-action="module" data-sub="apply_offset">${this._t('set_offset')}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="subpage" data-subpage="tuning" data-sub="map">
            <div class="card inspector" id="mapCard">
              <div class="row between">
                <h2 style="margin:0" id="mapTitle">${this._t('module')}</h2>
                <span class="muted" id="mapState"></span>
              </div>
              <div class="empty hidden" id="mapEmpty">${escapeHtml(this._t('select_module_hint'))}</div>
              <div class="hidden" id="mapBody">
                <div class="row between" style="margin-bottom:8px">
                  <h3 style="margin:0">${this._t('character_map')}</h3>
                  <small class="muted">${this._t('char_map_help')}</small>
                </div>
                <div class="char-map" id="mapFlaps" style="margin-bottom:14px"></div>

                <div class="grid2">
                  <label class="field"><span>${this._t('record_at_index')}</span>
                    <input id="recordIndex" type="number" min="0" max="63" placeholder="0-63">
                  </label>
                  <div class="row" style="align-items:flex-end">
                    <button class="btn secondary" data-action="module" data-sub="record">${this._t('record')}</button>
                    <button class="btn secondary" data-action="module" data-sub="clear_map">${this._t('clear_map')}</button>
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
            </div>
          </div>

          <div class="subpage" data-subpage="tuning" data-sub="autotune">
            <div class="card" id="autoTuneCard">
              <div class="row between">
                <h2 style="margin:0">${this._t('auto_tune_title')}</h2>
                <span class="muted" id="autoTuneMeta"></span>
              </div>
              <div id="autoTuneBody" style="margin-top:14px"></div>
            </div>
          </div>

          <div class="subpage" data-subpage="tuning" data-sub="teach">
            <div class="card" id="teachCard">
              <div class="row between">
                <h2 style="margin:0">${this._t('teach_title')}</h2>
                <span class="muted" id="teachMeta"></span>
              </div>
              <div class="empty hidden" id="teachEmpty">${escapeHtml(this._t('select_module_hint'))}</div>
              <div id="teachBody" style="margin-top:14px"></div>
            </div>
          </div>

          <div class="subpage" data-subpage="tuning" data-sub="drum">
            <div class="card inspector" id="drumCard">
              <div class="row between">
                <h2 style="margin:0" id="drumTitle">${this._t('module')}</h2>
                <span class="muted" id="drumState"></span>
              </div>
              <div class="empty hidden" id="drumEmpty">${escapeHtml(this._t('select_module_hint'))}</div>
              <div class="hidden" id="drumBody">
                <label class="field">
                  <span>${this._t('module_drum')}</span>
                  <select id="moduleDrumSelect"></select>
                  <small class="muted">${this._t('drum_select_help')}</small>
                </label>
                <div class="actions">
                  <button class="btn danger" data-action="module" data-sub="drum_write">${this._t('write_to_eeprom')}</button>
                  <span class="muted mono" id="moduleDrumPreview"></span>
                </div>
                <div class="row between" style="margin-top:16px">
                  <h3 style="margin:0">${this._t('character_map')}</h3>
                  <span class="muted" id="charMapTitle"></span>
                </div>
                <div class="char-map" id="charMap" style="margin-top:12px"></div>
                <p class="muted" style="margin-bottom:0">
                  ${this._t('char_map_help')}
                </p>
              </div>
            </div>
          </div>
        </section>`;
    }

    _renderModuleDrumSelect() {
      const select = this.shadowRoot.getElementById("moduleDrumSelect");
      if (!select) return;
      const drums = (this._engine() && this._engine().saved_drums) || {};
      // Capture the choice BEFORE rebuilding: replacing <option>s resets the
      // selection to the first entry. Skip the rebuild entirely while the
      // select is focused so an open dropdown is never closed under the user.
      const current = select.value;
      if (this.shadowRoot.activeElement !== select) {
        const names = Object.keys(drums).sort((a, b) => a.localeCompare(b));
        // "__stock__" is a sentinel value: the stock drum is not a saved set,
        // so it cannot collide with a user-chosen name.
        let html = `<option value="__stock__">${escapeHtml(this._t("stock_drum"))}</option>`;
        for (const name of names) {
          html += `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`;
        }
        select.innerHTML = html;
      }
      // Keep the current choice across re-renders; fall back to stock when it
      // was deleted from the library.
      select.value =
        current && (current === "__stock__" || drums[current])
          ? current
          : "__stock__";
      this._updateModuleDrumPreview();
    }

    _updateModuleDrumPreview() {
      const select = this.shadowRoot.getElementById("moduleDrumSelect");
      const preview = this.shadowRoot.getElementById("moduleDrumPreview");
      if (!select || !preview) return;
      const drum =
        select.value === "__stock__"
          ? DEFAULT_DRUM
          : this._savedDrum(select.value);
      if (!this._validDrum(drum)) {
        preview.textContent = "";
        preview.title = "";
        return;
      }
      preview.textContent = drum;
      preview.title = drum;
    }

    _renderTuning() {
      if (!this._state) return;
      const coordinator = this._coordinator();
      const board = this._board();
      const modules = coordinator.modules || [];
      const matrix = this.shadowRoot.getElementById("moduleMatrix");
      const meta = this.shadowRoot.getElementById("matrixMeta");

      if (matrix) {
        const rows = Math.max(
          board.rows,
          Math.ceil(modules.length / board.cols) || 1
        );
        let html = "";
        let slotBase = 0;
        for (let row = 0; row < rows; row += 1) {
          const inLayout = row < board.rows;
          const count = inLayout
            ? Math.max(
                0,
                Math.min(board.cols, Number(board.rowCounts[row]) || 0)
              )
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
              module.displayed_flap != null
                ? module.displayed_flap
                : module.flap || " ";
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

      // Load default drum into the editor textarea (Settings > Drum).
      const drumTextarea = this.shadowRoot.getElementById("defaultDrum");
      if (drumTextarea && !this._settingsDirty) {
        const engine = this._engine();
        const settings = (engine && engine.settings) || {};
        const drum = settings.default_drum || "";
        if (drumTextarea.value !== drum) drumTextarea.value = drum;
      }
      this._updateDrumCharCount();

      const selected = this._moduleFor(this._selectedModule);
      const hasModule = Boolean(selected);
      // Module-scoped cards: Commands, Map, Drum, Teach. Each has its own
      // body/empty pair toggled by whether a module is selected.
      const bodyEmptyPairs = [
        ["controlsBody", "controlsEmpty"],
        ["mapBody", "mapEmpty"],
        ["drumBody", "drumEmpty"],
        ["teachBody", "teachEmpty"],
      ];
      for (const [bodyId, emptyId] of bodyEmptyPairs) {
        const body = this.shadowRoot.getElementById(bodyId);
        const empty = this.shadowRoot.getElementById(emptyId);
        if (body) body.classList.toggle("hidden", !hasModule);
        if (empty) empty.classList.toggle("hidden", hasModule);
      }

      if (!selected) {
        this._selectedModule = null;
        this._inspectorModule = null;
        const titles = ["inspectTitle", "mapTitle", "drumTitle"];
        for (const id of titles) {
          const node = this.shadowRoot.getElementById(id);
          if (node) node.textContent = this._t("module");
        }
        for (const id of ["inspectState", "mapState", "drumState"]) {
          const node = this.shadowRoot.getElementById(id);
          if (node) node.textContent = "";
        }
        this._renderCharMap(null);
        this._renderMapFlaps(null);
        return;
      }

      const moduleTitle = formatMessage(this._t("module_named"), {
        id: selected.id,
      });
      for (const id of ["inspectTitle", "mapTitle", "drumTitle"]) {
        const node = this.shadowRoot.getElementById(id);
        if (node) node.textContent = moduleTitle;
      }
      const stateText = `${String(
        selected.state || this._t("unknown")
      ).toUpperCase()} • ${this._t(
        selected.online === false ? "offline" : "online"
      )}`;
      for (const id of ["inspectState", "mapState", "drumState"]) {
        const node = this.shadowRoot.getElementById(id);
        if (node) node.textContent = stateText;
      }

      const values = {
        statFlap:
          selected.displayed_flap != null
            ? selected.displayed_flap
            : selected.flap,
        statActual:
          selected.actual_flap != null ? selected.actual_flap : selected.flap,
        statStep: selected.current_step,
        statIndex:
          selected.display_flap_index != null
            ? selected.display_flap_index
            : selected.flap_index,
        statOffset: selected.home_offset,
        statTotal: selected.total_steps,
        statFirmware: selected.fw_version,
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
      this._renderModuleDrumSelect();

      // No direct onclick wiring here: every button carries data-action and is
      // handled by the single delegated click listener. A second, direct
      // handler made one click run the action (and its toast) twice.

      this._renderCharMap(selected);
      this._renderMapFlaps(selected);
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
        Array.isArray(module.effective_drum) && module.effective_drum.length
          ? module.effective_drum
          : Array.isArray(module.flap_list) && module.flap_list.length
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
          const color = COLOR_CODES.includes(char) ? ` color-${char}` : "";
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

    _renderMapFlaps(module) {
      const node = this.shadowRoot.getElementById("mapFlaps");
      if (!node) return;
      if (!module) {
        node.innerHTML = "";
        return;
      }
      const drum =
        Array.isArray(module.effective_drum) && module.effective_drum.length
          ? module.effective_drum
          : Array.isArray(module.flap_list) && module.flap_list.length
            ? module.flap_list
            : DEFAULT_DRUM.split("");
      const positions = module.map_of_positions || {};
      const currentIndex =
        module.display_flap_index != null
          ? Number(module.display_flap_index)
          : module.flap_index != null
            ? Number(module.flap_index)
            : -1;

      node.innerHTML = drum
        .map((char, index) => {
          const color = COLOR_CODES.includes(char) ? ` color-${char}` : "";
          const tuned = positions[String(index)] !== undefined;
          const current = index === currentIndex;
          const step = positions[String(index)];
          const title =
            formatMessage(this._t("index_named"), { index }) +
            (tuned ? ` • ${step}` : "");
          return `<button class="char${color}${tuned ? " tuned" : ""}${current ? " current" : ""}"
          data-action="open-tune-flap" data-index="${index}" title="${escapeAttr(title)}">
          ${char === " " ? "␣" : escapeHtml(char)}<small>${index}</small>
        </button>`;
        })
        .join("");
    }

    _openTuneModal(flapIndex) {
      const module = this._moduleFor(this._selectedModule);
      if (!module) {
        this._toast(this._t("select_module_first"), "warn");
        return;
      }
      const drum =
        Array.isArray(module.effective_drum) && module.effective_drum.length
          ? module.effective_drum
          : Array.isArray(module.flap_list) && module.flap_list.length
            ? module.flap_list
            : DEFAULT_DRUM.split("");
      const idx = Number(flapIndex);
      const char = drum[idx] || " ";
      const expected = this._expectedStep(module, idx, drum.length);
      const positions = module.map_of_positions || {};
      const tuned = positions[String(idx)];
      const active = tuned !== undefined ? Number(tuned) : expected;

      this._tuneFlapState = {
        moduleId: module.id,
        index: idx,
        char,
        expected,
        tuned: tuned !== undefined ? Number(tuned) : null,
        active,
      };

      this._renderTuneModal();
    }

    _renderTuneModal() {
      const modal = this.shadowRoot.getElementById("tuneModal");
      const title = this.shadowRoot.getElementById("tuneModalTitle");
      const body = this.shadowRoot.getElementById("tuneModalBody");
      if (!modal || !title || !body) return;
      if (!this._tuneFlapState) {
        modal.classList.add("hidden");
        return;
      }

      const { moduleId, index, char, expected, tuned, active } =
        this._tuneFlapState;
      const isColor = COLOR_CODES.includes(char);
      const colorSuffix = isColor ? ` (${this._t("color_" + char)})` : "";
      title.textContent = formatMessage(this._t("tune_flap_title"), {
        index,
        char: (char === " " ? "␣" : char) + colorSuffix,
        id: moduleId,
      });

      body.innerHTML = `
      <div class="row between" style="margin-bottom:12px;font-size:.9rem">
        <span>${formatMessage(this._t("tune_flap_expected"), { step: expected })}</span>
        <span>${formatMessage(this._t("tune_flap_tuned"), { step: tuned !== null ? tuned : "—" })}</span>
        <span><strong>${formatMessage(this._t("tune_flap_active"), { step: active })}</strong></span>
      </div>
      <label class="field">
        <span>${this._t("tune_flap_step_label")}</span>
        <input id="tuneStepInput" type="number" min="0" max="65535" value="${active}">
      </label>
      <div class="field" style="margin-top:10px">
        <label>${this._t("tune_flap_nudge")}</label>
        <div class="quick-offsets">
          <button data-action="tune-nudge" data-delta="-16">-16</button>
          <button data-action="tune-nudge" data-delta="-4">-4</button>
          <button data-action="tune-nudge" data-delta="-1">-1</button>
          <button data-action="tune-nudge" data-delta="1">+1</button>
          <button data-action="tune-nudge" data-delta="4">+4</button>
          <button data-action="tune-nudge" data-delta="16">+16</button>
        </div>
      </div>
      <div class="actions" style="margin-top:16px;flex-wrap:wrap">
        <button class="btn secondary" data-action="tune-test-goto">${this._t("tune_flap_test_goto")}</button>
        <button class="btn" data-action="tune-save">${this._t("tune_flap_save")}</button>
        ${tuned !== null ? `<button class="btn danger" data-action="tune-revert">${this._t("tune_flap_revert")}</button>` : ""}
      </div>
    `;

      modal.classList.remove("hidden");
    }

    _closeTuneModal() {
      this._tuneFlapState = null;
      const modal = this.shadowRoot.getElementById("tuneModal");
      if (modal) modal.classList.add("hidden");
    }

    _renderAutoTune() {
      const body = this.shadowRoot.getElementById("autoTuneBody");
      const meta = this.shadowRoot.getElementById("autoTuneMeta");
      if (!body) return;

      const maxIdx = this._atMaxIndex();

      if (!this._atState || !this._atState.running) {
        if (meta) meta.textContent = "";
        body.innerHTML = `
        <div class="at-stage">
          <h3 style="margin:0">${escapeHtml(this._t("at_start_title"))}</h3>
          <p class="muted" style="margin:0">${escapeHtml(this._t("at_start_intro"))}</p>
          <div class="grid2" style="max-width:360px;margin-top:8px">
            <label class="field">
              <span>${this._t("at_start_idx")}</span>
              <input id="atStartIdx" type="number" min="1" max="${maxIdx}" value="${this._atState && this._atState.charIndex ? this._atState.charIndex : maxIdx}">
            </label>
            <label class="field">
              <span>${this._t("at_step_size")}</span>
              <input id="atStepSize" type="number" min="1" max="100" value="${this._atState && this._atState.stepSize ? this._atState.stepSize : 25}">
            </label>
          </div>
          <div class="actions" style="margin-top:8px">
            <button class="btn" data-action="at-begin">${this._t("at_begin_btn")}</button>
          </div>
        </div>
      `;
        return;
      }

      const at = this._atState;
      if (at.phase === "homing") {
        if (meta) meta.textContent = "";
        body.innerHTML = `
        <div class="at-stage" style="text-align:center;padding:30px 10px">
          <h3 style="margin:0">${escapeHtml(this._t("at_homing_title"))}</h3>
          <div style="font-size:1.4rem;font-weight:700;margin:16px 0;font-family:monospace">
            ${formatMessage(this._t("at_homing_wait"), { seconds: at.countdown != null ? at.countdown : 12 })}
          </div>
          <div class="actions" style="justify-content:center">
            <button class="btn danger mini" data-action="at-abort">${this._t("at_abort_btn")}</button>
          </div>
        </div>
      `;
        return;
      }

      if (at.phase === "done") {
        if (meta) meta.textContent = "";
        body.innerHTML = `
        <div class="at-stage" style="text-align:center;padding:30px 10px">
          <h3 style="margin:0">${escapeHtml(this._t("at_done_title"))}</h3>
          <p class="muted" style="margin:12px 0">${escapeHtml(this._t("at_done_msg"))}</p>
          <div class="actions" style="justify-content:center;margin-top:16px">
            <button class="btn" data-action="at-restart">${this._t("refresh")}</button>
          </div>
        </div>
      `;
        return;
      }

      const coordinator = this._coordinator();
      const modules = coordinator.modules || [];
      const board = this._board();
      const drum = this._atDrum();
      const maxCharIdx = Math.max(0, drum.length - 1);
      const curIdx = at.charIndex;
      const curChar = drum[curIdx] || " ";
      const prevChar =
        curIdx > 0 ? (drum[curIdx - 1] === " " ? "␣" : drum[curIdx - 1]) : "?";
      const nextChar =
        curIdx < maxCharIdx
          ? drum[curIdx + 1] === " "
            ? "␣"
            : drum[curIdx + 1]
          : "?";
      const curCharDisp = curChar === " " ? "␣" : curChar;
      const isColor = COLOR_CODES.includes(curChar);
      const colorClass = isColor ? ` color-${curChar}` : "";
      const colorSuffix = isColor ? ` (${this._t("color_" + curChar)})` : "";
      const charTitle = curCharDisp + colorSuffix;

      if (meta) {
        meta.textContent = formatMessage(this._t("at_char_title"), {
          idx: curIdx,
          char: charTitle,
        });
      }

      let instrHtml = "";
      let btnHtml = "";
      const selectedCount = at.selected ? at.selected.size : 0;
      const stepSize = at.stepSize || 25;

      if (at.phase === "ahead") {
        instrHtml = formatMessage(this._t("at_ahead_prompt"), {
          char: curCharDisp,
          nextChar,
        });
        btnHtml = `
        <button class="btn" style="background:#b71c1c;color:#fff" data-action="at-apply-ahead">
          ${formatMessage(this._t("at_ahead_apply"), { step: stepSize, count: selectedCount })}
        </button>
        <button class="btn secondary" data-action="at-skip-ahead">${this._t("at_ahead_skip")}</button>
      `;
      } else if (at.phase === "behind") {
        instrHtml = formatMessage(this._t("at_behind_prompt"), {
          char: curCharDisp,
          prevChar,
        });
        btnHtml = `
        <button class="btn" style="background:#2e7d32;color:#fff" data-action="at-apply-behind">
          ${formatMessage(this._t("at_behind_apply"), { step: stepSize, count: selectedCount })}
        </button>
        <button class="btn" data-action="at-next-char">${this._t("at_all_good")}</button>
        <button class="btn secondary mini" data-action="at-recheck-ahead">${this._t("at_recheck_ahead")}</button>
      `;
      } else {
        // verify
        instrHtml = formatMessage(this._t("at_verify_prompt"), {
          char: curCharDisp,
        });
        btnHtml = `
        <button class="btn" data-action="at-next-char">${this._t("at_all_good")}</button>
        <button class="btn secondary" data-action="at-recheck-ahead">${this._t("at_still_wrong")}</button>
      `;
      }

      let gridHtml = "";
      let slotBase = 0;
      for (let row = 0; row < board.rows; row += 1) {
        const count = Math.max(
          0,
          Math.min(board.cols, Number(board.rowCounts[row]) || 0)
        );
        const offset = Math.max(0, Number(board.rowOffsets[row]) || 0);
        for (let col = 0; col < board.cols; col += 1) {
          if (col < offset || col >= offset + count) {
            gridHtml += '<div class="mod void"></div>';
            continue;
          }
          const module = modules[slotBase + col - offset];
          if (!module) {
            gridHtml += '<div class="mod empty"></div>';
            continue;
          }
          const modId = module.id;
          const isSelected = at.selected && at.selected.has(modId);
          const positions = module.map_of_positions || {};
          const isTuned = positions[String(curIdx)] !== undefined;
          let selClass = "";
          if (isSelected) {
            selClass = at.phase === "ahead" ? " sel-ahead" : " sel-behind";
          }
          gridHtml += `
          <div class="at-cell${isTuned ? " tuned-indicator" : ""}${selClass}"
               data-action="at-cell" data-id="${escapeAttr(modId)}"
               title="${escapeAttr(this._t("module"))} ${escapeAttr(modId)}${isTuned ? " (tuned)" : ""}">
            <span>${escapeHtml(modId)}</span>
          </div>`;
        }
        slotBase += count;
      }

      body.innerHTML = `
      <div class="at-stage">
        <div class="row between" style="align-items:center">
          <div class="row" style="align-items:center;gap:12px">
            <div class="at-char-box${colorClass}">${curCharDisp}</div>
            <div>
              <div style="font-weight:700;font-size:1.1rem">${formatMessage(this._t("at_char_title"), { idx: curIdx, char: charTitle })}</div>
              <div class="muted" style="font-size:.82rem">${at.phase.toUpperCase()}</div>
            </div>
          </div>
          <label class="field" style="margin:0;max-width:120px">
            <span>${this._t("at_step_size")}</span>
            <input id="atStepSizeActive" type="number" min="1" max="100" value="${stepSize}">
          </label>
        </div>

        <div class="at-instructions">${instrHtml}</div>

        <div class="at-grid" style="--cols:${board.cols}">${gridHtml}</div>

        <div class="row between" style="align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px">
          <div class="actions" style="margin:0;flex-wrap:wrap">
            ${btnHtml}
          </div>
          <div class="row" style="align-items:center;gap:6px">
            <span class="muted" style="font-size:.82rem">${this._t("at_jump_to")}</span>
            <input id="atJumpIdx" type="number" min="1" max="${maxIdx}" value="${curIdx}" style="width:65px">
            <button class="btn secondary mini" data-action="at-jump">${this._t("at_jump_btn")}</button>
            <button class="btn danger mini" data-action="at-abort">${this._t("at_abort_btn")}</button>
          </div>
        </div>
      </div>
    `;
    }

    _renderTeach() {
      const body = this.shadowRoot.getElementById("teachBody");
      const meta = this.shadowRoot.getElementById("teachMeta");
      const empty = this.shadowRoot.getElementById("teachEmpty");
      if (!body) return;

      const module = this._moduleFor(this._selectedModule);
      if (!module) {
        if (empty) empty.classList.remove("hidden");
        if (meta) meta.textContent = "";
        body.innerHTML = "";
        return;
      }
      if (empty) empty.classList.add("hidden");

      if (meta) {
        meta.textContent = formatMessage(this._t("module_named"), {
          id: module.id,
        });
      }

      if (!this._teachState || !this._teachState.running) {
        body.innerHTML = `
        <div class="at-stage">
          <h3 style="margin:0">${escapeHtml(this._t("teach_title"))}</h3>
          <p class="muted" style="margin:0">${escapeHtml(this._t("teach_intro"))}</p>
          <div class="actions" style="margin-top:12px">
            <button class="btn" data-action="teach-start">${this._t("teach_apply")}</button>
          </div>
        </div>
      `;
        return;
      }

      const state = this._teachState;
      if (state.done) {
        body.innerHTML = `
        <div class="at-stage" style="text-align:center;padding:30px 10px">
          <h3 style="margin:0">${escapeHtml(this._t("teach_done"))}</h3>
          <div class="actions" style="justify-content:center;margin-top:16px">
            <button class="btn" data-action="teach-restart">${this._t("refresh")}</button>
          </div>
        </div>
      `;
        return;
      }

      const drum =
        Array.isArray(module.effective_drum) && module.effective_drum.length
          ? module.effective_drum
          : Array.isArray(module.flap_list) && module.flap_list.length
            ? module.flap_list
            : DEFAULT_DRUM.split("");
      const curIdx = state.flapIndex;
      const curChar = drum[curIdx] || " ";
      const curCharDisp = curChar === " " ? "␣" : curChar;
      const isColor = COLOR_CODES.includes(curChar);
      const colorClass = isColor ? ` color-${curChar}` : "";
      const colorSuffix = isColor ? ` (${this._t("color_" + curChar)})` : "";
      const charTitle = curCharDisp + colorSuffix;
      const expected = this._expectedStep(module, curIdx, drum.length);
      const activeStep = state.currentStep != null ? state.currentStep : expected;

      body.innerHTML = `
      <div class="at-stage">
        <div class="row between" style="align-items:center">
          <div class="row" style="align-items:center;gap:14px">
            <div class="at-char-box${colorClass}">${curCharDisp}</div>
            <div>
              <div style="font-weight:700;font-size:1.1rem">
                ${formatMessage(this._t("teach_phase_label"), { current: curIdx + 1, total: 64 })} — "${charTitle}"
              </div>
              <div class="muted" style="font-size:.82rem">
                ${formatMessage(this._t("teach_expected_step"), { step: expected })} • 
                ${formatMessage(this._t("teach_active_step"), { step: activeStep })}
              </div>
            </div>
          </div>
          <label class="field" style="margin:0;max-width:140px">
            <span>${this._t("tune_flap_step_label")}</span>
            <input id="teachStepInput" type="number" min="0" max="65535" value="${activeStep}">
          </label>
        </div>

        <div class="nudge-row">
          <button data-action="teach-nudge" data-delta="-32">-32</button>
          <button data-action="teach-nudge" data-delta="-8">-8</button>
          <button data-action="teach-nudge" data-delta="-1">-1</button>
          <button data-action="teach-nudge" data-delta="1">+1</button>
          <button data-action="teach-nudge" data-delta="8">+8</button>
          <button data-action="teach-nudge" data-delta="32">+32</button>
        </div>

        <div class="row between" style="margin-top:14px;flex-wrap:wrap;gap:8px">
          <div class="actions" style="margin:0;flex-wrap:wrap">
            <button class="btn" data-action="teach-record-next">${this._t("teach_record_next")}</button>
            <button class="btn secondary" data-action="teach-skip">${this._t("teach_skip")}</button>
            ${curIdx > 0 ? `<button class="btn secondary" data-action="teach-prev">${this._t("teach_prev")}</button>` : ""}
          </div>
          <button class="btn danger mini" data-action="teach-abort">${this._t("teach_abort")}</button>
        </div>
      </div>
    `;
    }
  };
