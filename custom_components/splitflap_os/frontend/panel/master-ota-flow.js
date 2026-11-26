/** Master (ESP32) self-update choreography for the split-flap panel.
 *
 * Flashing the master replaces the MQTT peer itself, so sending the image is
 * only half of the job: success means the master reconnected with the expected
 * version. This module keeps that choreography behind one small interface —
 * ``view()`` is a DOM-free progress model and ``act()`` is the single entry
 * point for every user intent. Snapshot, send, clock and notification adapters
 * are injected, so a host-side probe can drive the whole flow with a fake
 * clock. There are no Home Assistant, DOM or translation imports on purpose:
 * errors are stable translation keys and the panel decides how to show them.
 */

const ACTIVE_STATES = new Set(["collecting", "applying", "rebooting"]);
const SLAVE_ACTIVE_STATES = new Set([
  "collecting",
  "entering",
  "flashing",
  "verifying",
]);

const DEFAULT_POLL_MS = 1000;
const DEFAULT_REBOOT_TIMEOUT_MS = 300000; // five minutes, matching the backend contract

export function createMasterOtaFlow({
  snapshot,
  send,
  sleep,
  notify,
  render,
  now = Date.now,
  pollMs = DEFAULT_POLL_MS,
  rebootTimeoutMs = DEFAULT_REBOOT_TIMEOUT_MS,
}) {
  let job = null;
  let generation = 0;

  const state = () => snapshot() || {};
  const coordinator = () => state().coordinator || {};
  const status = () => {
    const engine = state().engine || {};
    const raw = coordinator().master_ota || engine.master_ota || {};
    return raw && typeof raw === "object" ? raw : {};
  };
  const phase = () => String(status().state || "idle");
  const changed = () => {
    if (typeof render === "function") render();
  };
  const report = (key, params, level) => {
    if (typeof notify === "function") notify(key, params || {}, level);
  };

  const percent = () => {
    const info = status();
    if (typeof info.progress === "number") {
      return Math.max(0, Math.min(100, info.progress));
    }
    if (Number(info.size) > 0 && Number(info.received) > 0) {
      return Math.min(100, Math.round((info.received / info.size) * 100));
    }
    return null;
  };

  const view = () => {
    const info = status();
    const c = coordinator();
    const running = Boolean(job && job.state === "running");
    const currentPhase = job && job.phase ? job.phase : phase();
    const active = ACTIVE_STATES.has(currentPhase);
    const deadline = job ? job.deadline : null;
    return {
      state: job ? job.state : "idle",
      running,
      phase: currentPhase,
      progress: active ? percent() : job && job.progress != null ? job.progress : null,
      version: c.master_version || null,
      targetVersion: job
        ? job.targetVersion
        : info.target_version || null,
      error: job ? job.error : info.error || null,
      remainingSeconds:
        deadline != null && running
          ? Math.max(0, Math.ceil((deadline - now()) / 1000))
          : null,
    };
  };

  /** One firmware operation owns the master: slave OTA included. */
  const guard = () => {
    if (job && job.state === "running") return "master_ota_running";
    const slave = String((coordinator().ota || {}).state || "idle");
    if (SLAVE_ACTIVE_STATES.has(slave)) return "firmware_release_session_active";
    if (ACTIVE_STATES.has(phase())) return "firmware_release_session_active";
    return null;
  };

  const begin = (expected) => {
    generation += 1;
    job = {
      state: "running",
      phase: "uploading",
      progress: 0,
      targetVersion: expected || null,
      versionBefore: coordinator().master_version || null,
      error: null,
      deadline: null,
    };
    changed();
    return generation;
  };

  const settle = (mine, result, code = null, params = {}) => {
    if (mine !== generation) return { ok: false, code: "master_ota_cancelled" };
    job = {
      ...job,
      state: result,
      phase: result,
      error: result === "failed" ? code || "master_ota_failed" : null,
      deadline: null,
    };
    changed();
    if (result === "done") {
      report(
        code || "master_ota_success",
        { version: job.targetVersion || coordinator().master_version || "" }
      );
    } else if (result === "failed") {
      report(code || "master_ota_failed", params, "error");
    } else if (result === "cancelled") {
      report("master_ota_cancelled");
    }
    return { ok: result === "done", code };
  };

  const fail = (mine, err) => {
    if (mine !== generation) return { ok: false, code: "master_ota_cancelled" };
    const message = String((err && (err.message || err.error || err.code)) || "");
    const code =
      message.startsWith("master_") || message.startsWith("firmware_release_")
        ? message
        : "master_ota_failed";
    return settle(mine, "failed", code, { error: message });
  };

  /** Wait for the reboot and the new version, never a stale status snapshot. */
  const waitForReconnect = async (mine, expected) => {
    const started = now();
    let sawReboot = false;
    let sawReconnect = false;
    const before = job.versionBefore;

    while (now() - started < rebootTimeoutMs) {
      if (mine !== generation) {
        return { ok: false, code: "master_ota_cancelled" };
      }
      const c = coordinator();
      const info = status();
      const current = String(c.master_version || "");
      if (phase() === "rebooting" || c.online === false) sawReboot = true;
      if (phase() === "failed") {
        return settle(mine, "failed", "master_ota_failed", {
          error: info.error || "",
        });
      }
      if (phase() === "cancelled") {
        return settle(mine, "cancelled");
      }
      const reconnected =
        sawReboot || Boolean(before && current && current !== before);
      if (
        reconnected &&
        c.online !== false &&
        (phase() === "done" || phase() === "idle")
      ) {
        sawReconnect = true;
        if (!expected) return settle(mine, "done");
        if (current === expected) return settle(mine, "done");
        // A stale version right after reconnect is normal; keep polling until
        // the expected one appears or the five-minute window expires.
      }
      // Until the master reports a phase, the upload is still the visible
      // state; do not let a stale "idle" status erase that.
      if (phase() !== "idle" || sawReboot) {
        job = { ...job, phase: phase(), progress: percent() };
      } else {
        job = { ...job, progress: percent() };
      }
      changed();
      await sleep(pollMs);
    }

    const current = String(coordinator().master_version || "");
    if (sawReconnect && expected && current && current !== expected) {
      return settle(mine, "failed", "master_ota_version_mismatch", {
        expected,
        actual: current,
      });
    }
    return settle(mine, "failed", "master_ota_reconnect_timeout");
  };

  const flash = async (mine, type, payload, expected) => {
    try {
      await send(type, payload);
    } catch (err) {
      return fail(mine, err);
    }
    if (mine !== generation) return { ok: false, code: "master_ota_cancelled" };
    job = { ...job, deadline: now() + rebootTimeoutMs };
    changed();
    return waitForReconnect(mine, expected);
  };

  const act = async (action, params = {}) => {
    if (action === "cancel") {
      if (phase() !== "collecting") {
        return { ok: false, code: "master_ota_cancel_not_allowed" };
      }
      const wasRunning = Boolean(job && job.state === "running");
      generation += 1;
      const mine = generation;
      if (wasRunning) {
        job = { ...job, state: "cancelled", phase: "cancelled", deadline: null };
      }
      changed();
      report("master_ota_cancel_requested");
      try {
        await send("cancel_master_firmware", {});
      } catch (err) {
        /* the send adapter already reported it */
      }
      if (mine === generation) changed();
      return { ok: true };
    }

    if (action !== "flash_release" && action !== "flash_local") {
      return { ok: false, code: "invalid_request" };
    }
    const blocked = guard();
    if (blocked) return { ok: false, code: blocked };

    const expected = String(params.version || "").trim() || null;
    if (action === "flash_release") {
      const tag = String(params.tag || "").trim();
      if (!tag) return { ok: false, code: "master_ota_select_release" };
      const mine = begin(expected);
      return flash(mine, "flash_master_firmware_release", { release: tag }, expected);
    }

    const base64 = String(params.base64 || "");
    if (!base64) return { ok: false, code: "master_ota_no_file" };
    if (!expected) report("master_ota_version_unknown", {}, "warn");
    const mine = begin(expected);
    const payload = { base64, version: expected || "" };
    if (params.sha256) payload.sha256 = params.sha256;
    return flash(mine, "flash_master_firmware", payload, expected);
  };

  return { view, act };
}
