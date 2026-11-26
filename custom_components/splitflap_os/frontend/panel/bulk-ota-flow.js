/** Bulk OTA choreography for the split-flap panel.
 *
 * The master owns one OTA session at a time, so "flash all" and "boot all"
 * are strictly sequential. This module holds that choreography behind one
 * small interface: ``view()`` is a DOM-free progress model and ``act()`` is
 * the single entry point for every user intent. Snapshot, send, clock and
 * notification adapters are injected, so the whole flow can be driven by a
 * host-side probe with a fake clock.
 *
 * No Home Assistant, DOM or translation imports on purpose. Errors are stable
 * translation keys; the panel decides how to show them.
 */

const ACTIVE_STATES = new Set([
  "collecting",
  "entering",
  "flashing",
  "verifying",
]);

const DEFAULT_POLL_MS = 200;
const DEFAULT_RESET_SETTLE_MS = 200;
const DEFAULT_FLASH_SETTLE_MS = 750;
const DEFAULT_SESSION_TIMEOUT_MS = 45000;

/** Module ids are numeric on the RS485 bus; reject anything else. */
const moduleId = (value) => {
  const text = String(value == null ? "" : value).trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return number >= 1 && number <= 255 ? number : null;
};

export function createBulkOtaFlow({
  snapshot,
  send,
  sleep,
  notify,
  render,
  now = Date.now,
  pollMs = DEFAULT_POLL_MS,
  resetSettleMs = DEFAULT_RESET_SETTLE_MS,
  flashSettleMs = DEFAULT_FLASH_SETTLE_MS,
  sessionTimeoutMs = DEFAULT_SESSION_TIMEOUT_MS,
}) {
  let job = null;
  let generation = 0;

  const state = () => snapshot() || {};
  const coordinator = () => state().coordinator || {};
  const ota = () => coordinator().ota || { state: "idle" };
  const changed = () => {
    if (typeof render === "function") render();
  };
  const report = (key, params, level) => {
    if (typeof notify === "function") notify(key, params || {}, level);
  };

  /** Flash targets are detected modules; boots also cover the full bus. */
  const targets = (kind) => {
    const ids = [];
    const modules = coordinator().modules;
    if (Array.isArray(modules)) {
      for (const module of modules) {
        const id = moduleId(module && module.id);
        if (id != null && !ids.includes(id)) ids.push(id);
      }
    }
    if (kind === "boot_all") {
      // A module in the bootloader no longer answers the scan, so a detected-
      // only list would miss exactly the modules that need a boot command.
      const configured = Math.min(
        255,
        Math.max(0, Number(coordinator().modules_count) || 0)
      );
      for (let id = 1; id <= configured; id += 1) {
        if (!ids.includes(id)) ids.push(id);
      }
      const stuck = moduleId(ota().module);
      if (stuck != null && !ids.includes(stuck)) ids.push(stuck);
    }
    return ids.sort((left, right) => left - right);
  };

  const view = () => ({
    running: Boolean(job && job.state === "running"),
    kind: job ? job.kind : null,
    state: job ? job.state : "idle",
    done: job ? job.done : 0,
    total: job ? job.total : 0,
    module: job ? job.module : null,
    version: job ? job.version : null,
    error: job ? job.error : null,
  });

  const guard = () => {
    if (job && job.state === "running") {
      return "firmware_release_bulk_running";
    }
    if (ACTIVE_STATES.has(String(ota().state || "idle"))) {
      return "firmware_release_session_active";
    }
    return null;
  };

  /** Wait for the session this module started, never another one's. */
  const waitForSession = async (module, mine) => {
    const started = now();
    let sawActive = false;
    while (now() - started < sessionTimeoutMs) {
      if (mine !== generation) return { cancelled: true };
      const info = ota();
      const phase = String(info.state || "idle");
      const target = moduleId(info.module);
      if (target != null && target !== module) {
        // A session for a different module says nothing about ours.
      } else if (ACTIVE_STATES.has(phase)) {
        sawActive = true;
      } else if (phase === "failed") {
        return { ok: false, code: "firmware_release_flash_failed" };
      } else if (phase === "done") {
        return { ok: true };
      } else if (phase === "cancelled") {
        return { ok: false, code: "firmware_release_bulk_cancelled" };
      } else if (phase === "idle" && sawActive) {
        // The master may replace "done" with "idle" before we sample it.
        return { ok: true };
      }
      await sleep(pollMs);
    }
    return { ok: false, code: "firmware_release_flash_timeout" };
  };

  const finish = (mine, result, error = null) => {
    if (mine !== generation) return;
    job = { ...job, state: result, error, module: null };
    changed();
    if (result === "done") {
      report("firmware_release_bulk_done", { count: job.done });
    } else if (result === "failed") {
      report("firmware_release_bulk_failed", { error: error || "" }, "error");
    } else if (result === "cancelled") {
      report("firmware_release_bulk_cancelled");
    }
  };

  const act = async (action, params = {}) => {
    if (action === "cancel") {
      if (!job || job.state !== "running") {
        return { ok: false, code: "firmware_release_bulk_idle" };
      }
      generation += 1;
      job = { ...job, state: "cancelled", module: null };
      changed();
      report("firmware_release_bulk_cancel_requested");
      try {
        await send("cancel_firmware", {});
      } catch (err) {
        /* the send adapter already reported it */
      }
      return { ok: true };
    }

    if (action !== "boot_all" && action !== "flash_all") {
      return { ok: false, code: "invalid_request" };
    }
    const blocked = guard();
    if (blocked) return { ok: false, code: blocked };

    const ids = targets(action);
    if (!ids.length) return { ok: false, code: "firmware_release_no_modules" };

    generation += 1;
    const mine = generation;
    job = {
      kind: action === "boot_all" ? "reset" : "flash",
      state: "running",
      done: 0,
      total: ids.length,
      module: null,
      version: action === "flash_all" ? params.version || null : null,
      error: null,
    };
    changed();

    try {
      for (const id of ids) {
        if (mine !== generation) break;
        job = { ...job, module: id };
        changed();

        if (action === "flash_all") {
          await send("flash_firmware_release", {
            release: params.release,
            module: id,
          });
          const outcome = await waitForSession(id, mine);
          if (mine !== generation) break;
          if (!outcome || outcome.ok !== true) {
            finish(
              mine,
              "failed",
              outcome && outcome.code
                ? outcome.code
                : "firmware_release_bulk_error"
            );
            return { ok: false, code: job.error };
          }
          await sleep(flashSettleMs);
        } else {
          await send("reset_firmware", { module: id });
          await sleep(resetSettleMs);
        }

        if (mine !== generation) break;
        job = { ...job, done: job.done + 1 };
        changed();
      }

      if (mine !== generation) return { ok: false, code: "firmware_release_bulk_cancelled" };
      finish(mine, "done");
      return { ok: true, count: job.done };
    } catch (err) {
      if (mine !== generation) {
        return { ok: false, code: "firmware_release_bulk_cancelled" };
      }
      const message = String((err && (err.message || err)) || "");
      const code = message.startsWith("firmware_release_")
        ? message
        : "firmware_release_bulk_error";
      finish(mine, "failed", code);
      return { ok: false, code };
    }
  };

  return { view, act, targets };
}
