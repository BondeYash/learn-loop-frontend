# Cloudflare frontend + Render API

This repository deploys a Cloudflare **Worker with Static Assets**. Vite builds the frontend into `dist`; `worker/index.js` proxies only `/api` and `/api/*` to the fixed API at `https://learn-loop-backend-qkq5.onrender.com`. MongoDB and R2 credentials stay on Render. Video PUT/GET bytes travel directly between the browser and private R2.

## Cloudflare Git setup

In **Workers & Pages**, create/import a Worker from the GitHub repository `BondeYash/learn-loop-frontend`. Choose the Workers Git build flow, not a Pages-only static upload. Use these settings:

| Setting | Value |
| --- | --- |
| Worker/project name | `learn-loop-frontend` (matches `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | Repository root (`/`; leave blank if that denotes root) |
| Build command | `npm ci && npm run lint && npm test && npm run build` |
| Deploy command | `npm run deploy:cloudflare` |
| Build variable `VITE_API_URL` | `/api` |
| Build variable `NODE_VERSION` | `22.22.2` (also recorded in `.node-version`) |
| Build variable `SKIP_DEPENDENCY_INSTALL` | `true` (the build command performs `npm ci`) |
| Build variable `WRANGLER_SEND_METRICS` | `false` (optional) |

Keep development dependencies enabled: Wrangler, Vite and ESLint are needed in the build. Do not set `NPM_CONFIG_PRODUCTION=true` or install with `--omit=dev` there. No R2 binding, database binding or application runtime secret is needed by this Worker. Cloudflare's Git integration handles its own deployment authorization; never put its token in a VITE variable or the repository.

`wrangler.jsonc` supplies the entry point and `assets.directory=./dist`; no separate Pages output-directory setting is needed. It configures `single-page-application` fallback and Worker-first routing for both `/api` and `/api/*`, so an API error or direct API navigation cannot accidentally become `index.html`. Ordinary assets/deep links use static asset routing. The Worker name can be changed later, but must match the Cloudflare project configuration.

Start with production-branch deployment. Preview domains do not automatically work with the single exact backend `CLIENT_URL`; use a separately configured backend for previews instead of adding wildcard origins. The repository does not authorize or execute an account/deployment change by itself.

Cloudflare references: [Git build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build variables and Node version](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/), [selective Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

## Configure the final frontend origin

After Cloudflare supplies the actual HTTPS URL (workers.dev or your custom domain), use its exact origin, without a trailing slash or path:

1. In the Render backend environment, set `CLIENT_URL` to that frontend origin and keep `NODE_ENV=production`. Apply/restart the Render service through its normal dashboard flow.
2. Keep the frontend's build value `VITE_API_URL=/api`. It must not be the Render URL: the browser should send API cookies to the frontend origin.
3. In R2 → the private video bucket → **Settings → CORS Policy**, add the actual frontend origin to `AllowedOrigins`. Preserve existing required origins/rules. Retain the methods/headers from [r2-local-cors.json](r2-local-cors.json): GET, HEAD, PUT; content-type, x-amz-meta-upload-id, range, if-range; expose ETag, Content-Length, Content-Range and Accept-Ranges. Keep public bucket access disabled. Do not add `*`, invented deployment domains, or `/api` paths as origins.
4. If moving from workers.dev to a custom domain later, update both `CLIENT_URL` and R2 CORS. Sign in on the chosen canonical host; host-only cookies do not move between hosts.

The backend continues to use its existing Atlas/R2 settings, `VIDEO_STORAGE_PROVIDER=r2` and `ENABLE_LEGACY_VIDEO_WORKER=false`. Render build/start remain `npm ci` / `npm start`; use its provided PORT. No FFmpeg or persistent upload disk is required for the direct-video flow. No backend code or account settings are changed by this frontend commit.

## Proxy and cookie behavior

The proxy preserves method, raw streamed body, query string, Cookie, Authorization, content headers, Origin and Sec-Fetch-Site. It preserves every Set-Cookie value individually, including Expires dates containing commas and logout expiration. The backend's host-only session cookie therefore belongs to the frontend host, with HttpOnly, production Secure, SameSite=Lax and Path=/api unchanged. Cookies and signed URLs are not logged by the Worker.

Cross-origin requests and cross-site writes are rejected; the original browser origin still reaches the backend for its independent CSRF check. If login returns `Request origin is not allowed`, first check Render's exact `CLIENT_URL`. Do not fix this by removing CSRF checks, rewriting Origin to the backend, changing SameSite to None, or enabling wildcard CORS.

The destination is fixed in source, not taken from a URL parameter, Host or forwarded header. Incoming hop headers and claimed forwarding chains are removed; forwarded host/protocol are derived from the request URL. Upstream fetches use `redirect: manual` and `cache: no-store`. Safe redirects back to that same API are rewritten to relative `/api` paths; other redirects return a safe 502 without forwarding credentials elsewhere. API responses, cookies, errors and signed-link JSON get private/no-store browser and CDN headers. No Cache API or response cache is used.

Old `/api/lessons/:id/video` proxy streams and `/api/uploads/:id/chunks/...` byte transfers are rejected. Current `/playback` and `/direct-uploads` metadata/link endpoints remain available. Ready legacy R2 objects still work through the current signed player. Do not rewrite signed R2 URLs through this Worker.

## Backend follow-up: client IP and rate limits

The current Express backend does not enable `trust proxy`. Authenticated API requests already have separate per-account budgets, but anonymous requests and failed logins use the Render socket/edge IP. Multiple visitors can therefore share these limits. The Worker deliberately does not trust caller-provided X-Forwarded-For or claim that it fixes client-IP attribution.

Before wider public use, review the actual Cloudflare → Render forwarding chain and direct access to the Render hostname, then implement a narrowly trusted, spoof-resistant client-IP strategy in the backend. Do not blindly set `trust proxy=true`, trust a freely supplied header, raise limits as a substitute, or assume a fixed hop count without validating every entry path. A shared limiter store is also needed before scaling API replicas. This is a separate backend change and has not been made here; it does not prevent the initial same-origin cookie flow.

## Local validation without deploying

```sh
npm ci
npm run lint
npm test
npm run build
npm run check:cloudflare
```

`check:cloudflare` runs `wrangler deploy --dry-run` and writes an ignored local bundle under `.wrangler/dry-run`. It does not deploy. To smoke-test the built Worker locally:

```sh
npm run dev:cloudflare
```

Open http://127.0.0.1:8787 for static/deep-link checks and `/api/health` for a read-only check against the fixed live Render service. The Worker dev command is not the isolated local API environment: do not register users, change courses, or test uploads there without intending to use the live backend. For ordinary local development against localhost:5000, keep using `npm run dev` on port 5173.

For a separately authorized manual deployment after a successful build, `npm run deploy:cloudflare` runs Wrangler deploy. This command was not executed as part of preparing this repository.

## After the first deployment

Verify the final frontend `/api/health` returns API JSON, deep links such as `/login` and `/courses/...` load, and API 404/401 responses stay JSON with no-store headers. Check HTTPS login, reload, logout and session expiry; confirm the session cookie's attributes and that no browser API requests go directly to Render. Then test instructor direct MP4 upload/publication/assignment, student play/seek/renewal and unassigned denial on the real domains. Check actual mobile/desktop codec support.

A sleeping free Render service may exceed the client's 30-second timeout while waking; retry after it wakes. API proxy requests consume Worker requests and provider limits still apply; direct R2 video delivery avoids routing video bytes through either API or Worker. No uptime, zero-cost-at-any-volume or concurrency guarantee is implied. See [verification evidence](verification.md) for the local checks and their limits.
