/** Normalize one websocket snapshot before any panel view sees it.
 *
 * Pure and dependency-free on purpose: no Home Assistant, DOM, translation or
 * i18n imports. Compat aliases, board geometry, display lines and module view
 * fields are resolved here, once. Layout errors become codes plus numeric
 * parameters; the panel keeps the language-aware wording.
 */

const firstNonNull = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return null;
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeFlapList = (value) => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") return Array.from(value);
  if (typeof value === "object") {
    return Object.keys(value)
      .sort((left, right) => Number(left) - Number(right))
      .map((key) => String(value[key]));
  }
  return [String(value)];
};

const LAYOUT_ERROR_RULES = [
  {
    pattern: /Row layout must contain whole numbers, not ([^\n]+)/,
    code: "layout_err_whole_numbers",
    params: (match) => ({ value: match[1] }),
  },
  {
    pattern: /Row layout counts must be greater than zero/,
    code: "layout_err_positive",
    params: () => ({}),
  },
  {
    pattern: /Row layout has (\d+) row\(s\) but the frame is (\d+) row\(s\)/,
    code: "layout_err_row_mismatch",
    params: (match) => ({ count: Number(match[1]), frame: Number(match[2]) }),
  },
  {
    pattern: /Row layout needs at least (\d+) columns but the frame has (\d+)/,
    code: "layout_err_columns",
    params: (match) => ({ needed: Number(match[1]), frame: Number(match[2]) }),
  },
  {
    pattern: /Row layout describes (\d+) module\(s\) but (\d+) were detected/,
    code: "layout_err_describes",
    params: (match) => ({ layout: Number(match[1]), detected: Number(match[2]) }),
  },
  {
    pattern: /Row layout does not fit inside the frame/,
    code: "layout_err_no_fit",
    params: () => ({}),
  },
  {
    pattern:
      /Layout leaves (\d+) blank cell\(s\); at most one row \((\d+)\) is allowed(?:\. Set a row layout such as 3,3,1\.)?/,
    code: "layout_err_blank",
    params: (match) => ({ blank: Number(match[1]), row: Number(match[2]) }),
  },
  {
    pattern: /The (\d+)×(\d+) frame only fits (\d+) of (\d+) detected module\(s\)/,
    code: "layout_err_capacity",
    params: (match) => ({
      rows: Number(match[1]),
      cols: Number(match[2]),
      capacity: Number(match[3]),
      detected: Number(match[4]),
    }),
  },
];

/** Turn backend layout wording into one stable code + parameters shape. */
export const normalizeLayoutError = (error) => {
  if (error && typeof error === "object" && error.code) {
    return { code: error.code, params: { ...(error.params || {}) } };
  }
  const text = String(error || "");
  if (!text) return null;
  // Stable backend error codes from the firmware release commands are already
  // translation keys; do not treat them as raw layout wording.
  if (text.startsWith("firmware_release_")) {
    return { code: text, params: {} };
  }
  for (const rule of LAYOUT_ERROR_RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      return { code: rule.code, params: rule.params(match) };
    }
  }
  return { code: "raw", params: { text }, text };
};

const hardwareGrid = (board, modules) => {
  const count = Array.isArray(modules) ? modules.length : 0;
  const frameCols = Math.max(1, Number(board.cols) || 1);
  // A debug frame can be much wider than the scanned board. Hardware views
  // pack the detected modules into a compact grid so they stay clickable.
  const cols = board.debugModuleLimit
    ? Math.max(1, Math.min(frameCols, count || 1))
    : frameCols;
  const rows = board.debugModuleLimit
    ? Math.max(1, Math.ceil(count / cols))
    : Math.max(Math.max(1, Number(board.rows) || 1), Math.ceil(count / cols) || 1);

  const counts = [];
  let remaining = count;
  for (let row = 0; row < rows; row += 1) {
    const configured = Number(board.rowCounts[row]) || 0;
    const rowCount = board.debugModuleLimit
      ? Math.min(cols, Math.max(0, remaining))
      : row < board.rows
        ? Math.max(0, Math.min(cols, configured))
        : Math.min(cols, Math.max(0, remaining));
    counts.push(rowCount);
    remaining -= rowCount;
  }
  return {
    cols,
    rows,
    counts,
    offsets: counts.map((value) => Math.max(0, Math.floor((cols - value) / 2))),
  };
};

