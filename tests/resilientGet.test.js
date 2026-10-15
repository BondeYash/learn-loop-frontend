import test from "node:test";
import assert from "node:assert/strict";
import { createResilientGet, waitForRetry } from "../src/services/resilientGet.js";
test("workspace reads recover from transient gateway errors and preserve request configuration", async () => {
  const calls = [], waits = [], signal = new AbortController().signal;
  const read = createResilientGet(async (url, config) => { calls.push({ url, config }); if (calls.length < 3) throw { response: { status: 502 } }; return { data: "ready" }; }, async ms => waits.push(ms));
  assert.deepEqual(await read("/admin/doubt-dost", { signal, params: { page: 2 } }), { data: "ready" });
  assert.equal(calls.length, 3); assert.deepEqual(waits, [600, 1600]);
  assert.ok(calls.every(({ url, config }) => url === "/admin/doubt-dost" && config.signal === signal && config.params.page === 2 && config.timeout === 45000));
});
test("workspace reads stop after three attempts and never retry authorization failures", async () => {
  for (const status of [401, 403, 404, 502]) {
    let calls = 0;
    const read = createResilientGet(async () => { calls++; throw { response: { status } }; }, async () => {});
    await assert.rejects(read("/admin/doubt-dost"));
    assert.equal(calls, status === 502 ? 3 : 1);
  }
});
test("aborting a read cancels its backoff and prevents another network call", async () => {
  const controller = new AbortController(); let calls = 0;
  const read = createResilientGet(async () => { calls++; controller.abort(); throw { code: "ERR_NETWORK" }; });
  await assert.rejects(read("/admin/doubt-dost", { signal: controller.signal }));
  assert.equal(calls, 1);
  await assert.rejects(waitForRetry(1000, controller.signal), error => error.code === "ERR_CANCELED");
});
