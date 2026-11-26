/** Host probes for the master self-update choreography.
 *
 * Run with ``node --test tests/test_master_ota_flow.mjs``. The flow is DOM-free
 * and Home Assistant-free: every probe crosses the same ``view()`` / ``act()``
 * seam as the panel adapters, with a fake clock and a substituted send channel.
 * That is what makes the five-minute reconnect rule testable without hardware.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createMasterOtaFlow } from "../custom_components/splitflap_os/frontend/panel/master-ota-flow.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function harness({
  version = "1.2.0.0",
  online = true,
  masterOta = { state: "idle" },
  slaveOta = { state: "idle" },
  overrides = {},
} = {}) {
  const snapshot = {
    coordinator: {
      online,
      master_version: version,
      master_ota: { ...masterOta },
      ota: { ...slaveOta },
    },
    engine: {},
  };
  const requests = [];
  const toasts = [];
  const waiters = [];
  let clock = 0;
  let renders = 0;
  const flow = createMasterOtaFlow({
    snapshot: () => snapshot,
    send: async (type, payload) => {
      requests.push({ type, payload });
      return {};
    },
    sleep: (ms) => {
      waiters.push(() => {
        clock += ms;
      });
      return new Promise((resolve) => {
        waiters[waiters.length - 1].resolve = resolve;
      });
    },
    notify: (key, params, level) => toasts.push({ key, params, level }),
    render: () => {
      renders += 1;
    },
    now: () => clock,
    pollMs: 10,
    rebootTimeoutMs: 100,
    ...overrides,
  });
  return {
    flow,
    snapshot,
    requests,
    toasts,
    get renders() {
      return renders;
    },
    get pending() {
      return waiters.length;
    },
    advance() {
      const waiter = waiters.shift();
      if (!waiter) throw new Error("no pending sleep to advance");
      waiter();
      waiter.resolve();
    },
  };
}

/** Drive one status cycle: set state, advance the fake sleep, flush promises. */
async function step(h, patch) {
  Object.assign(h.snapshot.coordinator, patch);
  h.advance();
  await flush();
}

test("view starts idle and refuses unknown actions", async () => {
  const h = harness();
  assert.deepEqual(h.flow.view(), {
    state: "idle",
    running: false,
    phase: "idle",
    progress: null,
    version: "1.2.0.0",
    targetVersion: null,
    error: null,
    remainingSeconds: null,
  });
  assert.deepEqual(await h.flow.act("reset"), {
    ok: false,
    code: "invalid_request",
  });
  assert.deepEqual(await h.flow.act("cancel"), {
    ok: false,
    code: "master_ota_cancel_not_allowed",
  });
  assert.equal(h.requests.length, 0);
});

test("a release flash waits for the reboot and the expected version", async () => {
  const h = harness();
  const pending = h.flow.act("flash_release", {
    tag: "v1.2.1.0",
    version: "1.2.1.0",
  });
  await flush();

  assert.deepEqual(h.requests, [
    {
      type: "flash_master_firmware_release",
      payload: { release: "v1.2.1.0" },
    },
  ]);
  assert.equal(h.flow.view().running, true);
  assert.equal(h.flow.view().phase, "uploading");
  assert.equal(h.flow.view().targetVersion, "1.2.1.0");

  await step(h, { master_ota: { state: "collecting", progress: 40 } });
  assert.equal(h.flow.view().phase, "collecting");
  assert.equal(h.flow.view().progress, 40);

  await step(h, { online: false, master_ota: { state: "rebooting" } });
  assert.equal(h.flow.view().phase, "rebooting");

  await step(h, {
    online: true,
    master_version: "1.2.1.0",
    master_ota: { state: "done", progress: 100 },
  });

  const result = await pending;
  assert.deepEqual(result, { ok: true, code: null });
  assert.equal(h.flow.view().state, "done");
  assert.equal(h.requests.length, 1);
  assert.ok(h.toasts.some((toast) => toast.key === "master_ota_success"));
});

