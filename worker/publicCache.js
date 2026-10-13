import { handleRequest } from "./proxy.js";

const refreshing = new Map();
const SECOND = 1000;
// These two exact, anonymous DTOs are the only shared cache entries. Learning,
// sessions, payment quotes, course details and signed media always use the proxy.
export function publicCachePolicy(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.has("Range") || request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return null;
  let policy;
  if (url.pathname === "/api/public/courses") {
    const allowed = { q: [""], category: [""], page: ["", "1"], limit: ["", "12"] };
    for (const [name, value] of url.searchParams) if (!allowed[name]?.includes(value) || url.searchParams.getAll(name).length !== 1) return null;
    policy = { kind: "courses", fresh: 60 * SECOND, retain: 10 * 60 * SECOND };
  } else if (url.pathname === "/api/public/exam-notifications" && !url.search) {
    policy = { kind: "notices", fresh: 5 * 60 * SECOND, retain: 6 * 60 * 60 * SECOND };
  } else return null;
  url.pathname = "/__public_landing_cache/v1/" + policy.kind; url.search = "";
  return { ...policy, key: new Request(url.href) };
}
function validPayload(payload, policy, now) {
  const data = payload?.data;
  if (payload?.success === false || !data) return false;
  if (policy.kind === "courses") return Array.isArray(data.courses) && data.courses.length <= 12 && Array.isArray(data.categories) && data.page === 1 && data.limit === 12 && Number.isInteger(data.total) && data.total >= 0 && data.courses.every(course => typeof course.id === "string" && typeof course.title === "string" && typeof course.slug === "string" && Number.isSafeInteger(course.amountMinor) && course.amountMinor >= 0);
  return data.enabled === false || data.enabled === true && ["ready", "stale"].includes(data.status) && Array.isArray(data.notices) && Number.isFinite(Date.parse(data.updatedAt)) && now - Date.parse(data.updatedAt) <= 7 * 24 * 60 * 60 * SECOND;
}
function browserResponse(response, state) {
  const headers = new Headers(response.headers);
  headers.delete("X-Landing-Cached-At");
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-Public-Cache", state);
  return new Response(response.body, { status: response.status, headers });
}

export async function handlePublicRequest(request, env, ctx, { cache = globalThis.caches?.default, proxy = handleRequest, now = Date.now } = {}) {
  const policy = publicCachePolicy(request);
  if (!policy || !cache) return proxy(request, env);
  let cached;
  try {
    cached = await cache.match(policy.key);
    if (cached && (!validPayload(await cached.clone().json(), policy, now()) || !Number.isFinite(Number(cached.headers.get("X-Landing-Cached-At"))))) cached = null;
  } catch { cached = null; }
  const age = cached ? now() - Number(cached.headers.get("X-Landing-Cached-At")) : Infinity;
  if (age >= 0 && age < policy.fresh) return browserResponse(cached, "HIT");

  async function refresh(background) {
    const key = policy.key.url, existing = refreshing.get(key);
    if (existing && (existing.running || existing.retryAt > now())) return (await existing.promise).clone();
    // Bound isolate memory even if many preview/custom domains visit the Worker.
    if (refreshing.size >= 32) for (const [old, value] of refreshing) { if (!value.running) { refreshing.delete(old); break; } }
    const entry = { running: true, retryAt: 0 };
    entry.promise = (async () => {
      const headers = new Headers(request.headers);
      headers.delete("Cookie"); headers.delete("Authorization");
      const anonymous = new Request(request.url, { method: "GET", headers, signal: AbortSignal.timeout(background ? 25_000 : 60_000) });
      const response = await proxy(anonymous, env);
      let good = false;
      if (response.status === 200 && !response.headers.has("Set-Cookie") && response.headers.get("Content-Type")?.includes("application/json")) {
        try {
          const text = await response.clone().text();
          good = text.length <= 512 * 1024 && validPayload(JSON.parse(text), policy, now());
          if (good) {
            const saved = new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${Math.ceil(policy.retain / 1000)}`, "X-Landing-Cached-At": String(now()) } });
            await cache.put(policy.key, saved).catch(() => {});
          }
        } catch { /* A cache failure must not fail the original request. */ }
      }
      if (!good) entry.retryAt = now() + 15_000;
      return response;
    })().finally(() => { entry.running = false; if (!entry.retryAt) refreshing.delete(key); });
    refreshing.set(key, entry);
    return (await entry.promise).clone();
  }
  if (cached && age >= 0 && age < policy.retain) {
    const update = refresh(true).then(response => response.arrayBuffer()).then(() => {}).catch(() => {});
    ctx?.waitUntil?.(update);
    return browserResponse(cached, "STALE");
  }
  return browserResponse(await refresh(false), "MISS");
}
