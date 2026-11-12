/** Panel CSS, kept separate from the component logic. */

export const PANEL_STYLES = `
:host {
  display: block;
  min-height: 100%;
  color-scheme: light;

  /* ── Design tokens ─────────────────────────────────────────────── */
  --sf-bg-canvas: #f4f6f8;
  --sf-bg-card: #ffffff;
  --sf-bg-subtle: #f1f3f5;
  --sf-border: #e2e6ea;
  --sf-border-strong: #cfd6de;
  --sf-text: #111827;
  --sf-text-2: #4b5563;
  --sf-muted: #6b7280;
  --sf-accent: #0095c8;
  --sf-accent-hover: #007ea8;
  --sf-accent-glow: rgba(0, 149, 200, 0.28);
  --sf-card-shadow: 0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03);
  --sf-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --sf-font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* Scoped animation knobs so the flap display stays CSS-only. */
  --sf-flip-angle: -82deg;
  --sf-flip-duration: .2s;

  background: var(--sf-bg-canvas);
  color: var(--sf-text);
  font-family: var(--sf-font-sans);
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
.hidden { display: none !important; }

.app {
  max-width: 1040px;
  margin: 0 auto;
  padding: 16px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Compact single-row top bar ─────────────────────────────────── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px;
}
.brand { display: flex; align-items: center; gap: 10px; }
.logo {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, #00a4dc 0%, #0082af 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 3px 8px rgba(0, 149, 200, 0.25);
  flex: 0 0 auto;
}
.title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.topbar-right { display: flex; align-items: center; gap: 8px; }

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.status-pill.online { background: #ecfdf5; color: #059669; border-color: #a7f3d0; }
.status-pill.connecting { background: #fffbeb; color: #b45309; border-color: #fde68a; }
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.status-pill.online .status-dot { animation: pulseDot 1.6s infinite; }
@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.85); }
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: var(--sf-bg-card);
  border: 1px solid var(--sf-border);
  color: var(--sf-text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.15s;
}
.icon-btn:hover {
  background: #f9fafb;
  color: var(--sf-text);
  border-color: var(--sf-border-strong);
}

/* ── Segmented tab bar ──────────────────────────────────────────── */
.tabs {
  background: var(--sf-bg-card);
  border: 1px solid var(--sf-border);
  border-radius: 13px;
  padding: 4px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  box-shadow: var(--sf-card-shadow);
  position: sticky;
  top: 0;
  z-index: 20;
}
.tab {
  border: none;
  background: transparent;
  color: var(--sf-text-2);
  padding: 9px 8px;
  border-radius: 10px;
  font-family: var(--sf-font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.tab:hover:not(.active) { background: var(--sf-bg-subtle); color: var(--sf-text); }
.tab.active {
  background: var(--sf-accent);
  color: #ffffff;
  box-shadow: 0 2px 8px var(--sf-accent-glow);
}

/* ── Section headers ────────────────────────────────────────────── */
.section-wrap { display: flex; flex-direction: column; gap: 8px; }
.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 4px;
}
.section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--sf-text-2);
}
.meta-badge {
  font-family: var(--sf-font-mono);
  font-size: 11px;
  color: var(--sf-muted);
  font-variant-numeric: tabular-nums;
}

/* ── Pages and cards ────────────────────────────────────────────── */
.page { display: none; }
.page.active {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: pageIn 0.18s ease-out;
}
.subpage { display: none; }
.subpage.active {
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: pageIn 0.18s ease-out;
}
@keyframes pageIn { from { opacity: 0; transform: translateY(4px); } }

.card {
  background: var(--sf-bg-card);
  border: 1px solid var(--sf-border);
  border-radius: 13px;
  padding: 16px;
  box-shadow: var(--sf-card-shadow);
}
.card h2, .card h3 {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--sf-text-2);
}
.card > h2:last-child, .card > h3:last-child { margin-bottom: 0; }

.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.between { justify-content: space-between; }
.muted { opacity: 0.62; font-size: 0.8rem; color: var(--sf-text-2); }
.mono { font-family: var(--sf-font-mono); }

/* ── Subtabs ────────────────────────────────────────────────────── */
.subtabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  background: var(--sf-bg-card);
  border: 1px solid var(--sf-border);
  border-radius: 11px;
  padding: 4px;
  box-shadow: var(--sf-card-shadow);
}
.subtab {
  flex: 1 0 auto;
  border: 0;
  border-radius: 8px;
  padding: 8px 14px;
  background: transparent;
  color: var(--sf-text-2);
  cursor: pointer;
  font-family: var(--sf-font-sans);
  font-weight: 700;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.subtab:hover:not(.active) { background: var(--sf-bg-subtle); color: var(--sf-text); }
.subtab.active {
  background: var(--sf-accent);
  color: #ffffff;
  box-shadow: 0 2px 8px var(--sf-accent-glow);
}
.subtabs.nested {
  margin-top: 14px;
  margin-bottom: 12px;
  padding: 3px 4px;
  border-style: dashed;
  box-shadow: none;
}
.subtabs.nested .subtab { padding: 6px 11px; font-size: 9.5px; }
.settings-group.app-settings-pane { display: none; }
.settings-group.app-settings-pane.active { display: block; }

/* ── Dark hardware bezel (live + compose + previews) ────────────── */
.hardware-bezel,
.preview {
  width: 100%;
  background: linear-gradient(180deg, #17191d 0%, #0e1013 100%);
  border-radius: 16px;
  padding: 20px 22px;
  border: 1px solid #262930;
  box-shadow:
    inset 0 2px 10px rgba(0, 0, 0, 0.75),
    0 8px 24px rgba(15, 23, 42, 0.12);
  color: #f3f4f6;
}
.preview { display: block; overflow-x: auto; }
.preview.wide { max-width: 940px; margin: 0 auto; }

/* ── Authentic split-flap tile ──────────────────────────────────── */
.grid {
  display: grid;
  gap: var(--flap-gap, 3px);
  grid-template-columns: repeat(var(--cols, 15), minmax(0, 1fr));
}
.flap {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  min-width: 0;
  max-width: var(--flap-max, 48px);
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #141619;
  border: 1px solid #1d2026;
  border-radius: 6px;
  color: #f8fafc;
  font-family: var(--sf-font-mono);
  font-weight: 700;
  line-height: 1;
  font-size: var(--flap-font, clamp(8px, 2.15vw, 28px));
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.09);
  text-shadow: 0 1px 2px #000;
  overflow: hidden;
  user-select: none;
  transform-style: preserve-3d;
  transform-origin: center center;
}
.flap::before {
  content: "";
  position: absolute;
  inset: 0 0 50% 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%);
  pointer-events: none;
}
.flap::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: #070809;
  transform: translateY(-50%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.07);
  pointer-events: none;
}
.flap.blank { color: transparent; background: #0c0d10; border-color: #171a1f; }
.flap.void {
  color: transparent;
  background: transparent;
  border: 1px dashed #2a2e36;
  box-shadow: none;
  opacity: 0.35;
}
.flap.void::before, .flap.void::after { display: none; }
.flap.color-r { background: #b71c1c; border-color: #e53935; }
.flap.color-o { background: #e65100; border-color: #fb8c00; }
.flap.color-y { background: #f9a825; border-color: #fdd835; color: #1a1a1a; text-shadow: none; }
.flap.color-g { background: #2e7d32; border-color: #43a047; }
.flap.color-b { background: #1565c0; border-color: #1e88e5; }
.flap.color-p { background: #6a1b9a; border-color: #8e24aa; }
.flap.color-w { background: #eceff1; border-color: #fff; color: #111; text-shadow: none; }
.flap.color-c { background: #00bcd4; border-color: #26c6da; color: #111; text-shadow: none; }
.flap.color-m { background: #e91e63; border-color: #ec407a; }
.flap.flip { animation: flapFlip var(--sf-flip-duration, .2s) ease-out; }
@keyframes flapFlip {
  from { transform: rotateX(var(--sf-flip-angle, -82deg)); opacity: .35; }
  to { transform: rotateX(0); opacity: 1; }
}

/* ── Dark compose deck ──────────────────────────────────────────── */
.compose-deck { display: flex; flex-direction: column; gap: 16px; }
.compose-input {
  width: 100%;
  min-height: 86px;
  border-radius: 12px;
  border: 1px solid #2b2f38;
  background: #090a0d;
  padding: 13px 15px;
  font-family: var(--sf-font-mono);
  font-size: 14px;
  line-height: 1.5;
  color: #f8fafc;
  caret-color: var(--sf-accent);
  resize: vertical;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.65);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.compose-input::placeholder { color: #525866; }
.compose-input:focus {
  outline: none;
  border-color: var(--sf-accent);
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.65),
    0 0 0 3px rgba(0, 149, 200, 0.22);
}

/* Dark tactile colour swatch tray */
.palette {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 7px;
  background: #0a0b0e;
  padding: 6px 8px;
  border-radius: 11px;
  border: 1px solid #242830;
  align-self: flex-start;
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.6);
  margin: 0;
}
.palette button {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  padding: 0;
  display: inline-block;
  appearance: none;
  -webkit-appearance: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 2px 4px rgba(0, 0, 0, 0.5);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.palette button:hover {
  transform: translateY(-2px) scale(1.07);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 4px 10px rgba(0, 0, 0, 0.7);
}
.palette button:active { transform: translateY(0) scale(0.96); }
.palette .palette-r { background: #b71c1c; }
.palette .palette-o { background: #e65100; }
.palette .palette-y { background: #f9a825; }
.palette .palette-g { background: #2e7d32; }
.palette .palette-b { background: #1565c0; }
.palette .palette-p { background: #6a1b9a; }
.palette .palette-w { background: #eceff1; }
.palette .palette-k { background: #1a1a1a; }
.palette .palette-c { background: #00bcd4; }
.palette .palette-m { background: #e91e63; }

/* Dark parameter grid */
.compose-deck .options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 0;
}
.compose-deck label.field { gap: 6px; font-size: inherit; opacity: 1; }
.compose-deck label.field > span {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8b93a1;
}
.compose-deck input,
.compose-deck select {
  height: 38px;
  border-radius: 10px;
  border: 1px solid #2b2f38;
  background: #0b0c0f;
  padding: 0 12px;
  font-family: var(--sf-font-mono);
  font-size: 13px;
  color: #f3f4f6;
  box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.55);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.compose-deck input:focus,
.compose-deck select:focus {
  outline: none;
  border-color: var(--sf-accent);
  box-shadow:
    inset 0 1px 4px rgba(0, 0, 0, 0.55),
    0 0 0 3px rgba(0, 149, 200, 0.22);
}

/* Mini compose preview */
.mini-preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 12px 0 4px;
  border-top: 1px dashed #262a33;
}
.mini-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #6b7280;
}
.mini-bezel {
  display: block;
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
  background: #08090b;
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid #22262e;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.85);
}
.mini-bezel .grid { margin: 0 auto; }

/* ── Buttons ────────────────────────────────────────────────────── */
.btn {
  height: 39px;
  padding: 0 17px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-family: var(--sf-font-sans);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--sf-accent);
  color: #ffffff;
  box-shadow: 0 3px 12px rgba(0, 149, 200, 0.35);
  transition: all 0.15s ease;
}
.btn:hover { background: var(--sf-accent-hover); filter: none; }
.btn:active { transform: scale(0.98); }
.btn:disabled { opacity: 0.45; cursor: default; box-shadow: none; }
.btn.secondary {
  background: var(--sf-bg-card);
  color: var(--sf-text-2);
  border: 1px solid var(--sf-border-strong);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.btn.secondary:hover { background: #f9fafb; color: var(--sf-text); }
.btn.danger { background: #dc2626; color: #fff; border-color: transparent; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.28); }
.btn.danger:hover { background: #b91c1c; }
.btn.mini { height: 30px; padding: 0 11px; font-size: 9.5px; border-radius: 8px; }
.compose-deck .actions { margin-top: 0; padding-top: 2px; }
.compose-deck .btn.secondary {
  background: #21252d;
  color: #e5e7eb;
  border-color: #303641;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.compose-deck .btn.secondary:hover { background: #2a2f3a; color: #fff; border-color: #3f4756; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; align-items: center; }

/* ── Form controls ──────────────────────────────────────────────── */
label.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.78rem;
  opacity: 0.95;
}
label.field.hidden { display: none; }
label.field > span {
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--sf-text-2);
}
label.field small { opacity: 0.6; line-height: 1.35; }
input, select, textarea {
  width: 100%;
  border: 1px solid var(--sf-border-strong);
  background: var(--sf-bg-card);
  color: var(--sf-text);
  border-radius: 9px;
  padding: 9px 11px;
  font: inherit;
  font-size: 0.86rem;
}
textarea { resize: vertical; font-family: var(--sf-font-mono); }
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--sf-accent);
  box-shadow: 0 0 0 3px rgba(0, 149, 200, 0.18);
}

/* ── Lists ──────────────────────────────────────────────────────── */
.list { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--sf-bg-subtle);
  border: 1px solid var(--sf-border);
  border-radius: 9px;
  padding: 8px 10px;
  font-size: 0.82rem;
}
.list-item .idx {
  min-width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.07);
  font-size: 0.7rem;
  font-weight: 700;
}
.list-item .text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--sf-font-mono);
}
.empty { opacity: 0.5; font-size: 0.82rem; font-style: italic; padding: 8px 0; }

/* ── Apps launcher ──────────────────────────────────────────────── */
.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.app-card {
  position: relative;
  border: 1px solid var(--sf-border);
  border-radius: 12px;
  padding: 18px 12px 14px;
  text-align: center;
  cursor: pointer;
  background: var(--sf-bg-subtle);
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}
.app-card:hover {
  transform: translateY(-2px);
  border-color: var(--sf-accent);
  box-shadow: 0 6px 16px rgba(0, 149, 200, 0.12);
}
.app-card.disabled { cursor: not-allowed; background: var(--sf-bg-subtle); }
.app-card.disabled .app-card-body { opacity: 0.48; filter: grayscale(0.6); }
.app-card.disabled:hover { transform: none; border-color: var(--sf-border); box-shadow: none; }
.app-card.running { border-color: #10b981; background: rgba(16, 185, 129, 0.08); }
.app-live {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #059669;
}
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  margin: 0 auto;
  color: var(--sf-text);
}
.app-icon svg { width: 100%; height: 100%; display: block; }
.app-icon ha-icon {
  --mdc-icon-size: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.app-icon-emoji { font-size: 1.8rem; line-height: 1; display: inline-block; }
.app-name { margin-top: 8px; font-weight: 700; font-size: 0.84rem; }
.app-desc { margin-top: 4px; font-size: 0.7rem; opacity: 0.6; }
.app-req {
  margin-top: 7px;
  font-size: 0.6rem;
  line-height: 1.3;
  color: #b45309;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.layout-alert {
  margin-top: 8px;
  color: #b91c1c;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.35;
}
.gear {
  position: absolute;
  top: 4px;
  right: 4px;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.45;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px;
}
.gear:hover { opacity: 1; }
.app-card.disabled .gear { opacity: 0.85; pointer-events: auto; cursor: pointer; }

/* ── Module matrix and stats ────────────────────────────────────── */
.mod-matrix {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(var(--cols, 15), minmax(0, 1fr));
}
.mod {
  aspect-ratio: 1;
  min-width: 0;
  max-width: var(--mod-max, 56px);
  justify-self: center;
  border-radius: 7px;
  cursor: pointer;
  border: 1px solid #232730;
  background: #141619;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-family: var(--sf-font-mono);
  padding: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.mod .mid { font-size: var(--mod-id, .55rem); color: #8b93a1; line-height: 1; }
.mod .mchar { font-size: var(--mod-char, .9rem); font-weight: 700; line-height: 1; }
.mod:hover { border-color: #3f4756; }
.mod.selected {
  border-color: var(--sf-accent);
  box-shadow: 0 0 0 2px rgba(0, 149, 200, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.mod.offline { opacity: 0.4; }
.mod.empty { cursor: default; opacity: 0.25; }
.mod.void {
  cursor: default;
  opacity: 0.18;
  background: transparent;
  border-style: dashed;
  box-shadow: none;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
  margin: 12px 0;
}
.stat {
  background: var(--sf-bg-subtle);
  border: 1px solid var(--sf-border);
  border-radius: 9px;
  padding: 9px 6px;
  text-align: center;
}
.stat b { display: block; font-family: var(--sf-font-mono); font-size: 1rem; }
.stat span { display: block; margin-top: 3px; font-size: 0.58rem; letter-spacing: 0.08em; opacity: 0.55; }
.inspector.hidden { display: none; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }

/* ── Character map ──────────────────────────────────────────────── */
.char-map {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 5px;
}
.char {
  border: 1px solid var(--sf-border-strong);
  border-radius: 7px;
  padding: 6px 2px;
  cursor: pointer;
  background: var(--sf-bg-card);
  color: var(--sf-text);
  font-family: var(--sf-font-mono);
  font-weight: 700;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.char:hover { border-color: var(--sf-accent); }
.char small { font-size: 0.52rem; opacity: 0.45; font-weight: 400; }
.char.tuned { border-color: #d4a72c; background: rgba(212, 167, 44, 0.18); }
.char.current { outline: 2px solid var(--sf-accent); outline-offset: 1px; }
.char.color-r { background: #b71c1c; color: #fff; border-color: #e53935; }
.char.color-o { background: #e65100; color: #fff; border-color: #fb8c00; }
.char.color-y { background: #f9a825; color: #1a1a1a; border-color: #fdd835; }
.char.color-g { background: #2e7d32; color: #fff; border-color: #43a047; }
.char.color-b { background: #1565c0; color: #fff; border-color: #1e88e5; }
.char.color-p { background: #6a1b9a; color: #fff; border-color: #8e24aa; }
.char.color-w { background: #eceff1; color: #111; border-color: #fff; }
.char.color-c { background: #00bcd4; color: #111; border-color: #26c6da; }
.char.color-m { background: #e91e63; color: #fff; border-color: #ec407a; }

/* ── Settings ───────────────────────────────────────────────────── */
.settings-groups { display: flex; flex-direction: column; gap: 18px; }
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.settings-group { margin: 0; }
.settings-group:last-child { margin-bottom: 0; }
.settings-group h3 { margin-bottom: 8px; }

/* ── Banners, toasts and modals ─────────────────────────────────── */
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #a7f3d0;
  background: #ecfdf5;
  color: #065f46;
  border-radius: 11px;
  padding: 10px 14px;
}
.banner.hidden { display: none; }
.banner.warn { border-color: #fde68a; background: #fffbeb; color: #92400e; }
.banner.warn .dot { background: #d97706; }
.banner .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #059669;
  box-shadow: 0 0 0 0 rgba(5, 150, 105, 0.6);
  animation: pulse 1.4s infinite;
}
@keyframes pulse { 70% { box-shadow: 0 0 0 8px rgba(5, 150, 105, 0); } }
.banner .stop { margin-left: auto; }

.ota-progress {
  height: 8px;
  margin-top: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--sf-bg-subtle);
  border: 1px solid var(--sf-border);
}
.ota-progress.hidden { display: none; }
.ota-progress > span {
  display: block;
  height: 100%;
  width: 0;
  background: var(--sf-accent);
  transition: width 0.25s ease;
}

.toasts {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
}
.toast {
  padding: 11px 14px;
  border-radius: 9px;
  color: #fff;
  background: #059669;
  font-size: 0.82rem;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
  animation: toastIn 0.18s ease-out;
}
.toast.error { background: #dc2626; }
.toast.warn { background: #d97706; }
.toast.out { opacity: 0; transform: translateY(6px); transition: 0.25s; }
@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } }

.modal {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal.hidden { display: none; }
.modal-card {
  width: 100%;
  max-width: 430px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--sf-bg-card);
  color: var(--sf-text);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
}
.modal-card h3 { margin: 0 0 14px; }
.modal-card .actions { margin-top: 16px; }
.modal-card label.field { margin-bottom: 12px; }

/* ── Tuning helpers ─────────────────────────────────────────────── */
.quick-offsets { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.quick-offsets button {
  padding: 5px 11px;
  border-radius: 6px;
  border: 1px solid var(--sf-border-strong);
  background: var(--sf-bg-card);
  color: var(--sf-text-2);
  font-family: var(--sf-font-mono);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.quick-offsets button:hover {
  background: var(--sf-accent);
  color: #fff;
  border-color: var(--sf-accent);
}
.at-stage { display: flex; flex-direction: column; gap: 12px; }
.at-instructions {
  background: var(--sf-bg-subtle);
  border-left: 4px solid var(--sf-accent);
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.45;
}
.at-grid {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(var(--cols, 15), minmax(0, 1fr));
  margin: 10px 0;
}
.at-cell {
  aspect-ratio: 1;
  border-radius: 5px;
  border: 1px solid var(--sf-border-strong);
  background: var(--sf-bg-card);
  color: var(--sf-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--sf-font-mono);
  font-size: 0.78rem;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}
.at-cell:hover { border-color: var(--sf-accent); }
.at-cell.tuned-indicator { box-shadow: inset 0 0 0 1.5px #d4a72c; }
.at-cell.sel-ahead {
  background: #f44336 !important;
  color: #fff !important;
  border-color: #d32f2f !important;
}
.at-cell.sel-behind {
  background: #4caf50 !important;
  color: #fff !important;
  border-color: #388e3c !important;
}
.at-char-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 68px;
  background: #141619;
  color: #fff;
  border-radius: 6px;
  font-size: 32px;
  font-family: var(--sf-font-mono);
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.at-char-box.color-r { background: #b71c1c; color: #fff; }
.at-char-box.color-o { background: #e65100; color: #fff; }
.at-char-box.color-y { background: #f9a825; color: #1a1a1a; }
.at-char-box.color-g { background: #2e7d32; color: #fff; }
.at-char-box.color-b { background: #1565c0; color: #fff; }
.at-char-box.color-p { background: #6a1b9a; color: #fff; }
.at-char-box.color-w { background: #eceff1; color: #111; }
.nudge-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.nudge-row button {
  padding: 8px 14px;
  font-family: var(--sf-font-mono);
  font-weight: 700;
  font-size: 0.9rem;
  border-radius: 6px;
  border: 1px solid var(--sf-border-strong);
  background: var(--sf-bg-card);
  color: var(--sf-text-2);
  cursor: pointer;
  transition: all 0.15s ease;
}
.nudge-row button:hover {
  background: var(--sf-accent);
  color: #fff;
  border-color: var(--sf-accent);
}

/* ── Footer ─────────────────────────────────────────────────────── */
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 6px 0;
  margin-top: 2px;
  border-top: 1px solid var(--sf-border);
  color: var(--sf-muted);
  font-family: var(--sf-font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.footer-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.version-tag {
  background: #e9ecef;
  color: var(--sf-text-2);
  padding: 2px 6px;
  border-radius: 5px;
  font-weight: 600;
}

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .compose-deck .options { grid-template-columns: 1fr; }
  .tabs { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 560px) {
  .app { padding: 12px 10px 32px; }
  .flap { font-size: var(--flap-font, clamp(7px, 3vw, 18px)); }
  .tab { padding: 9px 6px; font-size: 10px; }
  .subtab { padding: 8px 10px; }
  .card { padding: 13px; }
  .hardware-bezel, .preview { padding: 14px 12px; border-radius: 13px; }
  .topbar { padding: 0; }
}
`;
