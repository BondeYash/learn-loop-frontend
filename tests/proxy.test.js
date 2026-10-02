import test from "node:test";
import assert from "node:assert/strict";
import { API_ORIGIN, handleRequest } from "../worker/proxy.js";
const FRONTEND = "https://lessonloop.example.invalid";
const unusedAssets = { ASSETS: { fetch() { throw new Error("API must not fall through to SPA assets"); } } };
const request = (path, options) => new Request(FRONTEND + path, options);

test("SPA/deep links and API-looking asset paths use the assets binding, while /api and /api/* use the fixed upstream", async () => {
  for (const path of ["/", "/courses/lesson", "/assets/app.js", "/apiary", "/api-other"]) {
    const input = request(path); let assetCalls = 0;
    const response = await handleRequest(input, { ASSETS: { fetch: async (received) => { assert.equal(received, input); assetCalls++; return new Response("SPA"); } } }, () => { throw Error("No API fetch expected"); });
    assert.equal(await response.text(), "SPA"); assert.equal(assetCalls, 1);
  }
  for (const path of ["/api", "/api/", "/api/health", "/api/missing.json", "/api//evil.example.invalid/path"]) {
    const response = await handleRequest(request(path + "?url=https%3A%2F%2Fevil.example.invalid&x=1&x=2"), unusedAssets, async (url, init) => {
      const target = new URL(url); assert.equal(target.origin, API_ORIGIN); assert.equal(target.pathname, path);
      assert.equal(target.search, "?url=https%3A%2F%2Fevil.example.invalid&x=1&x=2");
      assert.equal(init.redirect, "manual"); assert.equal(init.cache, "no-store");
      return new Response('{"success":false}', { status: 404, headers: { "Content-Type": "application/json" } });
    });
    assert.equal(response.status, 404); assert.equal(response.headers.get("Content-Type"), "application/json");
  }
});

test("POST/PATCH/DELETE preserve raw bodies, session cookies and original browser CSRF headers", async () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const body = '{"name":"A + B","emoji":"✓"}';
    const response = await handleRequest(request("/api/courses?draft=true", { method, headers: { "Content-Type": "application/json", Cookie: "lms_session=synthetic", Origin: FRONTEND, "Sec-Fetch-Site": "same-origin", Authorization: "synthetic-test-only" }, body }), unusedAssets, async (url, init) => {
      assert.equal(url, API_ORIGIN + "/api/courses?draft=true"); assert.equal(init.method, method);
      assert.equal(init.headers.get("Origin"), FRONTEND); assert.equal(init.headers.get("Sec-Fetch-Site"), "same-origin");
      assert.equal(init.headers.get("Cookie"), "lms_session=synthetic"); assert.equal(init.headers.get("Authorization"), "synthetic-test-only");
      assert.equal(init.headers.get("Content-Type"), "application/json"); assert.equal(await new Response(init.body).text(), body);
      return new Response(null, { status: 204 });
    });
    assert.equal(response.status, 204);
  }
});

test("multiple Set-Cookie headers, including logout and Expires commas, survive without becoming one cookie", async () => {
  const cookies = ["lms_session=synthetic; Path=/api; Expires=Thu, 08 Oct 2026 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax", "old_session=; Path=/api; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax"];
  const headers = new Headers({ "Cache-Control": "public, max-age=86400", "CDN-Cache-Control": "max-age=86400", "Cloudflare-CDN-Cache-Control": "max-age=86400", Age: "600", ETag: "old", "Last-Modified": "old", "Content-Length": "4", "Retry-After": "60" });
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  const response = await handleRequest(request("/api/auth/login"), unusedAssets, async () => new Response("body", { status: 429, headers }));
  assert.deepEqual(response.headers.getSetCookie(), cookies); assert.equal(response.status, 429); assert.equal(await response.text(), "body");
  for (const header of ["Cache-Control", "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control"]) assert.match(response.headers.get(header), /no-store/);
  for (const header of ["Age", "ETag", "Last-Modified", "Content-Length"]) assert.equal(response.headers.get(header), null);
  assert.equal(response.headers.get("Retry-After"), "60");
});

test("PDF multipart uploads preserve file bytes and the boundary through the Worker", async () => {
  const form = new FormData(); form.append("uploadId", "synthetic-upload-id"); form.append("file", new Blob(["%PDF-1.4 synthetic handout"], { type: "application/pdf" }), "notes.pdf");
  const upload = request("/api/courses/fixture/notes", { method: "POST", body: form, headers: { Cookie: "lms_session=synthetic", Origin: FRONTEND } });
  const expected = await upload.clone().text();
  const response = await handleRequest(upload, unusedAssets, async (_url, init) => {
    assert.match(init.headers.get("Content-Type"), /^multipart\/form-data; boundary=/);
    assert.equal(await new Response(init.body).text(), expected);
    return Response.json({ data: { note: { status: "ready" } } }, { status: 201 });
  });
  assert.equal(response.status, 201);
});