test("local upload without a version warns but confirms the reconnect", async () => {
  const h = harness();
  const pending = h.flow.act("flash_local", { base64: "QUJD", version: "" });
  await flush();

  assert.ok(
    h.toasts.some(
      (toast) =>
        toast.key === "master_ota_version_unknown" && toast.level === "warn"
    )
  );
  assert.deepEqual(h.requests, [
    {
      type: "flash_master_firmware",
      payload: { base64: "QUJD", version: "" },
    },
  ]);

  await step(h, { online: false, master_ota: { state: "rebooting" } });
  await step(h, {
    online: true,
    master_version: "1.3.0.0",
    master_ota: { state: "done" },
  });
  assert.deepEqual(await pending, { ok: true, code: null });
});

test("slave OTA, an active master session and a running job all block flashing", async () => {
  const h = harness({ slaveOta: { state: "flashing" } });
  assert.deepEqual(await h.flow.act("flash_local", { base64: "QUJD" }), {
    ok: false,
    code: "firmware_release_session_active",
  });
  assert.equal(h.requests.length, 0);

  h.snapshot.coordinator.ota = { state: "idle" };
  h.snapshot.coordinator.master_ota = { state: "applying" };
  assert.deepEqual(await h.flow.act("flash_local", { base64: "QUJD" }), {
    ok: false,
    code: "firmware_release_session_active",
  });

  h.snapshot.coordinator.master_ota = { state: "idle" };
  const pending = h.flow.act("flash_local", { base64: "QUJD" });
  await flush();
  assert.deepEqual(await h.flow.act("flash_local", { base64: "QUJD" }), {
    ok: false,
    code: "master_ota_running",
  });
  assert.equal(h.requests.length, 1);

  // Cancel is refused after collection; let the pending job finish deterministically.
  await step(h, { online: false, master_ota: { state: "rebooting" } });
  await step(h, {
    online: true,
    master_version: "1.4.0.0",
    master_ota: { state: "done" },
  });
  await pending;
});

test("cancel is only accepted while the master is collecting", async () => {
  const h = harness();
  assert.equal((await h.flow.act("cancel")).ok, false);

  h.snapshot.coordinator.master_ota = { state: "collecting", progress: 5 };
  assert.deepEqual(await h.flow.act("cancel"), { ok: true });
  assert.deepEqual(h.requests, [
    { type: "cancel_master_firmware", payload: {} },
  ]);
  assert.ok(
    h.toasts.some((toast) => toast.key === "master_ota_cancel_requested")
  );
});

test("missing reconnect reports a timeout and a wrong version a mismatch", async () => {
  const h = harness({ overrides: { rebootTimeoutMs: 30 } });
  const pending = h.flow.act("flash_release", {
    tag: "v1.2.1.0",
    version: "1.2.1.0",
  });
  await flush();
  for (let i = 0; i < 3; i += 1) {
    h.advance();
    await flush();
  }
  assert.deepEqual(await pending, {
    ok: false,
    code: "master_ota_reconnect_timeout",
  });
  assert.equal(h.flow.view().state, "failed");

  const mismatch = harness({ overrides: { rebootTimeoutMs: 30 } });
  const second = mismatch.flow.act("flash_release", {
    tag: "v1.2.1.0",
    version: "1.2.1.0",
  });
  await flush();
  await step(mismatch, { online: false, master_ota: { state: "rebooting" } });
  await step(mismatch, {
    online: true,
    master_version: "1.2.0.9",
    master_ota: { state: "done" },
  });
  // One sleep remains before the deadline expires.
  mismatch.advance();
  await flush();
  assert.deepEqual(await second, {
    ok: false,
    code: "master_ota_version_mismatch",
  });
  const toast = mismatch.toasts.find(
    (item) => item.key === "master_ota_version_mismatch"
  );
  assert.equal(toast.params.actual, "1.2.0.9");
  assert.equal(toast.params.expected, "1.2.1.0");
});
