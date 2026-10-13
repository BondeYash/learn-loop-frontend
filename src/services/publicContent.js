import axiosInstance from "./axiosInstance.js";

const EMPTY = Object.freeze({ data: null, refreshing: false, waiting: false });
const MINUTE = 60_000;
export function retryDelay(error, failures, now = Date.now()) {
  const header = error?.response?.headers?.["retry-after"];
  const requested = header ? /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - now : 0;
  return Math.max(Math.min(60_000, 1000 * 2 ** Math.min(failures - 1, 6)), Math.min(300_000, Math.max(0, requested || error?.retryAfterMs || 0)));
}
const retryable = error => !error?.response || [408, 425, 429].includes(error.response.status) || error.response.status >= 500;

// Only anonymous public metadata is retained. Access, checkout and session
// responses never enter this store. Every mount revalidates the saved content.
export function createPublicResource({ load, normalize, cacheKey, maxAge, storage, now = Date.now, timers = globalThis, events = globalThis.window, visibility = globalThis.document, online = () => globalThis.navigator?.onLine !== false }) {
  const listeners = new Set();
  let state = EMPTY, savedAt = 0, request, retryTimer, stopTimer, failures = 0, retryAt = 0;
  const emit = changes => { state = { ...state, ...changes }; listeners.forEach(fn => fn()); };
  const usable = () => {
    if (state.data === null || now() - savedAt > maxAge) return false;
    try { normalize(state.data); return true; } catch { return false; }
  };
  const active = () => online() && visibility?.visibilityState !== "hidden";
  const clearRetry = () => { timers.clearTimeout(retryTimer); retryTimer = undefined; };
  try {
    const saved = cacheKey && JSON.parse(storage?.getItem(cacheKey) || "null");
    if (saved?.version === 1 && Number.isFinite(saved.at) && saved.at <= now() && now() - saved.at <= maxAge) {
      state = { ...EMPTY, data: normalize(saved.data) }; savedAt = saved.at;
    }
  } catch { /* Disabled storage or obsolete data must not prevent loading. */ }
  async function refresh() {
    if (!listeners.size || request || !active()) return;
    clearRetry();
    if (retryAt > now()) { retryTimer = timers.setTimeout(refresh, retryAt - now()); return; }
    const controller = new AbortController(); request = controller;
    emit({ refreshing: true, data: usable() ? state.data : null });
    try {
      const data = normalize(await load(controller.signal));
      if (request !== controller || controller.signal.aborted) return;
      savedAt = now(); failures = 0; retryAt = 0;
      emit({ data, refreshing: false, waiting: false });
      try { if (cacheKey) storage?.setItem(cacheKey, JSON.stringify({ version: 1, at: savedAt, data })); } catch { /* Memory still works. */ }
    } catch (error) {
      if (request !== controller || controller.signal.aborted) return;
      failures++;
      emit({ data: usable() ? state.data : null, refreshing: false, waiting: true });
      if (retryable(error)) { const delay = retryDelay(error, failures, now()); retryAt = now() + delay; retryTimer = timers.setTimeout(refresh, delay); }
    } finally { if (request === controller) request = undefined; }
  }
  const wake = () => { if (active() && (state.waiting || !state.data || now() - savedAt > MINUTE)) void refresh(); };
  const stop = () => {
    clearRetry(); const previous = request; request = undefined; previous?.abort();
    events?.removeEventListener("online", wake); events?.removeEventListener("focus", wake); visibility?.removeEventListener("visibilitychange", wake);
  };
  return {
    getSnapshot: () => state,
    get subscribers() { return listeners.size; },
    subscribe(listener) {
      timers.clearTimeout(stopTimer); listeners.add(listener);
      if (listeners.size === 1) {
        events?.addEventListener("online", wake); events?.addEventListener("focus", wake); visibility?.addEventListener("visibilitychange", wake);
        void refresh();
      }
      return () => { listeners.delete(listener); if (!listeners.size) stopTimer = timers.setTimeout(stop, 0); };
    },
  };
}

export function normalizeCourses(data) {
  if (!data || !Array.isArray(data.courses) || !Array.isArray(data.categories) || !Number.isInteger(data.total) || data.total < 0 || !Number.isInteger(data.limit) || data.limit < 1 || !Number.isInteger(data.page) || data.page < 1 || data.courses.length > 50) throw new Error("Invalid public catalog");
  if (data.courses.some(course => !course || typeof course.id !== "string" || typeof course.slug !== "string" || typeof course.title !== "string" || !Number.isSafeInteger(course.amountMinor) || course.amountMinor < 0)) throw new Error("Invalid public course");
  return data;
}
export function safeNotice(notice) {
  try {
    const url = new URL(notice.url);
    return typeof notice.id === "string" && typeof notice.title === "string" && notice.title.trim() && url.protocol === "https:" && ["sarkariresult.com.cm", "www.sarkariresult.com.cm"].includes(url.hostname) && !url.username && !url.password && !url.port;
  } catch { return false; }
}
export function normalizeNotices(data) {
  if (!data || typeof data.enabled !== "boolean" || !Array.isArray(data.notices)) throw new Error("Invalid notice feed");
  if (data.enabled && (!["ready", "stale"].includes(data.status) || !Number.isFinite(Date.parse(data.updatedAt)) || Date.now() - Date.parse(data.updatedAt) > 7 * 24 * 60 * MINUTE)) throw Object.assign(new Error("Feed is refreshing"), { retryAfterMs: MINUTE });
  return { ...data, notices: data.notices.filter(safeNotice).slice(0, 20) };
}
let storage;
try { storage = globalThis.localStorage; } catch { /* Storage can be blocked. */ }
const resources = new Map();
export function publicCoursesResource({ q = "", category = "", page = 1 } = {}) {
  const key = JSON.stringify([q, category, page]);
  if (!resources.has(key)) {
    if (resources.size >= 20) for (const [old, value] of resources) { if (!value.subscribers) { resources.delete(old); break; } }
    resources.set(key, createPublicResource({
      load: async signal => (await axiosInstance.get("/public/courses", { params: { q, category, page, limit: 12 }, signal, timeout: 60_000 })).data.data,
      normalize: normalizeCourses, cacheKey: !q && !category && page === 1 ? "learnloop:public-courses:v1" : null, maxAge: 10 * MINUTE, storage,
    }));
  }
  return resources.get(key);
}
export const examNotificationsResource = createPublicResource({
  load: async signal => (await axiosInstance.get("/public/exam-notifications", { signal, timeout: 60_000 })).data.data,
  normalize: normalizeNotices, cacheKey: "learnloop:exam-notices:v1", maxAge: 12 * 60 * MINUTE, storage,
});