test("HEAD and OPTIONS preserve methods without manufacturing bodies or an Origin", async () => {
  for (const method of ["HEAD", "OPTIONS"]) {
    const response = await handleRequest(request("/api/health", { method }), unusedAssets, async (_url, init) => {
      assert.equal(init.method, method); assert.equal(init.body, undefined); assert.equal(init.headers.get("Origin"), null);
      return new Response(null, { status: 204 });
    });
    assert.equal(response.status, 204); assert.equal(await response.text(), "");
  }
});

test("forged forwarding chains and hop headers are stripped; only host/protocol are derived from the actual request URL", async () => {
  const headers = { Host: "evil.invalid", Forwarded: "for=spoofed", "X-Forwarded-For": "spoofed", "X-Forwarded-Host": "evil.invalid", "X-Forwarded-Proto": "http", "X-Real-IP": "spoofed", "True-Client-IP": "spoofed", "CF-Connecting-IP": "spoofed", Connection: "x-private-hop", "X-Private-Hop": "remove", "If-None-Match": "old", "If-Modified-Since": "old" };
  await handleRequest(request("/api/health", { headers }), unusedAssets, async (_url, init) => {
    for (const name of ["Host", "Forwarded", "X-Forwarded-For", "X-Real-IP", "True-Client-IP", "CF-Connecting-IP", "Connection", "X-Private-Hop", "If-None-Match", "If-Modified-Since"]) assert.equal(init.headers.get(name), null);
    assert.equal(init.headers.get("X-Forwarded-Host"), "lessonloop.example.invalid"); assert.equal(init.headers.get("X-Forwarded-Proto"), "https");
    return new Response("ok");
  });
});

test("cross-origin and cross-site writes fail before a fetch, including Connection header bypass attempts", async () => {
  for (const headers of [{ Origin: "https://evil.invalid" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }, { Origin: "https://evil.invalid", Connection: "origin" }, { "Sec-Fetch-Site": "cross-site", Connection: "sec-fetch-site" }]) {
    const response = await handleRequest(request("/api/auth/logout", { method: "POST", headers }), unusedAssets, () => { throw Error("Must not forward"); });
    assert.equal(response.status, 403); assert.match(response.headers.get("Cache-Control"), /no-store/);
  }
});

test("legacy media transfer routes and video bodies never reach the API proxy", async () => {
  for (const path of ["/api/lessons/abc/video", "/api/lessons/abc/VIDEO/", "/api/uploads/abc/chunks/0", "/api/uploads/abc/chunks%2f0", "/api/%"]) {
    assert.equal((await handleRequest(request(path), unusedAssets, () => { throw Error("No media proxy"); })).status, 410);
  }
  assert.equal((await handleRequest(request("/api/courses", { method: "POST", headers: { "Content-Type": "video/mp4" }, body: "fixture" }), unusedAssets, () => { throw Error("No media proxy"); })).status, 410);
  // The signed-link endpoint stays available and its JSON URL is not rewritten.
  const response = await handleRequest(request("/api/lessons/abc/playback"), unusedAssets, async () => Response.json({ url: "https://private-storage.example.invalid/synthetic-signed-link" }));
  assert.equal((await response.json()).url, "https://private-storage.example.invalid/synthetic-signed-link");
});

test("only same-upstream API redirects are rewritten to relative same-origin paths; unsafe redirects are never followed", async () => {
  for (const location of ["/api/auth/me?fresh=1", API_ORIGIN + "/api/auth/me?fresh=1"]) {
    let calls = 0;
    const response = await handleRequest(request("/api/auth/login", { method: "POST", body: "fixture" }), unusedAssets, async (_url, init) => { calls++; assert.equal(init.redirect, "manual"); return new Response(null, { status: 307, headers: { Location: location, "Set-Cookie": "lms_session=synthetic; Path=/api; Secure; HttpOnly; SameSite=Lax" } }); });
    assert.equal(calls, 1); assert.equal(response.status, 307); assert.equal(response.headers.get("Location"), "/api/auth/me?fresh=1"); assert.equal(response.headers.getSetCookie().length, 1);
  }
  const credentialRedirect = new URL(API_ORIGIN + "/api/auth/me");
  credentialRedirect.username = "synthetic-user"; credentialRedirect.password = "synthetic-fixture";
  for (const location of ["https://evil.invalid/capture", "//evil.invalid/capture", "/login", "http://learn-loop-backend-qkq5.onrender.com/api/auth/me", credentialRedirect.href, "/api/lessons/abc/video", "data:text/plain,invalid"]) {
    let calls = 0;
    const response = await handleRequest(request("/api/auth/login"), unusedAssets, async () => { calls++; return new Response("redirect", { status: 302, headers: { Location: location } }); });
    assert.equal(calls, 1); assert.equal(response.status, 502); assert.equal(response.headers.get("Location"), null);
  }
});

test("upstream failures return a safe uncached JSON error without leaking a URL, token or stack", async () => {
  const response = await handleRequest(request("/api/auth/me"), unusedAssets, () => { throw Error("private diagnostic value"); });
  assert.equal(response.status, 502); assert.match(response.headers.get("Cache-Control"), /no-store/);
  const text = await response.text(); assert.equal(JSON.parse(text).success, false); assert.doesNotMatch(text, /private diagnostic/);
});
