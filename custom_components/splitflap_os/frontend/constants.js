/** Shared constants, palettes, and icon markup. */

export const DOMAIN = "splitflap_os";
export const VERSION = "1.2.15";

export const STYLES = [
  "ltr",
  "rtl",
  "columns",
  "center_out",
  "outside_in",
  "diagonal",
  "random",
  "rain",
  "spiral",
];

export const PHYSICAL_COLOR_CODES = "roygbpw";
export const COLOR_CODES = "roygbpwcm";

export const PALETTE = [
  ["\u{1F7E5}", "r"],
  ["\u{1F7E7}", "o"],
  ["\u{1F7E8}", "y"],
  ["\u{1F7E9}", "g"],
  ["\u{1F7E6}", "b"],
  ["\u{1F7EA}", "p"],
  ["\u2B1C", "w"],
  ["\u2B1B", "k"],
  ["\u{1FA75}", "c"],
  ["\u{1FA77}", "m"],
];

export const COLOR_MAP = {
  "\u{1F7E5}": "r",
  "\u{1F7E7}": "o",
  "\u{1F7E8}": "y",
  "\u{1F7E9}": "g",
  "\u{1F7E6}": "b",
  "\u{1F7EA}": "p",
  "\u2B1C": "w",
  "\u2B1B": " ",
  "\u{1FA75}": "c",
  "\u{1FA77}": "m",
};

export const DEFAULT_DRUM =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw";



export const APP_ICONS = {
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>`,
  date: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3.5v3M16 3.5v3M3.5 9.5h17"/><path d="M8 13h2M14 13h2M8 16.5h2"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/></svg>`,
  weather: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M9 14v1.5M2.5 9H4M14 9h1.5M4.4 4.4l1.1 1.1M12.5 12.5l1.1 1.1M13.6 4.4l-1.1 1.1M5.5 12.5l-1.1 1.1"/><path d="M8.5 19.5h8a3 3 0 0 0 .3-6 4.5 4.5 0 0 0-8.5 1.4A2.8 2.8 0 0 0 8.5 19.5z"/></svg>`,
  stocks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5h16"/><path d="M6.5 16l4-4 3 3 5-6.5"/><path d="M15 8.5h3.5V12"/></svg>`,
  countdown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10M7 20h10"/><path d="M8 4v4a4 4 0 0 0 4 4 4 4 0 0 0 4-4V4M8 20v-4a4 4 0 0 1 4-4 4 4 0 0 1 4 4v4"/></svg>`,
  animations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 3v3M20.5 4.5h-3M5 17v2M6 18H4"/></svg>`,
};


export const PANEL_ELEMENT = "splitflap-os-panel";
