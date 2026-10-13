import test from "node:test";
import assert from "node:assert/strict";
import { createPublicResource, retryDelay, normalizeCourses, normalizeNotices } from "../src/services/publicContent.js";
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  let time = 10000, next = 0, calls = 0;
  const jobs = new Map(), saved = new Map(), events = new EventTarget(), visibility = new EventTarget();
  visibility.visibilityState = "visible";
  const timers = { setTimeout(fn, delay) { jobs.set(++next, { fn, at: time + delay }); return next; }, clearTimeout(id) { jobs.delete(id); } };
  const storage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  let loader = async () => ({ title: "Public content" });
  const config = { load: (...args) => { calls++; return loader(...args); }, normalize: value => { if (!value?.title) throw Error("Invalid"); return value; }, now: () => time, timers, storage, events, visibility, maxAge: 1000, cacheKey: "public", ...options };
  return { config, jobs, saved, events, visibility, storage, get calls() { return calls; }, set load(fn) { loader = fn; }, async advance(ms) { time += ms; for (const [key, job] of [...jobs]) if (job.at <= time) { jobs.delete(key); job.fn(); } await tick(); } };
}
test("transient failures retry automatically, back off and retain only last good public data", async () => {
  const f = fixture(); f.load = async () => { if (f.calls < 3) throw { response: { status: 503 } }; return { title: "Recovered" }; };
  const resource = createPublicResource(f.config), stop = resource.subscribe(() => {});
  await tick(); assert.equal(resource.getSnapshot().waiting, true); assert.equal(resource.getSnapshot().data, null);
  await f.advance(1000); assert.equal(f.calls, 2); await f.advance(1999); assert.equal(f.calls, 2); await f.advance(1);
  assert.equal(f.calls, 3); assert.equal(resource.getSnapshot().data.title, "Recovered"); assert.equal(resource.getSnapshot().waiting, false);
  stop(); await f.advance(0); assert.equal(f.jobs.size, 0);
});
test("saved content appears immediately, survives transient refresh failures and expires", async () => {
  const f = fixture(); f.saved.set("public", JSON.stringify({ version: 1, at: 10000, data: { title: "Saved" } }));
  f.load = async () => { throw Error("Offline"); };
  const resource = createPublicResource(f.config); assert.equal(resource.getSnapshot().data.title, "Saved");
  const stop = resource.subscribe(() => {}); await tick(); assert.equal(resource.getSnapshot().data.title, "Saved");
  await f.advance(1001); assert.equal(resource.getSnapshot().data, null); stop(); await f.advance(0);
});
test("strict-mode subscribers share one request; unmount cancels requests and late data cannot overwrite", async () => {
  const f = fixture(); let resolve, signal;
  f.load = value => { signal = value; return new Promise(r => { resolve = r; }); };
  const resource = createPublicResource(f.config); const first = resource.subscribe(() => {}); first(); const second = resource.subscribe(() => {});
  assert.equal(f.calls, 1); assert.equal(signal.aborted, false); second(); await f.advance(0); assert.equal(signal.aborted, true);
  resolve({ title: "Old request" }); await tick(); assert.equal(resource.getSnapshot().data, null);
});
test("hidden/offline pages do not poll; network recovery wakes requests and rate limits remain respected", async () => {
  let connected = false; const f = fixture({ online: () => connected });
  f.load = async () => { if (f.calls === 1) throw { response: { status: 429, headers: { "retry-after": "30" } } }; return { title: "Ready" }; };
  const resource = createPublicResource(f.config), stop = resource.subscribe(() => {}); assert.equal(f.calls, 0);
  connected = true; f.events.dispatchEvent(new Event("online")); await tick(); assert.equal(f.calls, 1);
  f.events.dispatchEvent(new Event("focus")); await tick(); assert.equal(f.calls, 1);
  f.visibility.visibilityState = "hidden"; await f.advance(30000); assert.equal(f.calls, 1);
  f.visibility.visibilityState = "visible"; f.visibility.dispatchEvent(new Event("visibilitychange")); await tick(); assert.equal(f.calls, 2); stop(); await f.advance(0);
});
test("blocked/corrupt storage and permanent client errors do not create request loops", async () => {
  const f = fixture({ storage: { getItem() { throw Error("Blocked"); }, setItem() { throw Error("Blocked"); } } });
  f.load = async () => { throw { response: { status: 400 } }; };
  const resource = createPublicResource(f.config), stop = resource.subscribe(() => {}); await tick(); assert.equal(f.jobs.size, 0); stop(); await f.advance(0);
  assert.equal(retryDelay({}, 1000), 60000); assert.equal(retryDelay({ response: { headers: { "retry-after": "3600" } } }, 1), 300000);
});
test("invalid/error feeds cannot overwrite saved data and notice links are filtered", () => {
  assert.throws(() => normalizeCourses({ courses: [{}], categories: [], total: 1, limit: 12, page: 1 }));
  assert.throws(() => normalizeNotices({ enabled: true, status: "unavailable", notices: [] }), error => error.retryAfterMs === 60000);
  assert.throws(() => normalizeNotices({ enabled: true, status: "ready", notices: [], updatedAt: "2000-01-01T00:00:00Z" }));
  const feed = normalizeNotices({ enabled: true, status: "ready", updatedAt: new Date().toISOString(), notices: [{ id: "a", title: "Safe", url: "https://sarkariresult.com.cm/notice/" }, { id: "b", title: "Bad", url: "javascript:alert(1)" }] });
  assert.equal(feed.notices.length, 1); assert.equal(normalizeNotices({ enabled: false, notices: [] }).enabled, false);
});
