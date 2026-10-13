import test from "node:test";
import assert from "node:assert/strict";
import { handlePublicRequest, publicCachePolicy } from "../worker/publicCache.js";
let sequence = 0;
const catalog = { success: true, data: { courses: [{ id: "public", title: "Exam course", slug: "exam-course", amountMinor: 19900 }], categories: [], total: 1, page: 1, limit: 12 } };
function fixture() {
  const origin = `https://landing-${++sequence}.example.invalid`, entries = new Map(), jobs = [];
  let time = Date.now(), calls = 0, loader = async () => Response.json(catalog);
  const cache = { async match(key) { return entries.get(key.url)?.clone(); }, async put(key, response) { entries.set(key.url, response.clone()); } };
  const ctx = { waitUntil(promise) { jobs.push(promise); } };
  return { entries, jobs, set load(value) { loader = value; }, get calls() { return calls; }, advance(ms) { time += ms; }, async flush() { await Promise.all(jobs.splice(0)); }, request(path = "/api/public/courses", init) { return new Request(origin + path, init); }, run(request) { return handlePublicRequest(request, {}, ctx, { cache, now: () => time, proxy: async input => { calls++; return loader(input); } }); } };
}
test("only default public course lists and notices can use the shared cache", () => {
  const f = fixture(); assert.ok(publicCachePolicy(f.request("/api/public/courses?q=&category=&page=1&limit=12")));
  for (const path of ["/api/auth/me", "/api/payments/courses/abc/quote", "/api/courses", "/api/public/courses/abc", "/api/public/courses/abc/preview", "/api/public/courses?q=SSC", "/api/public/courses?page=2", "/api/public/courses?limit=50", "/api/public/courses?page=1&page=1", "/api/public/exam-notifications?force=true", "/api/Public/courses", "/api/public/courses/"]) assert.equal(publicCachePolicy(f.request(path)), null, path);
  assert.equal(publicCachePolicy(f.request(undefined, { method: "POST" })), null);
  assert.equal(publicCachePolicy(f.request(undefined, { headers: { Origin: "https://evil.invalid" } })), null);
});
test("public misses strip credentials; hits serve identical metadata without contacting the backend", async () => {
  const f = fixture(); f.load = async request => { assert.equal(request.headers.get("Cookie"), null); assert.equal(request.headers.get("Authorization"), null); return Response.json(catalog); };
  const request = f.request(undefined, { headers: { Cookie: "lms_session=private", Authorization: "private" } });
  assert.equal((await f.run(request)).headers.get("X-Public-Cache"), "MISS");
  const hit = await f.run(f.request("/api/public/courses?limit=12")); assert.equal(f.calls, 1); assert.deepEqual(await hit.json(), catalog); assert.equal(hit.headers.get("X-Public-Cache"), "HIT"); assert.match(hit.headers.get("Cache-Control"), /no-store/); assert.equal(hit.headers.get("X-Landing-Cached-At"), null);
});
test("stale responses return before a slow refresh and concurrent visitors share it", async () => {
  const f = fixture(); await f.run(f.request()); f.advance(61000);
  let release; f.load = () => new Promise(resolve => { release = resolve; });
  const a = await f.run(f.request()), b = await f.run(f.request());
  assert.equal(a.headers.get("X-Public-Cache"), "STALE"); assert.equal(b.headers.get("X-Public-Cache"), "STALE"); assert.equal(f.calls, 2);
  release(Response.json({ ...catalog, data: { ...catalog.data, courses: [], total: 0 } })); await f.flush();
  assert.equal((await (await f.run(f.request())).json()).data.total, 0);
});
test("outages retain the last success, use a cooldown and stop serving expired entries", async () => {
  const f = fixture(); await f.run(f.request()); f.advance(61000); f.load = async () => Response.json({ message: "Unavailable" }, { status: 503 });
  assert.equal((await f.run(f.request())).status, 200); await f.flush(); await f.run(f.request()); await f.flush(); assert.equal(f.calls, 2);
  f.advance(600000); assert.equal((await f.run(f.request())).status, 503);
});
test("errors, malformed bodies and responses with cookies are never cached", async () => {
  for (const response of [Response.json({ success: false }, { status: 503 }), new Response("<html>Error</html>"), Response.json({ success: true, data: {} }), Response.json(catalog, { headers: { "Set-Cookie": "private=1" } })]) {
    const f = fixture(); f.load = async () => response;
    await f.run(f.request()); assert.equal(f.entries.size, 0);
  }
});
test("authenticated endpoints retain credentials and never read shared cache", async () => {
  const f = fixture(); f.load = async request => { assert.equal(request.headers.get("Cookie"), "private=1"); return Response.json({ private: true }); };
  const result = await f.run(f.request("/api/auth/me", { headers: { Cookie: "private=1" } }));
  assert.equal(result.headers.get("X-Public-Cache"), null); assert.equal(f.entries.size, 0);
});
test("notification refresh failures cannot replace saved notices or extend their source age", async () => {
  const f = fixture(), path = "/api/public/exam-notifications";
  const notices = { success: true, data: { enabled: true, status: "ready", notices: [{ title: "Exam" }], updatedAt: new Date().toISOString() } };
  f.load = async () => Response.json(notices); await f.run(f.request(path)); f.advance(6 * 60000);
  f.load = async () => Response.json({ data: { enabled: true, status: "unavailable", notices: [] } });
  assert.equal((await (await f.run(f.request(path))).json()).data.notices.length, 1); await f.flush();
  assert.equal((await (await f.run(f.request(path))).json()).data.notices.length, 1); await f.flush();
  f.advance(8 * 24 * 60 * 60 * 1000); assert.equal((await (await f.run(f.request(path))).json()).data.status, "unavailable");
});
