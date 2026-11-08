/* Split-Flap Postranní panel OS.
 *
 * A dependency-free custom element.  Komunikuje výhradně s integrací
 * over Home Assistant's WebSocket API:
 *
 *   splitflap_os/subscribe  -> {engine, coordinator}
 *   splitflap_os/<action>   -> command result
 */

const DOMAIN = "splitflap_os";
const VERSION = "0.1.3";

const STYLES = [
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

const PALETTE = [
  ["\u{1F7E5}", "r"],
  ["\u{1F7E7}", "o"],
  ["\u{1F7E8}", "y"],
  ["\u{1F7E9}", "g"],
  ["\u{1F7E6}", "b"],
  ["\u{1F7EA}", "p"],
  ["\u2B1C", "w"],
  ["\u2B1B", "k"],
];

const COLOR_MAP = {
  "\u{1F7E5}": "r",
  "\u{1F7E7}": "o",
  "\u{1F7E8}": "y",
  "\u{1F7E9}": "g",
  "\u{1F7E6}": "b",
  "\u{1F7EA}": "p",
  "\u2B1C": "w",
  "\u2B1B": " ",
};

const DEFAULT_DRUM =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&()-+=;q:%'.,/?*roygbpw";

const STYLE_OPTIONS = STYLES.map(
  (style) => `<option value="${style}">${style}</option>`
).join("");

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function numberText(value) {
  if (value === null || value === undefined || value === "") return "–";
  return String(value);
}

function centerLine(line, cols) {
  const value = String(line || "");
  if (value.length >= cols) return value.slice(0, cols);
  const left = Math.floor((cols - value.length) / 2);
  return " ".repeat(left) + value + " ".repeat(cols - value.length - left);
}

const PANEL_I18N = {
  en: {
    tab_control: "CONTROL",
    tab_apps: "APPS",
    tab_tuning: "TUNING",
    tab_settings: "SETTINGS",
    stop: "STOP",
    clear: "CLEAR",
    save: "SAVE",
    scan_bus: "SCAN BUS",
    sync: "SYNC",
    home_all: "HOME ALL",
    save_settings: "SAVE SETTINGS",
    type_message: "Type a message first",
    display_cleared: "Display cleared",
    settings_saved: "Settings saved",
    backup_downloaded: "Backup downloaded",
    backup_restored: "Backup restored",
    compose_message_first: "Compose a message first",
    enter_drum_index: "Enter a drum index",
    enter_nonzero_steps: "Enter a non-zero step count",
    enter_index_step_pair: "Enter at least one index:step pair",
    enter_valid_home_offset: "Enter a valid home offset",
    enter_index_to_record: "Enter the index to record",
    give_playlist_name: "Give the playlist a name",
    homing_every_module: "Homing every module",
    refreshing_modules: "Refreshing known modules…",
    requested_sync: "Requested EEPROM/state sync",
    scanning_bus: "Scanning the RS485 bus…",
    select_module_first: "Select a module first",
    select_module: "Select a module",
    playlist_empty: "The playlist is empty",
    apply_map_to_eeprom: "APPLY MAP TO EEPROM",
    available_apps: "AVAILABLE APPS",
    cancel: "CANCEL",
    character_map: "CHARACTER MAP",
    clear_map: "CLEAR MAP",
    compose: "COMPOSE",
    connecting: "CONNECTING",
    connection: "CONNECTION",
    delete: "DELETE",
    download_backup_json: "DOWNLOAD BACKUP JSON",
    flap: "FLAP",
    get_position: "GET POSITION",
    goto_drum_index: "GOTO DRUM INDEX",
    goto_index: "GOTO INDEX",
    hardware: "HARDWARE",
    hardware_actions: "HARDWARE ACTIONS",
    home_motor: "HOME MOTOR",
    home_offset: "HOME OFFSET",
    index: "INDEX",
    live_display: "LIVE DISPLAY",
    module: "MODULE",
    offset: "OFFSET",
    physical_layout: "PHYSICAL LAYOUT",
    play_playlist: "PLAY PLAYLIST",
    playlist_builder: "PLAYLIST BUILDER",
    push_to_display: "PUSH TO DISPLAY",
    record: "RECORD",
    record_at_index: "RECORD AT INDEX",
    refresh: "REFRESH",
    refresh_state: "Refresh state",
    remove: "Remove",
    reported: "REPORTED",
    restore_from_json: "RESTORE FROM JSON",
    run: "RUN",
    saved_playlists: "SAVED PLAYLISTS",
    scan: "SCAN",
    send_order: "SEND ORDER",
    set_offset: "SET OFFSET",
    settings: "SETTINGS",
    start_column: "START COLUMN",
    step: "STEP",
    step_steps: "STEP STEPS",
    steps: "steps",
    expected: "expected",
    blank: "(blank)",
    sync: "SYNC",
    total_steps: "TOTAL STEPS",
    color_r: "Red",
    color_o: "Orange",
    color_y: "Yellow",
    color_g: "Green",
    color_b: "Blue",
    color_p: "Purple",
    color_w: "White",
    color_k: "Black",
  },
  cs: {
    tab_control: "OVLÁDÁNÍ",
    tab_apps: "APLIKACE",
    tab_tuning: "LADĚNÍ",
    tab_settings: "NASTAVENÍ",
    stop: "STOP",
    clear: "SMAZAT",
    save: "ULOŽIT",
    scan_bus: "PROHLEDAT SBĚRNICI",
    sync: "SYNCHRONIZOVAT",
    home_all: "DOMŮ VŠE",
    save_settings: "ULOŽIT NASTAVENÍ",
    type_message: "Nejprve napiš zprávu",
    display_cleared: "Displej vymazán",
    settings_saved: "Nastavení uloženo",
    backup_downloaded: "Záloha stažena",
    backup_restored: "Záloha obnovena",
    compose_message_first: "Nejprve slož zprávu",
    enter_drum_index: "Zadej index bubnu",
    enter_nonzero_steps: "Zadej nenulový počet kroků",
    enter_index_step_pair: "Zadej alespoň jeden pár index:krok",
    enter_valid_home_offset: "Zadej platný offset domovské pozice",
    enter_index_to_record: "Zadej index k zaznamenání",
    give_playlist_name: "Pojmenuj playlist",
    homing_every_module: "Najíždění všech modulů",
    refreshing_modules: "Obnovování známých modulů…",
    requested_sync: "Požadována synchronizace EEPROM/stavu",
    scanning_bus: "Prohledávání RS485 sběrnice…",
    select_module_first: "Nejprve vyber modul",
    select_module: "Vyber modul",
    playlist_empty: "Playlist je prázdný",
    apply_map_to_eeprom: "APLIKOVAT MAPU DO EEPROM",
    available_apps: "DOSTUPNÉ APLIKACE",
    cancel: "ZRUŠIT",
    character_map: "MAPA ZNAKŮ",
    clear_map: "VYMAZAT MAPU",
    compose: "SLOŽIT",
    connecting: "PŘIPOJOVÁNÍ",
    connection: "PŘIPOJENÍ",
    delete: "SMAZAT",
    download_backup_json: "STÁHNOUT ZÁLOHU JSON",
    flap: "LÍSTEK",
    get_position: "ZÍSKAT POZICI",
    goto_drum_index: "PŘEJÍT NA INDEX BUBNU",
    goto_index: "PŘEJÍT NA INDEX",
    hardware: "HARDWARE",
    hardware_actions: "AKCE HARDWARU",
    home_motor: "NAJET MOTOR",
    home_offset: "OFFSET DOMOVSKÉ POZICE",
    index: "INDEX",
    live_display: "ŽIVÝ DISPLEJ",
    module: "MODUL",
    offset: "OFFSET",
    physical_layout: "FYZICKÉ ROZLOŽENÍ",
    play_playlist: "PŘEHRÁT PLAYLIST",
    playlist_builder: "TVORBA PLAYLISTU",
    push_to_display: "ODESLAT NA DISPLEJ",
    record: "ZAZNAMENAT",
    record_at_index: "ZAZNAMENAT NA INDEXU",
    refresh: "OBNOVIT",
    refresh_state: "Obnovit stav",
    remove: "Odebrat",
    reported: "HLÁŠENO",
    restore_from_json: "OBNOVIT Z JSON",
    run: "SPUSTIT",
    saved_playlists: "ULOŽENÉ PLAYLISTY",
    scan: "PROHLEDAT",
    send_order: "POŘADÍ ODESÍLÁNÍ",
    set_offset: "NASTAVIT OFFSET",
    settings: "NASTAVENÍ",
    start_column: "POČÁTEČNÍ SLOUPEC",
    step: "KROK",
    step_steps: "KROK KROKY",
    steps: "kroky",
    expected: "očekáváno",
    blank: "(prázdné)",
    sync: "SYNCHRONIZOVAT",
    total_steps: "CELKEM KROKŮ",
    color_r: "Červená",
    color_o: "Oranžová",
    color_y: "Žlutá",
    color_g: "Zelená",
    color_b: "Modrá",
    color_p: "Fialová",
    color_w: "Bílá",
    color_k: "Černá",
  },
};


const APP_ICONS = {
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>`,
  date: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3.5v3M16 3.5v3M3.5 9.5h17"/><path d="M8 13h2M14 13h2M8 16.5h2"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/></svg>`,
  weather: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="3.5"/><path d="M9 2.5v1.5M9 14v1.5M2.5 9H4M14 9h1.5M4.4 4.4l1.1 1.1M12.5 12.5l1.1 1.1M13.6 4.4l-1.1 1.1M5.5 12.5l-1.1 1.1"/><path d="M8.5 19.5h8a3 3 0 0 0 .3-6 4.5 4.5 0 0 0-8.5 1.4A2.8 2.8 0 0 0 8.5 19.5z"/></svg>`,
  stocks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5h16"/><path d="M6.5 16l4-4 3 3 5-6.5"/><path d="M15 8.5h3.5V12"/></svg>`,
  crypto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M10 7.5v9M13.5 7.5v9M8.5 9.5h5.5a2 2 0 0 1 0 4H8.5m0-2h6a2 2 0 0 1 0 4H8.5"/></svg>`,
  sports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c2.5 2.2 4 5.2 4 8.5s-1.5 6.3-4 8.5c-2.5-2.2-4-5.2-4-8.5s1.5-6.3 4-8.5z"/><path d="M3.5 12h17"/></svg>`,
  metro: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="4" width="13" height="13.5" rx="3"/><path d="M5.5 12h13"/><circle cx="9" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14.5" r="1" fill="currentColor" stroke="none"/><path d="M8 17.5L6.5 20M16 17.5l1.5 2.5"/></svg>`,
  countdown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10M7 20h10"/><path d="M8 4v4a4 4 0 0 0 4 4 4 4 0 0 0 4-4V4M8 20v-4a4 4 0 0 1 4-4 4 4 0 0 1 4 4v4"/></svg>`,
  world_clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.2 4 5.2 4 8.5s-1.5 6.3-4 8.5c-2.5-2.2-4-5.2-4-8.5s1.5-6.3 4-8.5z"/></svg>`,
  iss: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M3 8v8M6 7v10M18 7v10M21 8v8"/><path d="M3 10h3M3 14h3M18 10h3M18 14h3"/><path d="M9.5 12H6M14.5 12H18"/></svg>`,
  animations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 3v3M20.5 4.5h-3M5 17v2M6 18H4"/></svg>`,
};

const APPS_I18N = {
  cs: {
    clock: { name: "Hodiny", description: "Místní čas" },
    date: { name: "Datum", description: "Den, datum a čas" },
    dashboard: { name: "Přehled", description: "Datum a pak počasí" },
    weather: { name: "Počasí", description: "Aktuální stav" },
    stocks: { name: "Akcie", description: "Živé ceny" },
    crypto: { name: "Krypto", description: "Ceny kryptoměn" },
    sports: { name: "Sport", description: "Výsledky NHL" },
    metro: { name: "Metro", description: "Příjezdy MHD" },
    countdown: { name: "Odpočítávání", description: "Časovač do události" },
    world_clock: { name: "Světové hodiny", description: "Více časových pásem" },
    iss: { name: "ISS", description: "Poloha vesmírné stanice" },
    animations: { name: "Animace", description: "Barevné efekty" },
  },
};

const SETTINGS_I18N = {
  groups: {
    display: "🖥️ Displej",
    weather: "🌤️ Počasí",
    markets: "📈 Trhy",
    sports: "🏒 Sport",
    transit: "🚇 Doprava",
    time: "⏳ Čas",
    animations: "🎨 Animace",
  },
  labels: {
    row_counts: "Fyzické rozložení řad (prázdné = auto)",
    rows: "Řádky rámu (0 = auto)",
    cols: "Sloupce rámu (0 = auto)",
    ui_scale: "Měřítko náhledu (%)",
    timezone: "Časové pásmo",
    units: "Jednotky",
    page_delay: "Výchozí prodleva stránky (s)",
    weather_entity: "Entita počasí",
    zip_code: "PSČ (záloha OpenWeather)",
    weather_api_key: "API klíč OpenWeather (záloha)",
    stocks_list: "Symboly akcií",
    crypto_list: "ID coinů CoinGecko",
    sports_teams: "Týmy NHL",
    metro_stop: "ID zastávky MBTA",
    metro_route: "Trasa MBTA",
    mbta_api_key: "API klíč MBTA",
    countdown_event: "Název události",
    countdown_target: "Cílové datum/čas",
    clock_format: "Formát hodin",
    world_clock_zones: "Časová pásma",
    anim_effect: "Efekt",
    anim_style: "Styl odesílání",
    anim_speed: "Prodleva snímku (s)",
  },
  helps: {
    row_counts: "Jedno číslo na fyzickou řadu, shora dolů. ID modulů se přiřazují zleva doprava, pak shora dolů. Kratší řady jsou vycentrované. Prázdné nechá integraci zvolit podle počtu nalezených modulů.",
    rows: "Fyzická výška rámu. Nech 0 pro automatický odhad z displeje.",
    cols: "Fyzická šířka rámu. Nech 0 pro automatický odhad z displeje.",
    ui_scale: "Škáluje náhledy lístků a modulů v panelu. 100 % je výchozí; pro malé displeje použij větší hodnotu.",
    timezone: "IANA název, např. Europe/London. Prázdné použije časové pásmo Home Assistantu.",
    weather_entity: "Preferovaný zdroj. Používá vlastní data počasí Home Assistantu.",
    stocks_list: "Symboly Yahoo Finance oddělené čárkou.",
    crypto_list: "ID coinů CoinGecko oddělené čárkou.",
    sports_teams: "Zkratky oddělené čárkou. Prázdné zobrazí všechny zápasy.",
    countdown_target: "Místní čas v nakonfigurovaném časovém pásmu.",
    world_clock_zones: "Názvy IANA zón oddělené čárkou.",
  },
};

class SplitFlapOSPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._hass = null;
    this._state = null;
    this._unsub = null;
    this._connecting = false;
    this._connected = false;
    this._retryTimer = null;

    this._tab = "control";
    this._composeText = "";
    this._playDelay = 5;
    this._builder = [];
    this._playlistTouched = false;
    this._selectedModule = null;
    this._inspectorModule = null;
    this._settingsBuilt = false;
    this._settingsDirty = false;
    this._charSignature = "";
    this._lastChars = [];
    this._modalApp = null;
    this._shellRendered = false;

    try {
      const saved = window.localStorage.getItem(`${DOMAIN}_tab`);
      if (saved) this._tab = saved;
    } catch (err) {
      /* localÚložiště může být v privátních oknech nedostupné. */
    }
  }

  set hass(hass) {
    const previousLanguage = this._lang();
    this._hass = hass;
    const newLanguage = this._lang();
    if (!this._shellRendered) {
      this._renderShell();
      this._shellRendered = true;
    } else if (previousLanguage !== newLanguage) {
      this._renderShell();
      this._shellRendered = true;
      if (this._state) this._renderAll();
    }
    if (this.isConnected) this._connect();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    if (!this._shellRendered) {
      this._renderShell();
      this._shellRendered = true;
    }
    if (this._hass) this._connect();
  }

  disconnectedCallback() {
    this._disconnect();
  }

  async _connect() {
    if (this._connecting || this._unsub || !this._hass || !this._hass.connection) {
      return;
    }
    this._connecting = true;
    try {
      this._unsub = await this._hass.connection.subscribeMessage(
        (event) => this._setState(event),
        { type: `${DOMAIN}/subscribe` }
      );
      this._connected = true;
      this._renderStatus();
    } catch (err) {
      this._connected = false;
      this._unsub = null;
      this._toast(`Připojení panelu selhalo: ${err.message || err}`, "error");
      this._scheduleReconnect();
    } finally {
      this._connecting = false;
    }
  }

  _scheduleReconnect() {
    if (this._retryTimer) return;
    this._retryTimer = window.setTimeout(() => {
      this._retryTimer = null;
      this._connect();
    }, 5000);
  }

  _disconnect() {
    if (this._retryTimer) {
      window.clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._unsub) {
      try {
        this._unsub();
      } catch (err) {
        /* already closed */
      }
      this._unsub = null;
    }
    this._connected = false;
  }

  _setState(state) {
    if (!state || !state.engine || !state.coordinator) return;
    this._state = state;
    this._connected = true;
    this._renderAll();
  }

  async _send(type, payload = {}) {
    if (!this._hass || !this._hass.connection) {
      throw new Error("Home Asistent není připojen");
    }
    try {
      return await this._hass.connection.sendMessagePromise({
        type: `${DOMAIN}/${type}`,
        ...payload,
      });
    } catch (err) {
      const message =
        (err && (err.message || err.error || err.code)) || String(err);
      this._toast(message, "error");
      throw err;
    }
  }

  async _loadState() {
    try {
      const state = await this._send("get_state");
      this._setState(state);
    } catch (err) {
      /* _send already reported it */
    }
  }

  // ------------------------------------------------------------------
  // Shell
  // ------------------------------------------------------------------
  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
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
        }
        .palette .palette-r { background: #b71c1c; border-color: #e53935; }
        .palette .palette-o { background: #e65100; border-color: #fb8c00; }
        .palette .palette-y { background: #f9a825; border-color: #fdd835; }
        .palette .palette-g { background: #2e7d32; border-color: #43a047; }
        .palette .palette-b { background: #1565c0; border-color: #1e88e5; }
        .palette .palette-p { background: #6a1b9a; border-color: #8e24aa; }
        .palette .palette-w { background: #eceff1; border-color: #b0bec5; }
        .palette .palette-k { background: #1a1a1a; border-color: #555; }
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
        .app-card.running::after {
          content: "LIVE"; position: absolute; top: 6px; left: 8px;
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
        .step-row { display: flex; gap: 5px; flex-wrap: wrap; }
        .step-row .btn { padding: 8px 9px; }
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
          .card { padding: 13px; }
        }
      </style>
      <div class="app">
        <header>
          <div class="brand">
            <div class="mark">▦</div>
            <div>
              <h1>SPLIT-FLAP OS <span style="font-size:.58rem;opacity:.45;font-weight:600;vertical-align:middle">v${VERSION}</span></h1>
              <div class="sub" id="subtitle">${this._lang()==='cs'?'Připojování k Home Assistantu…':'Connecting to Home Assistant…'}</div>
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

        <nav class="tabs">
          <button class="tab active" data-action="tab" data-tab="control">${this._t("tab_control")}</button>
          <button class="tab" data-action="tab" data-tab="apps">${this._t("tab_apps")}</button>
          <button class="tab" data-action="tab" data-tab="tuning">${this._t("tab_tuning")}</button>
          <button class="tab" data-action="tab" data-tab="settings">${this._t("tab_settings")}</button>
        </nav>

        <main>
          <section class="page active" data-page="control">
            <div class="card">
              <h2>${this._t('live_display')}</h2>
              <div class="preview wide" id="live"></div>
              <div class="muted" id="liveMeta" style="margin-top:8px"></div>
            </div>

            <div class="card">
              <h2>${this._t('compose')}</h2>
              <textarea id="compose" class="compose-input" rows="3"
                placeholder="${this._lang()==='cs'?'Napiš zprávu — nové řádky začnou novou řadu':'Type a message — new lines become rows'}"></textarea>
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
                  <select id="styleSelect">${STYLE_OPTIONS}</select>
                </label>
                <label class="field"><span>${this._lang()==='cs'?'RYCHLOST (MS/MODUL)':'SPEED (MS/MODULE)'}</span>
                  <input id="speedInput" type="number" min="0" max="500" step="5" value="15">
                </label>
              </div>
              <div class="preview" id="composePreview"></div>
              <div class="muted" id="composeMeta" style="margin-top:8px"></div>
              <div class="actions">
                <button class="btn" data-action="push-text">${this._t('push_to_display')}</button>
                <button class="btn secondary" data-action="add-playlist">${this._lang()==='cs'?'+ PŘIDAT DO PLAYLISTU':'+ ADD TO PLAYLIST'}</button>
                <button class="btn secondary" data-action="clear-text">${this._t("clear")}</button>
              </div>
            </div>

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('playlist_builder')}</h2>
                <label class="field" style="max-width:120px"><span>${this._lang()==='cs'?'PRODLEVA (S)':'DELAY (S)'}</span>
                  <input id="builderDelay" type="number" min="0.1" max="120" step="0.5" value="5">
                </label>
              </div>
              <div class="list" id="builderList"></div>
              <div class="actions">
                <button class="btn" data-action="play-builder">${this._t('play_playlist')}</button>
                <input id="saveName" type="text" placeholder="${this._lang()==='cs'?'Název playlistu':'Playlist name'}" style="max-width:190px">
                <button class="btn secondary" data-action="save-builder">${this._t("save")}</button>
              </div>
            </div>

            <div class="card">
              <h2>${this._t('saved_playlists')}</h2>
              <div class="list" id="savedList"></div>
            </div>
          </section>

          <section class="page" data-page="apps">
            <div class="card">
              <h2>${this._t('live_display')}</h2>
              <div class="preview wide" id="liveApps"></div>
              <div class="muted" id="liveAppsMeta" style="margin-top:8px"></div>
            </div>
            <div class="card">
              <h2>${this._t('available_apps')}</h2>
              <div class="apps-grid" id="appsGrid"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._lang()==='cs'?'Kliknutím na aplikaci ji spustíte. Použij ozubené kolečko pro úpravu nastavení, která aplikace čte.':'Tap an app to launch it. Use the gear to edit the settings that app reads.'}
              </p>
            </div>
          </section>

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

            <div class="card inspector hidden" id="inspector">
              <div class="row between">
                <h2 style="margin:0" id="inspectTitle">${this._t('module')}</h2>
                <span class="muted" id="inspectState"></span>
              </div>
              <div class="stats">
                <div class="stat"><b id="statFlap">–</b><span>${this._t('flap')}</span></div>
                <div class="stat"><b id="statActual">–</b><span>${this._t('reported')}</span></div>
                <div class="stat"><b id="statStep">–</b><span>${this._t('step')}</span></div>
                <div class="stat"><b id="statIndex">–</b><span>${this._t('index')}</span></div>
                <div class="stat"><b id="statOffset">–</b><span>${this._t('offset')}</span></div>
                <div class="stat"><b id="statTotal">–</b><span>${this._t('total_steps')}</span></div>
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
                <div class="step-row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="-32">-32</button>
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="-1">-1</button>
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="1">+1</button>
                  <button class="btn secondary" data-action="module" data-sub="step" data-step="32">+32</button>
                  <button class="btn secondary" data-action="module" data-sub="step">${this._t('step')}</button>
                </div>
                <label class="field"><span>${this._t('record_at_index')}</span>
                  <input id="recordIndex" type="number" min="0" max="63" placeholder="0-63">
                </label>
                <div class="row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="record">${this._t('record')}</button>
                  <button class="btn danger" data-action="module" data-sub="home">${this._t('home_motor')}</button>
                  <button class="btn secondary" data-action="module" data-sub="clear_map">${this._t('clear_map')}</button>
                </div>
                <label class="field"><span>${this._t('home_offset')}</span>
                  <input id="offsetValue" type="number" min="0" max="65535" placeholder="${escapeAttr(this._t('steps'))}">
                </label>
                <div class="row" style="align-items:flex-end">
                  <button class="btn secondary" data-action="module" data-sub="apply_offset">${this._t('set_offset')}</button>
                </div>
              </div>
              <label class="field" style="margin-top:12px"><span>${this._lang()==='cs'?'MAPA POZIC (index:krok, jeden na řádek)':'POSITION MAP (index:step, one per line)'}</span>
                <textarea id="posMap" rows="3" placeholder="0:2832&#10;1:2896"></textarea>
              </label>
              <div class="actions">
                <button class="btn secondary" data-action="module" data-sub="apply_map">${this._t('apply_map_to_eeprom')}</button>
                <span class="muted">Po aplikaci mapy master najede modulem domů.</span>
              </div>
            </div>

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('character_map')}</h2>
                <span class="muted" id="charMapTitle"></span>
              </div>
              <div class="char-map" id="charMap" style="margin-top:12px"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._lang()==='cs'?'Kliknutím na znak přesuňte vybraný modul tam. Zlaté buňky již mají uložený EEPROM position.':'Click a character to move the selected module there. Gold cells already have a stored position.'}
              </p>
            </div>
          </section>

          <section class="page" data-page="settings">
            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('hardware_actions')}</h2>
                <div class="actions" style="margin:0">
                  <button class="btn mini secondary" data-action="hardware" data-sub="scan">${this._t('scan')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="sync">${this._t('sync')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="update">${this._t('refresh')}</button>
                  <button class="btn mini secondary" data-action="hardware" data-sub="home_all">${this._t("home_all")}</button>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('physical_layout')}</h2>
                <span class="muted" id="layoutSummary"></span>
              </div>
              <div class="preview" id="layoutPreview" style="margin-top:12px"></div>
              <div class="layout-alert" id="layoutError"></div>
              <p class="muted" style="margin-bottom:0">
                ${this._lang()==='cs'?'ID se řadí zleva doprava, pak shora dolů. Prázdné buňky jsou':'Module IDs run left to right, then top to bottom. Blank cells are'}
                dashed; short rows sit in the middle of the frame.
              </p>
            </div>

            <div class="card">
              <div class="row between">
                <h2 style="margin:0">${this._t('settings')}</h2>
                <button class="btn" data-action="save-settings">${this._t("save_settings")}</button>
              </div>
              <div id="settingsGroups" style="margin-top:14px"></div>
            </div>

            <div class="card">
              <h2>${this._lang()==='cs'?'ZÁLOHA A OBNOVA':'BACKUP &amp; RESTORE'}</h2>
              <p class="muted" style="margin-top:0">
                ${this._lang()==='cs'?'Obnovení sloučí nastavení a nahradí playlisty.':'Exports settings, playlists and the last module snapshot.'}
              </p>
              <div class="actions">
                <button class="btn secondary" data-action="download-backup">${this._t('download_backup_json')}</button>
                <button class="btn secondary" data-action="restore-backup">${this._t('restore_from_json')}</button>
                <input id="restoreFile" type="file" accept="application/json,.json" style="display:none">
              </div>
              <div class="muted" id="backupStatus" style="margin-top:8px"></div>
            </div>

            <div class="card">
              <h2>${this._t('connection')}</h2>
              <div class="muted" id="connectionInfo">${this._lang()==='cs'?'Čekání na stav…':'Waiting for state…'}</div>
            </div>
          </section>
        </main>

        <div class="toasts" id="toasts"></div>

        <div class="modal hidden" id="modal">
          <div class="modal-card">
            <h3 id="modalTitle">${this._lang()==='cs'?'Nastavení aplikace':'App settings'}</h3>
            <div id="modalFields"></div>
            <div class="actions">
              <button class="btn" data-action="save-app-settings">${this._t("save")}</button>
              <button class="btn secondary" data-action="close-modal">${this._t('cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.addEventListener("click", (event) => {
      this._onClick(event).catch((err) => console.error(err));
    });
    this.shadowRoot.addEventListener("input", (event) => this._onInput(event));
    this.shadowRoot.addEventListener("change", (event) =>
      this._onChange(event)
    );

    this._applyTab();
  }

  _applyTab() {
    this.shadowRoot.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === this._tab);
    });
    this.shadowRoot.querySelectorAll("[data-page]").forEach((page) => {
      page.classList.toggle("active", page.dataset.page === this._tab);
    });
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

  // ------------------------------------------------------------------
  // State rendering
  // ------------------------------------------------------------------
  _renderAll() {
    if (!this._state) return;
    this._renderStatus();
    this._renderLive();
    this._renderComposePreview();
    this._renderBuilder();
    this._renderSaved();
    this._renderApps();
    this._renderBanner();
    this._renderTuning();
    this._renderLayout();
    this._renderSettings();
    this._renderConnectionInfo();
  }

  _engine() {
    return this._state ? this._state.engine : null;
  }

  _coordinator() {
    return this._state ? this._state.coordinator : null;
  }

  _lang() {
    const lang =
      (this._hass && (this._hass.language || (this._hass.locale && this._hass.locale.language))) ||
      "en";
    return String(lang).toLowerCase().startsWith("cs") ? "cs" : "en";
  }

  _t(key) {
    const dict = PANEL_I18N[this._lang()] || PANEL_I18N.en;
    return dict[key] || PANEL_I18N.en[key] || key;
  }

  _settingLabel(key, fallback) {
    if (this._lang() !== "cs") return fallback || key;
    return (SETTINGS_I18N.labels && SETTINGS_I18N.labels[key]) || fallback || key;
  }

  _settingHelp(key, fallback) {
    if (this._lang() !== "cs") return fallback || "";
    return (SETTINGS_I18N.helps && SETTINGS_I18N.helps[key]) || fallback || "";
  }

  _settingGroup(key, fallback) {
    if (this._lang() !== "cs") return fallback || key;
    return (SETTINGS_I18N.groups && SETTINGS_I18N.groups[key]) || fallback || key;
  }

  _board() {
    const engine = this._engine();
    const board = (engine && engine.board) || {};
    const cols = Math.max(1, Number(board.cols) || 15);
    const rows = Math.max(1, Number(board.rows) || 1);
    let rowCounts = Array.isArray(board.row_counts) ? board.row_counts.map((n) => Number(n) || 0) : [];
    if (rowCounts.length !== rows) rowCounts = Array(rows).fill(cols);
    let rowOffsets = Array.isArray(board.row_offsets)
      ? board.row_offsets.map((n) => Math.max(0, Number(n) || 0))
      : [];
    if (rowOffsets.length !== rows) {
      rowOffsets = rowCounts.map((count) => Math.max(0, Math.floor((cols - count) / 2)));
    }
    return {
      rows,
      cols,
      modules: Number(board.module_count) || 0,
      rowCounts,
      rowOffsets,
      minCols: Number(board.min_cols) || 0,
      layoutModuleCount: Number(board.layout_module_count) || 0,
      error: board.error || "",
    };
  }

  _lines() {
    const engine = this._engine();
    const board = this._board();
    const lines =
      engine && engine.display && Array.isArray(engine.display.lines)
        ? engine.display.lines
        : [];
    const out = [];
    for (let row = 0; row < board.rows; row += 1) {
      out.push(String(lines[row] || "").padEnd(board.cols, " ").slice(0, board.cols));
    }
    return out;
  }

  _renderStatus() {
    const pill = this.shadowRoot.getElementById("statusPill");
    const subtitle = this.shadowRoot.getElementById("subtitle");
    if (!this._state) {
      pill.textContent = this._t('connecting');
      pill.className = "pill connecting";
      subtitle.textContent = this._lang()==='cs'?'Připojování k Home Assistantu…':'Connecting to Home Assistant…';
      return;
    }

    const coordinator = this._coordinator();
    const engine = this._engine();
    const board = this._board();
    const online = Boolean(coordinator.online);
    pill.textContent = online ? (this._lang()==='cs'?"ONLINE":"ONLINE") : (this._lang()==='cs'?"OFFLINE":"OFFLINE");
    pill.className = `pill ${online ? "online" : "offline"}`;

    const prefix = coordinator.prefix || "—";
    const mode =
      engine.active_app ||
      (engine.mode === "playlist" ? "playlist" : engine.mode || "idle");
    subtitle.textContent = `${prefix} • ${board.rows}×${board.cols} • ${board.modules} ${this._lang()==='cs'?'modulů':'modules'} • ${mode}${
      board.error ? (this._lang()==='cs'?" • CHYBA ROZLOŽENÍ":" • LAYOUT ERROR") : ""
    }`;
  }

  _flapHtml(char, flip) {
    const value = char == null ? " " : String(char).slice(0, 1);
    const blank = value === " " || value === "";
    const color = "roygbpw".includes(value) ? ` color-${value}` : "";
    return `<span class="flap${blank ? " blank" : ""}${color}${flip ? " flip" : ""}">${
      blank ? "" : escapeHtml(value)
    }</span>`;
  }

  _uiScale() {
    const engine = this._engine();
    const settings = (engine && engine.settings) || {};
    const raw = Number(settings.ui_scale);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.max(0.5, Math.min(2, raw / 100));
  }

  _previewCell() {
    return Math.round(48 * this._uiScale());
  }

  _moduleCell() {
    return Math.round(56 * this._uiScale());
  }

  _gridMaxWidth(cols, maxCell, gap) {
    const count = Math.max(1, Number(cols) || 1);
    return Math.round(count * maxCell + Math.max(0, count - 1) * gap);
  }

  _fitPreview(node, contentWidth) {
    if (!node) return;
    node.style.maxWidth = `${Math.min(Math.round(contentWidth) + 22, 940)}px`;
    node.style.marginLeft = "auto";
    node.style.marginRight = "auto";
  }

  _previewHtml(lines, animate) {
    const board = this._board();
    const chars = [];
    let html = "";
    let slotBase = 0;
    for (let row = 0; row < board.rows; row += 1) {
      const count = Math.max(0, Math.min(board.cols, Number(board.rowCounts[row]) || 0));
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
        html += this._flapHtml(
          char,
          animate && this._lastChars[index] !== undefined && this._lastChars[index] !== char
        );
        chars[index] = char;
      }
      slotBase += count;
    }
    if (animate) this._lastChars = chars;
    const maxCell = this._previewCell();
    const width = this._gridMaxWidth(board.cols, maxCell, 3);
    const fontSize = Math.max(8, Math.round(maxCell * 0.55));
    return `<div class="grid" style="--cols:${board.cols};--flap-max:${maxCell}px;--flap-font:${fontSize}px;max-width:${width}px;margin:0 auto">${html}</div>`;
  }

  _renderLive() {
    const board = this._board();
    const engine = this._engine();
    const html = this._previewHtml(this._lines(), true);
    const width = this._gridMaxWidth(board.cols, this._previewCell(), 3);
    const meta = `${engine.mode || "idle"}${
      engine.current_page_count
        ? ` • page ${Number(engine.current_page_index || 0) + 1}/${engine.current_page_count}`
        : ""
    } • ${board.rows} ${this._lang()==='cs'?'řádek':'row'}${board.rows===1?'':'s'} × ${board.cols} ${this._lang()==='cs'?'sloupec':'column'}${board.cols===1?'':'s'}${
      board.error ? " • LAYOUT ERROR" : ""
    }`;

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
    const lines = this._composeLines(this._composeText, board.rows, board.cols, start);
    const preview = this.shadowRoot.getElementById("composePreview");
    if (preview) {
      preview.innerHTML = this._previewHtml(lines, false);
      this._fitPreview(preview, this._gridMaxWidth(board.cols, this._previewCell(), 3));
    }
    const meta = this.shadowRoot.getElementById("composeMeta");
    if (meta) {
      meta.textContent = `${this._composeText.length} ${this._lang()==='cs'?'znaků':'characters'} • ${this._lang()==='cs'?'počáteční sloupec':'start column'} ${start}`;
    }
  }

  _renderBuilder() {
    const node = this.shadowRoot.getElementById("builderList");
    if (!node) return;
    if (!this._builder.length) {
      node.innerHTML = this._lang()==='cs'
        ? '<div class="empty">Sem přidejte složené zprávy pro vytvoření playlistu.</div>'
        : '<div class="empty">Add composed messages here to build a playlist.</div>';
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
      node.innerHTML = this._lang()==='cs'
        ? '<div class="empty">Zatím žádné uložené playlisty.</div>'
        : '<div class="empty">No saved playlists yet.</div>';
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
            <span class="muted">${count} ${this._lang()==='cs'?(count===1?'stránka':'stránek'):(count===1?'page':'pages')}</span>
            <button class="btn mini" data-action="run-saved" data-name="${escapeAttr(name)}">${this._t('run')}</button>
            <button class="btn mini danger" data-action="delete-saved" data-name="${escapeAttr(name)}">${this._t('delete')}</button>
          </div>`;
      })
      .join("");
  }

  _appI18n(key) {
    if (this._lang() !== "cs") return null;
    return (APPS_I18N.cs && APPS_I18N.cs[key]) || null;
  }

  _appName(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    const fallback = app ? app.name : key || (this._lang()==='cs' ? "Nečinnost" : "Idle");
    const t = this._appI18n(key);
    return (t && t.name) || fallback;
  }

  _appDescription(app) {
    if (!app) return "";
    const t = this._appI18n(app.key);
    return (t && t.description) || app.description || "";
  }

  _appIcon(key) {
    return APP_ICONS[key] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 10v10"/></svg>`;
  }

  _appRequirement(app, board) {
    if (!app || app.available !== false) return "";
    const needRows = Math.max(1, Number(app.min_rows) || 1);
    const needCols = Math.max(1, Number(app.min_cols) || 1);
    const rows = Number(board && board.rows) || 0;
    const minCols = Number(board && (board.minCols ?? board.min_cols)) || 0;
    const layoutError = board && board.error ? String(board.error) : "";
    if (this._lang() === "cs") {
      if (layoutError && (needRows > 1 || needCols > 1)) return `Nejprve opravte rozložení displeje: ${layoutError}`;
      if (rows < needRows) return `Vyžaduje ${needRows} řádků; toto rozložení má ${rows}`;
      if (minCols < needCols) return `Vyžaduje, aby každý řádek měl alespoň ${needCols} sloupců; nejkratší řádek má ${minCols}`;
      return app.unavailable_reason || "";
    }
    if (layoutError && (needRows > 1 || needCols > 1)) return `Fix the display layout first: ${layoutError}`;
    if (rows < needRows) return `Needs ${needRows} rows; this layout has ${rows}`;
    if (minCols < needCols) return `Needs every row to be at least ${needCols} columns; the narrowest row has ${minCols}`;
    return app.unavailable_reason || "";
  }

  _renderApps() {
    const node = this.shadowRoot.getElementById("appsGrid");
    if (!node) return;
    const engine = this._engine();
    const board = this._board();
    const apps = engine.apps || [];
    if (!apps.length) {
      node.innerHTML = this._lang()==='cs'
        ? '<div class="empty">Žádné registrované aplikace.</div>'
        : '<div class="empty">No apps registered.</div>';
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
            <button class="gear" data-action="app-settings" data-app="${escapeAttr(app.key)}" title="${this._lang()==='cs'?'Nastavení':'Settings'}">⚙</button>
            <div class="app-icon">${this._appIcon(app.key)}</div>
            <div class="app-name">${escapeHtml(this._appName(app.key))}</div>
            <div class="app-desc">${escapeHtml(description)}</div>
            ${available ? "" : `<div class="app-req">${escapeHtml(requirement)}</div>`}
          </div>`;
      })
      .join("");
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
      text.textContent = this._lang()==='cs'
        ? `${this._appName(engine.active_app)} běží`
        : `${this._appName(engine.active_app)} is running`;
    } else if (engine.mode === "playlist") {
      const total = engine.current_page_count || (engine.playlist || []).length || 0;
      const current = total ? Number(engine.current_page_index || 0) + 1 : 0;
      text.textContent = this._lang()==='cs'
        ? `Playlist běží${total ? ` • ${current}/${total}` : ""}`
        : `Playlist running${total ? ` • ${current}/${total}` : ""}`;
    } else {
      text.textContent = String(engine.mode || "idle");
    }
  }

  _moduleFor(moduleId) {
    const coordinator = this._coordinator();
    const modules = (coordinator && coordinator.modules) || [];
    return modules.find((module) => String(module.id) === String(moduleId));
  }

  _renderTuning() {
    if (!this._state) return;
    const coordinator = this._coordinator();
    const board = this._board();
    const modules = coordinator.modules || [];
    const matrix = this.shadowRoot.getElementById("moduleMatrix");
    const meta = this.shadowRoot.getElementById("matrixMeta");

    if (matrix) {
      const rows = Math.max(board.rows, Math.ceil(modules.length / board.cols) || 1);
      let html = "";
      let slotBase = 0;
      for (let row = 0; row < rows; row += 1) {
        const inLayout = row < board.rows;
        const count = inLayout
          ? Math.max(0, Math.min(board.cols, Number(board.rowCounts[row]) || 0))
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
            module.displayed_flap != null ? module.displayed_flap : module.flap || " ";
          const offline = module.online === false;
          html += `
            <button class="mod${selected ? " selected" : ""}${offline ? " offline" : ""}"
                    data-action="select-module" data-id="${escapeAttr(module.id)}"
                    title="${escapeAttr(this._t('module'))} ${escapeAttr(module.id)} • ${escapeAttr(
                      module.state || "unknown"
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
      matrix.innerHTML = html || (this._lang()==='cs'
        ? '<div class="empty">Nebyly nalezeny žádné moduly. Spustit prohledání sběrnice.</div>'
        : '<div class="empty">No modules detected. Run a bus scan.</div>');
    }

    if (meta) {
      meta.textContent = `${modules.length} module${modules.length === 1 ? "" : "s"} • ${
        coordinator.prefix || "—"
      } • ${coordinator.online ? "master online" : "master offline"}`;
    }

    const selected = this._moduleFor(this._selectedModule);
    if (!selected) {
      this._selectedModule = null;
      this._inspectorModule = null;
      const inspector = this.shadowRoot.getElementById("inspector");
      if (inspector) inspector.classList.add("hidden");
      this._renderCharMap(null);
      return;
    }

    const inspector = this.shadowRoot.getElementById("inspector");
    if (inspector) inspector.classList.remove("hidden");

    const title = this.shadowRoot.getElementById("inspectTitle");
    if (title) title.textContent = `MODULE ${selected.id}`;
    const state = this.shadowRoot.getElementById("inspectState");
    if (state) {
      state.textContent = `${String(selected.state || "unknown").toUpperCase()} • ${
        selected.online === false ? "OFFLINE" : "ONLINE"
      }`;
    }

    const values = {
      statFlap: selected.displayed_flap != null ? selected.displayed_flap : selected.flap,
      statActual: selected.actual_flap != null ? selected.actual_flap : selected.flap,
      statStep: selected.current_step,
      statIndex: selected.display_flap_index != null ? selected.display_flap_index : selected.flap_index,
      statOffset: selected.home_offset,
      statTotal: selected.total_steps,
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

    this._renderCharMap(selected);
  }

  _renderLayout() {
    if (!this._state) return;
    const node = this.shadowRoot.getElementById("layoutPreview");
    const summary = this.shadowRoot.getElementById("layoutSummary");
    const errorNode = this.shadowRoot.getElementById("layoutError");
    if (!node) return;

    const board = this._board();
    const coordinator = this._coordinator() || {};
    const modules = coordinator.modules || [];
    let html = "";
    let slotBase = 0;
    for (let row = 0; row < board.rows; row += 1) {
      const count = Math.max(0, Math.min(board.cols, Number(board.rowCounts[row]) || 0));
      const offset = Math.max(0, Number(board.rowOffsets[row]) || 0);
      for (let col = 0; col < board.cols; col += 1) {
        if (col < offset || col >= offset + count) {
          html += this._lang()==='cs'?'<div class="mod void" title="Prázdná buňka rámu"></div>':'<div class="mod void" title="Blank frame cell"></div>';
          continue;
        }
        const slot = slotBase + col - offset;
        const module = modules[slot];
        const label = module ? module.id : slot + 1;
        const flap =
          module && module.displayed_flap != null
            ? module.displayed_flap
            : module && module.flap
              ? module.flap
              : "";
        html += `
          <div class="mod" title="${escapeAttr(this._t('module'))} ${escapeAttr(label)}${module ? "" : ` (${escapeAttr(this._t('expected'))})`}">
            <span class="mid">${escapeHtml(label)}</span>
            <span class="mchar">${flap === " " || flap === "" ? "·" : escapeHtml(flap)}</span>
          </div>`;
      }
      slotBase += count;
    }
    const maxCell = this._moduleCell();
    const width = this._gridMaxWidth(board.cols, maxCell, 4);
    const charFont = Math.max(10, Math.round(maxCell * 0.26));
    const idFont = Math.max(8, Math.round(maxCell * 0.13));
    node.innerHTML = `<div class="mod-matrix" style="--cols:${board.cols};--mod-max:${maxCell}px;--mod-char:${charFont}px;--mod-id:${idFont}px;max-width:${width}px;margin:0 auto">${html}</div>`;
    this._fitPreview(node, width);

    if (summary) {
      const rows = board.rowCounts.join(",");
      summary.textContent = `${board.rows} × ${board.cols} frame • rows ${rows} • ${board.modules} detected`;
    }
    if (errorNode) {
      errorNode.textContent = board.error ? `Layout error: ${board.error}` : "";
      errorNode.style.display = board.error ? "block" : "none";
    }
  }

  _renderCharMap(module) {
    const node = this.shadowRoot.getElementById("charMap");
    const title = this.shadowRoot.getElementById("charMapTitle");
    if (!node) return;
    if (!module) {
      if (title) title.textContent = this._t('select_module');
      node.innerHTML = this._lang()==='cs'?'<div class="empty">Vyber modul výše pro ladění znaků.</div>':'<div class="empty">Select a module above to tune characters.</div>';
      this._charSignature = "";
      return;
    }

    const drum =
      Array.isArray(module.flap_list) && module.flap_list.length
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

    if (title) title.textContent = `Module ${module.id} • ${drum.length} flaps`;
    node.innerHTML = drum
      .map((char, index) => {
        const color = "roygbpw".includes(char) ? ` color-${char}` : "";
        const tuned = positions[String(index)] !== undefined;
        return `<button class="char${color}${tuned ? " tuned" : ""}${
          index === currentIndex ? " current" : ""
        }" data-action="module" data-sub="goto_flap" data-flap="${escapeAttr(
          char
        )}" title="Index ${index}${tuned ? ` • ${positions[String(index)]}` : ""}">
          ${char === " " ? "␣" : escapeHtml(char)}<small>${index}</small>
        </button>`;
      })
      .join("");
  }

  _fieldHtml(field, value) {
    const type = field.type || "text";
    const key = escapeAttr(field.key);
    const current = value == null ? "" : String(value);
    let input = "";

    if (type === "select") {
      const options = Array.isArray(field.options) ? field.options.slice() : [];
      if (current !== "" && !options.includes(current)) options.unshift(current);
      input = `<select data-setting="${key}">${options
        .map(
          (option) =>
            `<option value="${escapeAttr(option)}"${
              String(option) === current ? " selected" : ""
            }>${escapeHtml(option)}</option>`
        )
        .join("")}</select>`;
    } else {
      const inputType =
        type === "number"
          ? "number"
          : type === "password"
            ? "password"
            : type === "datetime-local"
              ? "datetime-local"
              : "text";
      const attrs = [`type="${inputType}"`, `data-setting="${key}"`];
      if (field.placeholder) attrs.push(`placeholder="${escapeAttr(field.placeholder)}"`);
      if (field.min != null) attrs.push(`min="${escapeAttr(field.min)}"`);
      if (field.max != null) attrs.push(`max="${escapeAttr(field.max)}"`);
      if (field.step != null) attrs.push(`step="${escapeAttr(field.step)}"`);
      if (inputType === "password") attrs.push('autocomplete="new-password"');
      input = `<input ${attrs.join(" ")} value="${escapeAttr(current)}">`;
    }

    return `
      <label class="field">
        <span>${escapeHtml(this._settingLabel(field.key, field.label || field.key))}</span>
        ${input}
        ${field.help ? `<small>${escapeHtml(this._settingHelp(field.key, field.help))}</small>` : ""}
      </label>`;
  }

  _renderSettings() {
    const node = this.shadowRoot.getElementById("settingsGroups");
    if (!node) return;
    const engine = this._engine();
    const groups = engine.settings_groups || [];
    const settings = engine.settings || {};

    if (!this._settingsBuilt) {
      node.innerHTML = groups
        .map(
          (group) => `
            <div class="settings-group">
              <h3>${escapeHtml(group.icon || "")} ${escapeHtml(this._settingGroup(group.key, group.name || group.key))}</h3>
              <div class="settings-grid">
                ${(group.fields || [])
                  .map((field) => this._fieldHtml(field, settings[field.key]))
                  .join("")}
              </div>
            </div>`
        )
        .join("");
      this._settingsBuilt = true;
    }

    if (this._settingsDirty) return;
    const active = this.shadowRoot.activeElement;
    node.querySelectorAll("[data-setting]").forEach((input) => {
      if (input === active) return;
      const key = input.dataset.setting;
      const value = settings[key];
      const next = value == null ? "" : String(value);
      if (input.value !== next) input.value = next;
    });
  }

  _renderConnectionInfo() {
    const node = this.shadowRoot.getElementById("connectionInfo");
    if (!node || !this._state) return;
    const coordinator = this._coordinator();
    const engine = this._engine();
    const board = this._board();
    const parts = [
      `MQTT prefix: ${coordinator.prefix || "—"}`,
      `Master: ${coordinator.online ? "online" : "offline"}`,
      `Last status: ${coordinator.last_status || "never"}`,
      `Modules: ${coordinator.modules_count || 0}`,
      `Board: ${board.rows} × ${board.cols}`,
      `Engine: ${engine.mode}${engine.active_app ? ` (${engine.active_app})` : ""}`,
      `Integration: v${this._state.version || VERSION}`,
    ];
    node.textContent = parts.join(" • ");
  }

  // ------------------------------------------------------------------
  // Input handling
  // ------------------------------------------------------------------
  _onInput(event) {
    const target = event.target;
    if (!target) return;

    if (target.id === "compose") {
      this._composeText = target.value;
      this._renderComposePreview();
      return;
    }
    if (target.id === "startCol" || target.id === "styleSelect" || target.id === "speedInput") {
      this._renderComposePreview();
      return;
    }
    if (target.id === "builderDelay") {
      this._playDelay = Number(target.value) || 5;
      return;
    }
    if (target.dataset && target.dataset.setting && target.closest("#settingsGroups")) {
      this._settingsDirty = true;
    }
  }

  async _onChange(event) {
    const target = event.target;
    if (!target) return;
    if (target.id === "restoreFile") {
      await this._restoreFile(target);
    }
  }

  async _onClick(event) {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
      case "tab":
        this._setTab(target.dataset.tab);
        break;
      case "refresh":
        await this._loadState();
        break;
      case "push-text":
        await this._pushText();
        break;
      case "clear-text":
        await this._clearText();
        break;
      case "insert-color":
        this._insertColor(target.dataset.char);
        break;
      case "add-playlist":
        this._addToBuilder();
        break;
      case "remove-builder":
        this._builder.splice(Number(target.dataset.index), 1);
        this._renderBuilder();
        break;
      case "play-builder":
        await this._playBuilder();
        break;
      case "save-builder":
        await this._saveBuilder();
        break;
      case "run-saved":
        await this._runSaved(target.dataset.name);
        break;
      case "delete-saved":
        await this._deleteSaved(target.dataset.name);
        break;
      case "stop":
        await this._send("stop_app");
        break;
      case "start-app": {
        const apps = (this._engine() && this._engine().apps) || [];
        const app = apps.find((item) => item.key === target.dataset.app);
        if (app && app.available === false) {
          const reason = this._appRequirement(app, this._board()) || (this._lang()==='cs' ? "displej je příliš malý" : "display too small");
          this._toast(`${this._appName(target.dataset.app)}: ${reason}`, "warn");
          break;
        }
        await this._send("start_app", { app: target.dataset.app });
        break;
      }
      case "app-settings":
        this._openAppSettings(target.dataset.app);
        break;
      case "save-app-settings":
        await this._saveAppSettings();
        break;
      case "close-modal":
        this._closeModal();
        break;
      case "select-module":
        this._selectedModule = target.dataset.id;
        this._inspectorModule = null;
        this._renderTuning();
        break;
      case "module":
        await this._moduleAction(target.dataset.sub, target.dataset);
        break;
      case "hardware":
        await this._hardwareAction(target.dataset.sub);
        break;
      case "save-settings":
        await this._saveSettings();
        break;
      case "download-backup":
        await this._downloadBackup();
        break;
      case "restore-backup":
        this.shadowRoot.getElementById("restoreFile").click();
        break;
      default:
        break;
    }
  }

  async _pushText() {
    const board = this._board();
    const startNode = this.shadowRoot.getElementById("startCol");
    const styleNode = this.shadowRoot.getElementById("styleSelect");
    const speedNode = this.shadowRoot.getElementById("speedInput");
    const text = this._composeText || "";
    if (!text.trim()) {
      this._toast(this._t("type_message"), "warn");
      return;
    }
    await this._send("send_text", {
      text,
      start: Math.max(1, Number(startNode.value) || 1),
      style: styleNode.value || "ltr",
      speed: Math.max(0, Number(speedNode.value) || 0),
      stop: true,
    });
    this._toast(`Odesláno ${text.length} znaků na tabuli ${board.rows}×${board.cols}`);
  }

  async _clearText() {
    const textarea = this.shadowRoot.getElementById("compose");
    if (textarea) textarea.value = "";
    this._composeText = "";
    this._renderComposePreview();
    await this._send("send_text", { text: "", stop: true });
    this._toast(this._t("display_cleared"));
  }

  _insertColor(char) {
    if (!char) return;
    const textarea = this.shadowRoot.getElementById("compose");
    if (!textarea) return;
    const start = textarea.selectionStart == null ? textarea.value.length : textarea.selectionStart;
    const end = textarea.selectionEnd == null ? start : textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, start) + char + textarea.value.slice(end);
    textarea.selectionStart = textarea.selectionEnd = start + char.length;
    textarea.focus();
    this._composeText = textarea.value;
    this._renderComposePreview();
  }

  _addToBuilder() {
    const text = this._composeText || "";
    if (!text.trim()) {
      this._toast(this._t("compose_message_first"), "warn");
      return;
    }
    this._builder.push({ text });
    this._renderBuilder();
    this._toast(`Přidána stránka ${this._builder.length}`);
  }

  async _playBuilder() {
    if (!this._builder.length) {
      this._toast(this._t("playlist_empty"), "warn");
      return;
    }
    const delayNode = this.shadowRoot.getElementById("builderDelay");
    const delay = Math.max(0.1, Number(delayNode.value) || this._playDelay || 5);
    await this._send("play_playlist", {
      pages: this._builder.map((page) => ({ text: page.text })),
      delay,
      loop: true,
    });
    this._toast(this._lang()==='cs'
      ? `Přehrávání playlistu (${this._builder.length} stránek)`
      : `Playing playlist (${this._builder.length} pages)`);
  }

  async _saveBuilder() {
    if (!this._builder.length) {
      this._toast(this._t("playlist_empty"), "warn");
      return;
    }
    const nameNode = this.shadowRoot.getElementById("saveName");
    const name = String(nameNode.value || "").trim();
    if (!name) {
      this._toast(this._t("give_playlist_name"), "warn");
      return;
    }
    const delayNode = this.shadowRoot.getElementById("builderDelay");
    const delay = Math.max(0.1, Number(delayNode.value) || 5);
    await this._send("save_playlist", {
      name,
      pages: this._builder.map((page) => ({ text: page.text })),
      delay,
    });
    nameNode.value = "";
    this._toast(this._lang()==='cs' ? `Uložen playlist „${name}“` : `Saved playlist "${name}"`);
  }

  async _runSaved(name) {
    if (!name) return;
    await this._send("run_saved_playlist", { name });
    this._toast(this._lang()==='cs' ? `Spuštěno „${name}“` : `Started "${name}"`);
  }

  async _deleteSaved(name) {
    if (!name) return;
    const msg = this._lang()==='cs' ? `Smazat playlist „${name}“?` : `Delete playlist "${name}"?`;
    if (!window.confirm(msg)) return;
    await this._send("delete_playlist", { name });
    this._toast(this._lang()==='cs' ? `Smazáno „${name}“` : `Deleted "${name}"`);
  }

  _openAppSettings(key) {
    const apps = (this._engine() && this._engine().apps) || [];
    const app = apps.find((item) => item.key === key);
    if (!app) return;
    this._modalApp = key;
    const settings = (this._engine() && this._engine().settings) || {};
    const fields = app.fields || [];
    this.shadowRoot.getElementById("modalTitle").textContent = this._lang()==='cs'
      ? `Nastavení: ${this._appName(key)}`
      : `${this._appName(key)} settings`;
    this.shadowRoot.getElementById("modalFields").innerHTML = fields.length
      ? fields.map((field) => this._fieldHtml(field, settings[field.key])).join("")
      : (this._lang()==='cs'?'<p class="muted">Tato aplikace nemá vlastní nastavení. Používá nastavení displeje a dat ze záložky Nastavení.</p>':'<p class="muted">This app has no options of its own. It uses the display and data settings from the Settings tab.</p>');
    this.shadowRoot.getElementById("modal").classList.remove("hidden");
  }

  _closeModal() {
    this._modalApp = null;
    this.shadowRoot.getElementById("modal").classList.add("hidden");
  }

  _collectSettings(root) {
    const values = {};
    if (!root) return values;
    root.querySelectorAll("[data-setting]").forEach((input) => {
      const key = input.dataset.setting;
      if (!key) return;
      let value = input.value;
      if (input.type === "number") {
        value = value === "" ? "" : Number(value);
      }
      values[key] = value;
    });
    return values;
  }

  async _saveSettings() {
    const root = this.shadowRoot.getElementById("settingsGroups");
    const settings = this._collectSettings(root);
    await this._send("set_settings", { settings });
    this._settingsDirty = false;
    this._toast(this._t("settings_saved"));
  }

  async _saveAppSettings() {
    const key = this._modalApp;
    if (!key) {
      this._closeModal();
      return;
    }
    const root = this.shadowRoot.getElementById("modalFields");
    const settings = this._collectSettings(root);
    await this._send("set_settings", { settings });
    this._closeModal();
    this._toast(this._lang()==='cs'
      ? `Nastavení aplikace ${this._appName(key)} uloženo`
      : `${this._appName(key)} settings saved`);
  }

  _moduleValue(id) {
    const node = this.shadowRoot.getElementById(id);
    return node ? node.value : "";
  }

  _parsePositions(text) {
    const positions = {};
    String(text || "")
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const match = part.match(/^(\d+)\s*[:=]\s*(\d+)$/);
        if (!match) return;
        const index = Number(match[1]);
        const position = Number(match[2]);
        if (index >= 0 && index < 64 && position >= 0) {
          positions[String(index)] = position;
        }
      });
    return positions;
  }

  async _moduleAction(sub, data) {
    const module = this._selectedModule;
    if (module === null || !this._moduleFor(module)) {
      this._toast(this._t("select_module_first"), "warn");
      return;
    }

    if (sub === "home") {
      await this._send("calibrate", { module, action: "home" });
      this._toast(this._lang()==='cs'?`Modul ${module} najíždí`:`Module ${module} homing`);
      return;
    }
    if (sub === "get_pos") {
      await this._send("calibrate", { module, action: "get_pos" });
      return;
    }
    if (sub === "goto_index") {
      const index = Number(this._moduleValue("gotoIndex"));
      if (!Number.isFinite(index) || index < 0) {
        this._toast(this._t("enter_drum_index"), "warn");
        return;
      }
      await this._send("calibrate", { module, action: "goto", index });
      return;
    }
    if (sub === "goto_flap") {
      const flap = data.flap;
      if (flap === undefined) return;
      await this._send("calibrate", { module, action: "goto", flap });
      return;
    }
    if (sub === "step") {
      const steps =
        data.step !== undefined
          ? Number(data.step)
          : Number(this._moduleValue("stepAmount"));
      if (!Number.isFinite(steps) || steps === 0) {
        this._toast(this._t("enter_nonzero_steps"), "warn");
        return;
      }
      await this._send("calibrate", { module, action: "step", steps });
      return;
    }
    if (sub === "record") {
      const index = Number(this._moduleValue("recordIndex"));
      if (!Number.isFinite(index) || index < 0) {
        this._toast(this._t("enter_index_to_record"), "warn");
        return;
      }
      if (
        index === 0 &&
        !window.confirm(
          "Recording index 0 also makes the current master firmware send a destructive m<id>w0:0 write. Continue?"
        )
      ) {
        return;
      }
      await this._send("calibrate", { module, action: "record", index });
      this._toast(this._lang()==='cs'?`Zaznamenán modul ${module}, index ${index}`:`Recorded module ${module} index ${index}`);
      return;
    }
    if (sub === "clear_map") {
      await this._send("calibrate", { module, action: "clear_map" });
      this._toast(this._lang()==='cs'?`Vymazána mapa EEPROM pro modul ${module}`:`Cleared the EEPROM map for module ${module}`);
      return;
    }
    if (sub === "apply_offset") {
      const offset = Number(this._moduleValue("offsetValue"));
      if (!Number.isFinite(offset) || offset < 0) {
        this._toast(this._t("enter_valid_home_offset"), "warn");
        return;
      }
      await this._send("calibrate", {
        module,
        action: "apply",
        home_offset: offset,
      });
      this._toast(this._lang()==='cs'?`Aplikován offset ${offset}; modul najíždí`:`Applied offset ${offset}; module is homing`);
      return;
    }
    if (sub === "apply_map") {
      const positions = this._parsePositions(this._moduleValue("posMap"));
      if (!Object.keys(positions).length) {
        this._toast(this._t("enter_index_step_pair"), "warn");
        return;
      }
      await this._send("calibrate", {
        module,
        action: "apply",
        positions,
      });
      this._toast(this._lang()==='cs'?`Aplikováno ${Object.keys(positions).length} záznamů mapy; modul najíždí`:`Applied ${Object.keys(positions).length} map entries; module is homing`);
    }
  }

  async _hardwareAction(sub) {
    if (sub === "scan") {
      await this._send("scan");
      this._toast(this._t("scanning_bus"));
      return;
    }
    if (sub === "sync") {
      await this._send("sync");
      this._toast(this._t("requested_sync"));
      return;
    }
    if (sub === "update") {
      await this._send("update");
      this._toast(this._t("refreshing_modules"));
      return;
    }
    if (sub === "home_all") {
      await this._send("home_all");
      this._toast(this._t("homing_every_module"));
    }
  }

  async _downloadBackup() {
    const data = await this._send("backup");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `splitflap-os-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const status = this.shadowRoot.getElementById("backupStatus");
    if (status) status.textContent = this._lang()==='cs'?`Záloha stažena v ${new Date().toLocaleTimeString()}`:`Backup downloaded at ${new Date().toLocaleTimeString()}`;
    this._toast(this._t("backup_downloaded"));
  }

  async _restoreFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(this._lang()==='cs'?"Záloha musí být: JSON object":"Backup must be a JSON object");
      }
      await this._send("restore", { data });
      const status = this.shadowRoot.getElementById("backupStatus");
      if (status) status.textContent = `Restored ${file.name}`;
      this._toast(this._t("backup_restored"));
      this._settingsDirty = false;
    } catch (err) {
      this._toast(`Restore failed: ${err.message || err}`, "error");
    } finally {
      input.value = "";
    }
  }

  // ------------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------------
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
}

if (!customElements.get("splitflap-os-panel")) {
  customElements.define("splitflap-os-panel", SplitFlapOSPanel);
}
