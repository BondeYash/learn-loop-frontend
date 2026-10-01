// This is deliberately a fixed origin, never a URL supplied by the caller.
export const API_ORIGIN = "https://learn-loop-backend-qkq5.onrender.com";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const HOP_HEADERS = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"];
const isApi = (path) => path === "/api" || path.startsWith("/api/");

function noStore(headers) {
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.delete("Age");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  return headers;
}

function apiError(status, message) {
  const headers = noStore(new Headers({ "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" }));
  return new Response(JSON.stringify({ success: false, message }), { status, headers });
}

function stripHopHeaders(headers) {
  const nominated = (headers.get("connection") || "").split(",").map((name) => name.trim()).filter(Boolean);
  for (const name of [...HOP_HEADERS, ...nominated]) headers.delete(name);
}

function legacyVideoPath(path) {
  // Express routes are case-insensitive. Reject encoded separators too, rather
  // than letting a variant of an old media route consume Worker/API bandwidth.
  let decoded;
  try { decoded = decodeURIComponent(path).replace(/\/{2,}/g, "/"); }
  catch { return true; }
  return /^\/api\/lessons\/[^/]+\/video\/?$/i.test(decoded)
    || /^\/api\/uploads\/[^/]+\/chunks(?:\/|$)/i.test(decoded);
}

function requestHeaders(request, url) {
  const headers = new Headers(request.headers);
  stripHopHeaders(headers);
  for (const name of [...headers.keys()]) {
    if (name === "host" || name === "forwarded" || name.startsWith("x-forwarded-")
      || ["x-real-ip", "true-client-ip", "cf-connecting-ip", "cf-connecting-ipv6", "cf-pseudo-ipv4"].includes(name)) headers.delete(name);
  }
  // Never trust caller-supplied forwarding chains. The backend currently uses
  // its socket IP; forwarding a client IP safely needs a separate backend review.
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.slice(0, -1));
  headers.set("Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  // Origin, Sec-Fetch-Site, Cookie, Authorization and content headers are kept.
  return headers;
}

function responseHeaders(response) {
  // Set-Cookie cannot be comma-split (Expires contains a comma). Workers exposes
  // getAll; Node's test runtime exposes getSetCookie. Append each cookie intact.
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie() : response.headers.getAll("Set-Cookie");
  const headers = new Headers(response.headers);
  stripHopHeaders(headers);
  headers.delete("Content-Length");
  headers.delete("Refresh");
  headers.delete("Set-Cookie");
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return noStore(headers);
}

export async function handleRequest(request, env, fetchUpstream = fetch) {
  const url = new URL(request.url);
  if (!isApi(url.pathname)) return env.ASSETS.fetch(request);

  // Validate before stripping hop headers so Connection: Origin cannot bypass
  // these checks. Preserve the original values for the backend's own CSRF check.
  const origin = request.headers.get("Origin");
  if ((origin && origin !== url.origin)
    || (!SAFE_METHODS.has(request.method) && request.headers.get("Sec-Fetch-Site") === "cross-site")) {
    return apiError(403, "Request origin is not allowed.");
  }
  if (legacyVideoPath(url.pathname) || /^video\//i.test(request.headers.get("Content-Type") || "")) {
    return apiError(410, "Video transfers use direct private storage. Refresh the app and use its MP4 upload or player.");
  }

  const target = new URL(API_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  const init = {
    method: request.method,
    headers: requestHeaders(request, url),
    redirect: "manual",
    cache: "no-store",
    signal: request.signal,
  };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half"; // Required by Node's streaming Request; ignored by Workers.
  }

  let upstream;
  try {
    // Never automatically follow redirects with cookies or a POST body attached.
    upstream = await fetchUpstream(target.href, init);
  } catch {
    return apiError(502, "The API is temporarily unavailable. Please retry shortly.");
  }
  const headers = responseHeaders(upstream);
  const location = headers.get("Location");
  if (location) {
    let redirect;
    try { redirect = new URL(location, target); } catch { /* Reject malformed redirects below. */ }
    if (!redirect || redirect.origin !== API_ORIGIN || redirect.username || redirect.password
      || !isApi(redirect.pathname) || legacyVideoPath(redirect.pathname)) {
      await upstream.body?.cancel();
      return apiError(502, "The API returned an unexpected redirect.");
    }
    // A safe API redirect stays on the browser's frontend origin.
    headers.set("Location", redirect.pathname + redirect.search + redirect.hash);
  }
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status, statusText: upstream.statusText, headers,
  });
}
