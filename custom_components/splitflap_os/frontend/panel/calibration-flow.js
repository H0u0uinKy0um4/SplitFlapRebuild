/** Calibration choreography for the split-flap panel.
 *
 * One deep module behind a two-function interface: ``view()`` is a DOM-free
 * view model, ``act()`` is the single entry point for every user intent. The
 * snapshot, send channel, clock and notifications are injected, so the whole
 * flow (phases, settle delays, abort checks, expected steps and optimistic
 * map writes) can be driven by a host-side probe with a fake clock.
 *
 * No Home Assistant, DOM or translation imports on purpose.
 */

const UNSET = 0xFFFF;

/** Clamp without turning a bad number into zero. */
const bounded = (value, min, max) =>
  Math.max(min, Math.min(max, Number(value)));

/** Read a DOM field value with a fallback (the adapter passes strings). */
const withFallback = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? number : fallback;
};

export function createCalibrationFlow({
  snapshot,
  selectedModule,
  send,
  sleep,
  notify,
  render,
  plural,
  colors = [],
  stockDrum,
  settleMs = 1200,
  countdown = 12,
}) {
  let at = null;
  let teach = null;
  let tune = null;

  const state = () => snapshot() || {};
  const coordinator = () => state().coordinator || {};
  const modules = () => coordinator().modules || [];
  const moduleFor = (id) =>
    modules().find((module) => module && String(module.id) === String(id)) || null;

  const changed = () => {
    if (typeof render === "function") render();
  };

  const drumFor = (module) => {
    if (module && Array.isArray(module.effective_drum) && module.effective_drum.length) {
      return module.effective_drum.slice(0, 64);
    }
    if (module && Array.isArray(module.flap_list) && module.flap_list.length) {
      return module.flap_list.slice(0, 64);
    }
    return String(stockDrum || "").split("");
  };

  // The wizard paints one character across the whole board, so it needs one
  // shared drum. Prefer the first module that reports a real one.
  const atDrum = () => {
    for (const module of modules()) {
      const drum = drumFor(module);
      if ((Array.isArray(module.effective_drum) && module.effective_drum.length) ||
          (Array.isArray(module.flap_list) && module.flap_list.length)) {
        return drum;
      }
    }
    return String(stockDrum || "").split("");
  };

  const maxIndex = () => Math.max(1, Math.min(63, atDrum().length - 1));

  /** Absolute step the master uses for one flap index.
   *
   * Mirrors ``derive_flap_state`` in coordinator.py, including the home
   * offset: a map entry written without it lands ``home_offset`` steps away
   * from the flap that was asked for.
   */
  const expectedStep = (module, index, drumLength = 64) => {
    const calibration = Math.max(1, Number(module && module.total_steps) || 4096);
    const offset = Number(module && module.home_offset) || 0;
    const length = Math.max(1, Number(drumLength) || 64);
    const step = Math.floor((Number(index) * calibration + length / 2) / length);
    return ((offset % calibration) + step) % calibration;
  };

  const charInfo = (char) => {
    const value = char || " ";
    return {
      char: value,
      charDisplay: value === " " ? "␣" : value,
      colorKey: colors.includes(value) ? value : null,
    };
  };

  const neighbour = (drum, index, direction) => {
    const next = Number(index) + direction;
    if (next < 0 || next >= drum.length) return "?";
    return drum[next] === " " ? "␣" : drum[next];
  };

  const frameCount = () => {
    const data = coordinator();
    return Number(data.modules_count) || modules().length || 45;
  };

  /** Paint one character on every cell; a stale wizard frame is not fatal. */
  async function paintChar(char) {
    try {
      await send("send_text", {
        text: String(char || " ").repeat(frameCount()),
        start: 1,
        style: "ltr",
        speed: 0,
        stop: true,
        raw: true,
      });
    } catch (err) {
      console.error(err);
    }
  }

  function writeMap(module, index, value) {
    if (!module.map_of_positions) module.map_of_positions = {};
    module.map_of_positions[String(index)] = value;
  }

  // ------------------------------------------------------------------
  // Auto-tune wizard
  // ------------------------------------------------------------------
  async function gotoChar(index) {
    if (!at) return;
    at.charIndex = index;
    at.phase = "ahead";
    at.selected.clear();
    const char = atDrum()[index] || " ";
    changed();
    await paintChar(char);
  }

  async function atBegin({ startIndex, stepSize } = {}) {
    const max = maxIndex();
    at = {
      running: true,
      phase: "homing",
      charIndex: bounded(withFallback(startIndex, max), 1, max),
      stepSize: bounded(withFallback(stepSize, 25), 1, 100),
      selected: new Set(),
      countdown,
    };
    changed();

    // No standalone stop command: stop any app that would repaint the board
    // while we home and measure. An idle board makes this a no-op.
    try {
      await send("stop_app");
    } catch (err) {
      // Nothing was running.
    }

    try {
      await send("home_all");
    } catch (err) {
      // Every measurement would be meaningless on an unhomed board.
      at = null;
      changed();
      return;
    }

    for (let left = countdown; left > 0; left -= 1) {
      if (!at || !at.running) return;
      at.countdown = left;
      changed();
      await sleep(1000);
    }
    if (!at || !at.running) return;
    await gotoChar(at.charIndex);
  }

  function atToggle(id) {
    if (!at || at.phase === "verify") return;
    const key = String(id);
    if (at.selected.has(key)) at.selected.delete(key);
    else at.selected.add(key);
    changed();
  }

  async function atApply({ ahead, stepSize } = {}) {
    if (!at || !at.selected.size) {
      notify("select_module_first", {}, "warn");
      return;
    }
    const step = bounded(withFallback(stepSize, at.stepSize || 25), 1, 100);
    at.stepSize = step;
    const index = at.charIndex;
    const drum = atDrum();

    for (const id of at.selected) {
      const module = moduleFor(id);
      if (!module) continue;
      const calibration = Number(module.total_steps) || 4096;
      const expected = expectedStep(module, index, drum.length);
      const tuned = (module.map_of_positions || {})[String(index)];
      // A sane map entry is within half a flap of the geometric position.
      // Further away it points at a different flap, so start from the model
      // instead of moving a whole revolution in small clicks.
      const near =
        tuned !== undefined &&
        Math.abs(Number(tuned) - expected) <= calibration / 128;
      const base = near ? Number(tuned) : expected;
      const value = bounded(base + (ahead ? -step : step), 0, calibration - 1);
      await send("calibrate", {
        module: id,
        action: "apply",
        positions: { [String(index)]: value },
      });
      writeMap(module, index, value);
    }

    // Abort may have arrived while the apply round-trips were in flight.
    if (!at) return;
    notify(ahead ? "at_ahead_apply" : "at_behind_apply", {
      step,
      count: at.selected.size,
    });
    at.selected.clear();
    at.phase = "verify";
    changed();

    // Master moves block and the map write has to reach EEPROM, so wait
    // before asking for the verification frame.
    await sleep(settleMs);
    if (!at) return;
    await paintChar(drum[index] || " ");
  }

  function atPhase(phase) {
    if (!at) return;
    at.phase = phase;
    at.selected.clear();
    changed();
  }

  async function atNextChar() {
    if (!at) return;
    const next = at.charIndex - 1;
    if (next < 1) {
      at.phase = "done";
      changed();
      return;
    }
    await gotoChar(next);
  }

  async function atJump({ index } = {}) {
    if (!at) return;
    const value = Number(index);
    if (value >= 1 && value <= maxIndex()) await gotoChar(value);
  }

  function atAbort({ restart = false } = {}) {
    at = null;
    changed();
    if (!restart) notify("at_abort_btn");
  }

  // ------------------------------------------------------------------
  // Teach mode
  // ------------------------------------------------------------------
  async function teachStart() {
    const module = selectedModule();
    if (!module) {
      notify("select_module_first", {}, "warn");
      return;
    }
    const tuned = (module.map_of_positions || {})["0"];
    teach = {
      running: true,
      moduleId: module.id,
      flapIndex: 0,
      currentStep: tuned !== undefined ? Number(tuned) : 0,
      done: false,
    };
    await send("calibrate", { module: module.id, action: "goto", index: 0 });
    changed();
  }

  async function teachNudge({ delta, step } = {}) {
    if (!teach || !teach.running) return;
    teach.currentStep = bounded(
      withFallback(step, teach.currentStep) + Number(delta),
      0,
      65535
    );
    await send("calibrate", {
      module: teach.moduleId,
      action: "step",
      steps: Number(delta),
    });
    changed();
  }

  async function teachAdvance({ record = false, step } = {}) {
    if (!teach || !teach.running) return;
    const module = moduleFor(teach.moduleId);
    if (!module) return;
    const current = withFallback(step, teach.currentStep);

    if (record) {
      await send("calibrate", {
        module: teach.moduleId,
        action: "apply",
        positions: { [String(teach.flapIndex)]: current },
      });
      writeMap(module, teach.flapIndex, current);
    }

    const next = teach.flapIndex + 1;
    if (next > 63) {
      teach.done = true;
      changed();
      notify("teach_done");
      return;
    }

    const tuned = (module.map_of_positions || {})[String(next)];
    teach.flapIndex = next;
    teach.currentStep =
      tuned !== undefined ? Number(tuned) : expectedStep(module, next);
    await send("calibrate", {
      module: teach.moduleId,
      action: "goto",
      index: next,
    });
    changed();
  }

  async function teachPrev() {
    if (!teach || !teach.running || teach.flapIndex <= 0) return;
    const module = moduleFor(teach.moduleId);
    if (!module) return;
    const previous = teach.flapIndex - 1;
    const tuned = (module.map_of_positions || {})[String(previous)];
    teach.flapIndex = previous;
    teach.currentStep =
      tuned !== undefined ? Number(tuned) : expectedStep(module, previous);
    await send("calibrate", {
      module: teach.moduleId,
      action: "goto",
      index: previous,
    });
    changed();
  }

  function teachAbort({ restart = false } = {}) {
    teach = null;
    changed();
    if (!restart) notify("teach_abort");
  }

  // ------------------------------------------------------------------
  // Single-flap tune modal
  // ------------------------------------------------------------------
  function tuneOpen(index) {
    const module = selectedModule();
    if (!module) {
      notify("select_module_first", {}, "warn");
      return;
    }
    const flap = Number(index);
    const drum = drumFor(module);
    const char = drum[flap] || " ";
    const expected = expectedStep(module, flap, drum.length);
    const tuned = (module.map_of_positions || {})[String(flap)];
    tune = {
      moduleId: module.id,
      index: flap,
      char,
      expected,
      tuned: tuned !== undefined ? Number(tuned) : null,
      active: tuned !== undefined ? Number(tuned) : expected,
    };
    changed();
  }

  function tuneNudge({ delta, step } = {}) {
    if (!tune) return;
    tune.active = bounded(
      withFallback(step, tune.active) + Number(delta),
      0,
      65535
    );
    changed();
  }

  async function tuneTest() {
    if (!tune) return;
    await send("calibrate", {
      module: tune.moduleId,
      action: "goto",
      index: tune.index,
    });
    notify("goto_named", { index: tune.index });
  }

  async function tuneSave({ step } = {}) {
    if (!tune) return;
    const active = withFallback(step, tune.active);
    await send("calibrate", {
      module: tune.moduleId,
      action: "apply",
      positions: { [String(tune.index)]: active },
    });
    const module = moduleFor(tune.moduleId);
    if (module) writeMap(module, tune.index, active);
    tune.tuned = active;
    tune.active = active;
    notify("applied_map", {
      entries: typeof plural === "function" ? plural("entries", 1) : "1",
    });
    changed();
  }

  async function tuneRevert() {
    if (!tune) return;
    await send("calibrate", {
      module: tune.moduleId,
      action: "apply",
      positions: { [String(tune.index)]: UNSET },
    });
    const module = moduleFor(tune.moduleId);
    if (module && module.map_of_positions) {
      delete module.map_of_positions[String(tune.index)];
    }
    tune.tuned = null;
    tune.active = tune.expected;
    notify("cleared_eeprom", { module: tune.moduleId });
    changed();
  }

  function tuneClose() {
    tune = null;
    changed();
  }

  async function offsetQuick({ delta } = {}) {
    const module = selectedModule();
    if (!module) {
      notify("select_module_first", {}, "warn");
      return;
    }
    const next = bounded(
      (Number(module.home_offset) || 0) + Number(delta),
      0,
      65535
    );
    await send("calibrate", {
      module: module.id,
      action: "apply",
      home_offset: next,
    });
    module.home_offset = next;
    notify("applied_offset", { offset: next });
    changed();
  }

  /** The one mutating entry point. Intent names are the command vocabulary. */
  function act(intent, args = {}) {
    switch (intent) {
      case "at_begin": return atBegin(args);
      case "at_cell": return atToggle(args.id);
      case "at_apply": return atApply(args);
      case "at_skip_ahead": return atPhase("behind");
      case "at_recheck_ahead": return atPhase("ahead");
      case "at_next_char": return atNextChar();
      case "at_jump": return atJump(args);
      case "at_abort": return atAbort();
      case "at_restart": return atAbort({ restart: true });
      case "teach_start": return teachStart();
      case "teach_nudge": return teachNudge(args);
      case "teach_advance": return teachAdvance(args);
      case "teach_prev": return teachPrev();
      case "teach_abort": return teachAbort();
      case "teach_restart": return teachAbort({ restart: true });
      case "tune_open": return tuneOpen(args.index);
      case "tune_nudge": return tuneNudge(args);
      case "tune_test": return tuneTest();
      case "tune_save": return tuneSave(args);
      case "tune_revert": return tuneRevert();
      case "tune_close": return tuneClose();
      case "offset_quick": return offsetQuick(args);
      default: return undefined;
    }
  }

  /** The one reading entry point: plain data for the tuning renderer. */
  function view() {
    const drum = atDrum();
    const max = maxIndex();
    const index = at ? at.charIndex : max;
    const char = drum[index] || " ";
    const info = charInfo(char);
    const autoTune = {
      active: Boolean(at && at.running),
      phase: at ? at.phase : "start",
      maxIndex: max,
      charIndex: index,
      stepSize: at ? at.stepSize : 25,
      countdown: at ? at.countdown : countdown,
      selected: at ? Array.from(at.selected) : [],
      ...info,
      prevChar: neighbour(drum, index, -1),
      nextChar: neighbour(drum, index, 1),
    };

    const module = selectedModule();
    const teachIndex = teach ? teach.flapIndex : 0;
    const teachChar = module ? drumFor(module)[teachIndex] || " " : " ";
    const teachView = {
      available: Boolean(module),
      moduleId: module ? module.id : null,
      active: Boolean(teach && teach.running && !teach.done),
      done: Boolean(teach && teach.done),
      flapIndex: teachIndex,
      currentStep: teach ? teach.currentStep : null,
      expectedStep: module ? expectedStep(module, teachIndex) : 0,
      ...charInfo(teachChar),
    };

    const tuneFlap = tune
      ? {
          open: true,
          moduleId: tune.moduleId,
          index: tune.index,
          expected: tune.expected,
          tuned: tune.tuned,
          active: tune.active,
          ...charInfo(tune.char),
        }
      : { open: false };

    return { autoTune, teach: teachView, tuneFlap };
  }

  return { view, act };
}