/** One geometry shape for preview, compose, tuning and app support checks. */
export const normalizeBoard = (raw, modules) => {
  const board = raw && typeof raw === "object" ? raw : {};
  const cols = Math.max(1, Number(board.cols) || 15);
  const rows = Math.max(1, Number(board.rows) || 1);

  let rowCounts = Array.isArray(board.row_counts)
    ? board.row_counts.map((value) => Math.max(0, Number(value) || 0))
    : [];
  if (rowCounts.length !== rows) rowCounts = Array(rows).fill(cols);

  let rowOffsets = Array.isArray(board.row_offsets)
    ? board.row_offsets.map((value) => Math.max(0, Number(value) || 0))
    : [];
  if (rowOffsets.length !== rows) {
    rowOffsets = rowCounts.map((value) =>
      Math.max(0, Math.floor((cols - value) / 2))
    );
  }

  const error = typeof board.error === "string" ? board.error : "";
  const normalized = {
    rows,
    cols,
    modules: Number(firstNonNull(board.module_count, board.modules_count)) || 0,
    rowCounts,
    rowOffsets,
    minCols: Number(firstNonNull(board.min_cols, board.minCols)) || 0,
    layoutModuleCount: Number(board.layout_module_count) || 0,
    debugModuleLimit: Boolean(board.debug_module_limit),
    error,
    layoutError: normalizeLayoutError(error),
  };
  normalized.hardware = hardwareGrid(normalized, modules);
  return normalized;
};

const normalizeDisplay = (raw, board) => {
  const display = raw && typeof raw === "object" ? raw : {};
  const lines = Array.isArray(display.lines) ? display.lines : [];
  const out = [];
  for (let row = 0; row < board.rows; row += 1) {
    out.push(String(lines[row] || "").padEnd(board.cols, " ").slice(0, board.cols));
  }
  return { ...display, lines: out };
};

const normalizeCompat = (state, coordinator) => {
  const local = numberOrNull(
    firstNonNull(
      state.mqtt_compat,
      state.compat,
      coordinator.mqtt_compat,
      coordinator.compat
    )
  );
  const masterMqtt = numberOrNull(
    firstNonNull(coordinator.master_mqtt_compat, coordinator.master_compat)
  );
  const masterBus = numberOrNull(coordinator.master_bus_compat);
  const reported = firstDefined(
    coordinator.mqtt_compat_ok,
    coordinator.compat_ok
  );
  const ok = reported === null ? null : reported === true;
  return { local, masterMqtt, masterBus, ok, missing: ok === null };
};

const normalizeModule = (raw, stockDrum) => {
  const module = raw && typeof raw === "object" ? raw : {};
  const flapList =
    normalizeFlapList(
      firstNonNull(
        module.flap_list,
        module.flapList,
        module.FlapList,
        module.flaps,
        module.drum,
        module.drum_chars,
        module.drumChars,
        module.characters
      )
    ) || module.flap_list;

  const reportedDrum = normalizeFlapList(
    firstNonNull(module.effective_drum, module.effectiveDrum)
  );
  const drum =
    reportedDrum ||
    (Array.isArray(flapList) && flapList.length
      ? flapList
      : Array.from(String(stockDrum || "")));

  const actualFlap = firstNonNull(module.actual_flap, module.flap);
  const desiredFlap = firstNonNull(module.desired_flap);
  const displayedFlap = firstNonNull(
    module.displayed_flap,
    desiredFlap,
    actualFlap
  );
  const index = numberOrNull(
    firstNonNull(module.display_flap_index, module.flap_index)
  );
  const fwBusCompat = numberOrNull(
    firstNonNull(module.fw_bus_compat, module.fw_compat)
  );
  const fwFlag = firstDefined(
    module.fw_bus_compatible,
    module.fw_compatible
  );

  return {
    ...module,
    flap_list: flapList,
    effective_drum: drum,
    actual_flap: actualFlap,
    desired_flap: desiredFlap,
    displayed_flap: displayedFlap,
    display_flap_index: index,
    fw_version: firstNonNull(module.fw_version, module.firmware_version),
    fw_bus_compat: fwBusCompat,
    fw_bus_compatible: fwFlag === null ? undefined : fwFlag === true,
  };
};

const normalizeCoordinator = (raw, state, stockDrum) => {
  const coordinator = raw && typeof raw === "object" ? raw : {};
  const modules = (Array.isArray(coordinator.modules) ? coordinator.modules : []).map(
    (module) => normalizeModule(module, stockDrum)
  );
  const compatInfo = normalizeCompat(state || {}, coordinator);
  return {
    ...coordinator,
    modules,
    modules_count:
      Number(firstNonNull(coordinator.modules_count, modules.length)) || 0,
    compatInfo,
    mqtt_compat: compatInfo.local,
    compat: compatInfo.local,
    master_mqtt_compat: compatInfo.masterMqtt,
    master_compat: compatInfo.masterMqtt,
    mqtt_compat_ok: compatInfo.ok,
    compat_ok: compatInfo.ok,
  };
};

/** The single read seam every panel view shares. */
export const normalizeSnapshot = (raw, options = {}) => {
  const state = raw && typeof raw === "object" ? raw : {};
  const stockDrum = options.stockDrum || "";
  const coordinator = normalizeCoordinator(state.coordinator, state, stockDrum);
  const engine = normalizeEngine(state.engine, coordinator.modules);
  return {
    ...state,
    coordinator,
    engine,
    compatInfo: coordinator.compatInfo,
    board: engine.board,
    modules: coordinator.modules,
  };
};

const normalizeEngine = (raw, modules) => {
  const engine = raw && typeof raw === "object" ? raw : {};
  const board = normalizeBoard(engine.board, modules);
  return { ...engine, board, display: normalizeDisplay(engine.display, board) };
};
