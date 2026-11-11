/** Panel CSS, kept separate from the component logic. */

export const PANEL_STYLES = `
:host {
  display: block;
  min-height: 100%;
  background: var(--primary-background-color, #f4f4f4);
  color: var(--primary-text-color, #1d1d1d);
  font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
}
* { box-sizing: border-box; }
.app {
  max-width: 1120px;
  margin: 0 auto;
  padding: 16px 16px 64px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.brand { display: flex; align-items: center; gap: 12px; }
.mark {
  width: 46px; height: 46px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem;
  background: var(--primary-color, #03a9f4);
  color: var(--text-primary-color, #fff);
  box-shadow: 0 6px 18px rgba(0,0,0,.18);
}
h1 { margin: 0; font-size: 1.1rem; letter-spacing: .16em; }
.sub { margin-top: 3px; font-size: .78rem; opacity: .65; }
.conn { display: flex; align-items: center; gap: 8px; }
.pill {
  font-size: .7rem; font-weight: 700; letter-spacing: .12em;
  border-radius: 999px; padding: 6px 11px;
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(0,0,0,.25);
}
.pill.online { color: #7ee787; background: rgba(46,160,67,.18); }
.pill.offline { color: #ff9b9b; background: rgba(248,81,73,.18); }
.pill.connecting { color: #e3b341; background: rgba(187,128,9,.18); }
.tabs {
  display: flex; gap: 6px; overflow-x: auto;
  background: var(--card-background-color, #fff);
  border: 1px solid var(--divider-color, #ddd);
  border-radius: 12px; padding: 5px; margin-bottom: 16px;
  position: sticky; top: 0; z-index: 20;
}
.tab {
  flex: 1 0 auto; border: 0; border-radius: 8px; padding: 11px 16px;
  background: transparent; color: inherit; cursor: pointer;
  font-weight: 700; font-size: .78rem; letter-spacing: .1em;
  white-space: nowrap;
}
.tab.active {
  background: var(--primary-color, #03a9f4);
  color: var(--text-primary-color, #fff);
}
.page { display: none; }
.page.active { display: block; animation: pageIn .18s ease-out; }
.subtabs {
  display: flex; gap: 4px; overflow-x: auto;
  border: 1px solid var(--divider-color, #ddd);
  border-radius: 10px; padding: 4px; margin-bottom: 14px;
}
.subtab {
  flex: 1 0 auto; border: 0; border-radius: 7px; padding: 8px 14px;
  background: transparent; color: var(--secondary-text-color, #888);
  cursor: pointer; font-weight: 700; font-size: .72rem;
  letter-spacing: .1em; white-space: nowrap;
}
.subtab.active {
  background: var(--primary-color, #03a9f4);
  color: var(--text-primary-color, #fff);
}
.subpage { display: none; }
.subpage.active { display: block; animation: pageIn .18s ease-out; }
@keyframes pageIn { from { opacity: 0; transform: translateY(4px); } }
.card {
  background: var(--card-background-color, #fff);
  border: 1px solid var(--divider-color, #ddd);
  border-radius: 14px; padding: 16px; margin-bottom: 16px;
  box-shadow: 0 8px 28px rgba(0,0,0,.06);
}
.card h2, .card h3 { margin: 0 0 12px; font-size: .84rem; letter-spacing: .12em; opacity: .85; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.between { justify-content: space-between; }
.muted { opacity: .6; font-size: .8rem; }
.ota-progress {
  height: 8px; margin-top: 10px; border-radius: 999px; overflow: hidden;
  background: var(--divider-color, #ddd);
}
.ota-progress > span {
  display: block; height: 100%; width: 0;
  background: var(--primary-color, #03a9f4);
  transition: width .25s ease;
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.preview {
  background: #080808; border: 1px solid #2c2c2c;
  border-radius: 10px; padding: 10px;
  overflow-x: auto;
}
.preview.wide { max-width: 940px; margin: 0 auto; }
.grid { display: grid; gap: 3px; grid-template-columns: repeat(var(--cols, 15), minmax(0, 1fr)); }
.flap {
  position: relative; aspect-ratio: 2 / 3; min-width: 0;
  max-width: var(--flap-max, 48px); justify-self: center;
  display: flex; align-items: center; justify-content: center;
  background: #101010; border: 1px solid #292929; border-radius: 3px;
  color: #f5f5f5; font-family: "Roboto Mono", "Courier New", monospace;
  font-weight: 700; line-height: 1;
  font-size: var(--flap-font, clamp(8px, 2.15vw, 28px));
  text-shadow: 0 1px 2px #000; overflow: hidden;
}
.flap::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  height: 1px; background: rgba(0,0,0,.78); pointer-events: none;
}
.flap.blank { color: transparent; background: #0c0c0c; border-color: #1d1d1d; }
.flap.void {
  color: transparent; background: transparent;
  border: 1px dashed #202020; opacity: .35;
}
.flap.color-r { background: #b71c1c; border-color: #e53935; }
.flap.color-o { background: #e65100; border-color: #fb8c00; }
.flap.color-y { background: #f9a825; border-color: #fdd835; color: #1a1a1a; text-shadow: none; }
.flap.color-g { background: #2e7d32; border-color: #43a047; }
.flap.color-b { background: #1565c0; border-color: #1e88e5; }
.flap.color-p { background: #6a1b9a; border-color: #8e24aa; }
.flap.color-w { background: #eceff1; border-color: #fff; color: #111; text-shadow: none; }
.flap.color-c { background: #00bcd4; border-color: #26c6da; color: #111; text-shadow: none; }
.flap.color-m { background: #e91e63; border-color: #ec407a; }
.flap.flip { animation: flapFlip .2s ease-out; }
@keyframes flapFlip {
  from { transform: rotateX(-82deg); opacity: .35; }
  to { transform: rotateX(0); opacity: 1; }
}
.banner {
  display: flex; align-items: center; gap: 10px;
  border: 1px solid rgba(46,160,67,.5);
  background: rgba(46,160,67,.12);
  border-radius: 10px; padding: 10px 14px; margin-bottom: 14px;
}
.banner.hidden { display: none; }
.banner.warn {
  border-color: rgba(227,179,65,.5);
  background: rgba(187,128,9,.12);
}
.banner.warn .dot { background: #e3b341; }
.banner .dot {
  width: 9px; height: 9px; border-radius: 50%; background: #2ea043;
  box-shadow: 0 0 0 0 rgba(46,160,67,.6); animation: pulse 1.4s infinite;
}
@keyframes pulse { 70% { box-shadow: 0 0 0 8px rgba(46,160,67,0); } }
.banner .stop { margin-left: auto; }
.btn {
  border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer;
  font-weight: 700; font-size: .78rem; letter-spacing: .06em;
  background: var(--primary-color, #03a9f4);
  color: var(--text-primary-color, #fff);
}
.btn:hover { filter: brightness(1.08); }
.btn:disabled { opacity: .45; cursor: default; }
.btn.secondary {
  background: var(--secondary-background-color, #e9e9e9);
  color: var(--primary-text-color, #1d1d1d);
  border: 1px solid var(--divider-color, #ddd);
}
.btn.danger { background: #c62828; color: #fff; }
.btn.mini { padding: 6px 10px; font-size: .68rem; }
.icon-btn {
  border: 1px solid var(--divider-color, #ddd);
  background: var(--card-background-color, #fff); color: inherit;
  width: 36px; height: 36px; border-radius: 9px; cursor: pointer;
  font-size: 1rem;
}
label.field { display: flex; flex-direction: column; gap: 5px; font-size: .78rem; opacity: .9; }
label.field > span { font-weight: 700; letter-spacing: .04em; }
label.field small { opacity: .6; line-height: 1.35; }
input, select, textarea {
  width: 100%; border: 1px solid var(--divider-color, #ccc);
  background: var(--card-background-color, #fff);
  color: inherit; border-radius: 8px; padding: 9px 10px;
  font: inherit; font-size: .86rem;
}
textarea { resize: vertical; font-family: "Roboto Mono", "Courier New", monospace; }
input:focus, select:focus, textarea:focus {
  outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px;
}
.compose-input {
  font-family: "Roboto Mono", "Courier New", monospace;
  font-size: 1.05rem; letter-spacing: .06em;
}
.palette { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.palette button {
  width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
  border: 2px solid var(--divider-color, #ccc);
  padding: 0; display: inline-block;
  appearance: none; -webkit-appearance: none;
  box-sizing: border-box;
}
.palette .palette-r { background: #b71c1c; border-color: #e53935; }
.palette .palette-o { background: #e65100; border-color: #fb8c00; }
.palette .palette-y { background: #f9a825; border-color: #fdd835; }
.palette .palette-g { background: #2e7d32; border-color: #43a047; }
.palette .palette-b { background: #1565c0; border-color: #1e88e5; }
.palette .palette-p { background: #6a1b9a; border-color: #8e24aa; }
.palette .palette-w { background: #eceff1; border-color: #b0bec5; }
.palette .palette-k { background: #1a1a1a; border-color: #555; }
.palette .palette-c { background: #00bcd4; border-color: #26c6da; }
.palette .palette-m { background: #e91e63; border-color: #ec407a; }
.options {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px; margin: 12px 0;
}
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.list { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; }
.list-item {
  display: flex; align-items: center; gap: 10px;
  background: var(--secondary-background-color, #f1f1f1);
  border-radius: 8px; padding: 8px 10px;
  font-size: .82rem;
}
.list-item .idx {
  min-width: 22px; height: 22px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.12); font-size: .7rem; font-weight: 700;
}
.list-item .text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: "Roboto Mono", monospace; }
.empty { opacity: .5; font-size: .82rem; font-style: italic; padding: 8px 0; }
.apps-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.app-card {
  position: relative; border: 1px solid var(--divider-color, #ddd);
  border-radius: 12px; padding: 18px 12px 14px; text-align: center;
  cursor: pointer; background: var(--secondary-background-color, #f7f7f7);
  transition: transform .12s ease, border-color .12s ease;
}
.app-card:hover { transform: translateY(-2px); border-color: var(--primary-color, #03a9f4); }
.app-card.disabled {
  opacity: .48; cursor: not-allowed; filter: grayscale(.6);
  background: var(--secondary-background-color, #f1f1f1);
}
.app-card.disabled:hover { transform: none; border-color: var(--divider-color, #ddd); }
.app-card.running { border-color: #2ea043; background: rgba(46,160,67,.1); }
.app-live {
  position: absolute; top: 6px; left: 8px;
  font-size: .58rem; font-weight: 700; letter-spacing: .08em; color: #2ea043;
}
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  margin: 0 auto;
  color: var(--primary-text-color, currentColor);
}
.app-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.app-name { margin-top: 8px; font-weight: 700; font-size: .84rem; }
.app-desc { margin-top: 4px; font-size: .7rem; opacity: .6; }
.app-req {
  margin-top: 7px; font-size: .6rem; line-height: 1.3;
  color: #b26a00; font-weight: 700; letter-spacing: .02em;
}
.layout-alert {
  margin-top: 8px; color: #b71c1c; font-size: .76rem;
  font-weight: 700; line-height: 1.35;
}
.gear {
  position: absolute; top: 4px; right: 4px; border: 0; background: transparent;
  color: inherit; opacity: .45; cursor: pointer; font-size: 1rem; padding: 4px;
}
.gear:hover { opacity: 1; }
.mod-matrix {
  display: grid; gap: 4px;
  grid-template-columns: repeat(var(--cols, 15), minmax(0, 1fr));
}
.mod {
  aspect-ratio: 1; min-width: 0; border-radius: 5px; cursor: pointer;
  max-width: var(--mod-max, 56px); justify-self: center;
  border: 1px solid var(--divider-color, #ccc);
  background: var(--secondary-background-color, #f2f2f2);
  color: inherit; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px;
  font-family: "Roboto Mono", monospace; padding: 2px;
}
.mod .mid { font-size: var(--mod-id, .55rem); opacity: .5; line-height: 1; }
.mod .mchar { font-size: var(--mod-char, .9rem); font-weight: 700; line-height: 1; }
.mod.selected { border-color: var(--primary-color, #03a9f4); box-shadow: inset 0 0 0 1px var(--primary-color, #03a9f4); }
.mod.offline { opacity: .45; }
.mod.empty { cursor: default; opacity: .3; }
.mod.void {
  cursor: default; opacity: .18; background: transparent;
  border-style: dashed;
}
.stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px; margin: 12px 0;
}
.stat {
  background: var(--secondary-background-color, #f2f2f2);
  border-radius: 8px; padding: 9px 6px; text-align: center;
}
.stat b { display: block; font-family: "Roboto Mono", monospace; font-size: 1rem; }
.stat span { display: block; margin-top: 3px; font-size: .58rem; letter-spacing: .08em; opacity: .55; }
.inspector.hidden { display: none; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.char-map {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 5px;
}
.char {
  border: 1px solid var(--divider-color, #ccc);
  border-radius: 6px; padding: 6px 2px; cursor: pointer;
  background: var(--secondary-background-color, #f7f7f7); color: inherit;
  font-family: "Roboto Mono", monospace; font-weight: 700; font-size: .9rem;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.char small { font-size: .52rem; opacity: .45; font-weight: 400; }
.char.tuned { border-color: #d4a72c; background: rgba(212,167,44,.18); }
.char.current { outline: 2px solid var(--primary-color, #03a9f4); }
.char.color-r { background: #b71c1c; color: #fff; border-color: #e53935; }
.char.color-o { background: #e65100; color: #fff; border-color: #fb8c00; }
.char.color-y { background: #f9a825; color: #1a1a1a; border-color: #fdd835; }
.char.color-g { background: #2e7d32; color: #fff; border-color: #43a047; }
.char.color-b { background: #1565c0; color: #fff; border-color: #1e88e5; }
.char.color-p { background: #6a1b9a; color: #fff; border-color: #8e24aa; }
.char.color-w { background: #eceff1; color: #111; border-color: #fff; }
.char.color-c { background: #00bcd4; color: #111; border-color: #26c6da; }
.char.color-m { background: #e91e63; color: #fff; border-color: #ec407a; }
.settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.settings-group { margin-bottom: 18px; }
.settings-group:last-child { margin-bottom: 0; }
.settings-group h3 { margin-bottom: 8px; }
.toasts {
  position: fixed; right: 18px; bottom: 18px; z-index: 1000;
  display: flex; flex-direction: column; gap: 8px; max-width: 320px;
}
.toast {
  padding: 11px 14px; border-radius: 8px; color: #fff;
  background: #2e7d32; font-size: .82rem;
  box-shadow: 0 8px 22px rgba(0,0,0,.28);
  animation: toastIn .18s ease-out;
}
.toast.error { background: #b71c1c; }
.toast.warn { background: #b26a00; }
.toast.out { opacity: 0; transform: translateY(6px); transition: .25s; }
@keyframes toastIn { from { opacity: 0; transform: translateY(8px); } }
.modal {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(0,0,0,.55); display: flex;
  align-items: center; justify-content: center; padding: 16px;
}
.modal.hidden { display: none; }
.modal-card {
  width: 100%; max-width: 430px; max-height: 88vh; overflow-y: auto;
  background: var(--card-background-color, #fff);
  color: var(--primary-text-color, #1d1d1d);
  border-radius: 14px; padding: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
}
.modal-card h3 { margin: 0 0 14px; }
.modal-card .actions { margin-top: 16px; }
.modal-card label.field { margin-bottom: 12px; }
@media (max-width: 560px) {
  .app { padding: 12px 10px 48px; }
  .flap { font-size: var(--flap-font, clamp(7px, 3vw, 18px)); }
  .tab { padding: 10px 11px; }
  .subtab { padding: 9px 10px; }
  .card { padding: 13px; }
}
`;
