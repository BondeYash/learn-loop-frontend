# Local direct-R2 verification

Verified on 2026-10-01 with synthetic accounts/content, local Vite/Node services, MongoDB Atlas and private Cloudflare R2. No production deployment or load test was performed.

- Instructor browser: retried the existing MP4 session after the bucket CORS rule was saved; direct PUT, metadata/container verification and conditional R2 copy reached Ready to play. The same lesson/session was reused.
- Storage: 1,314,164-byte video/mp4 matched the declared size and upload-session metadata. The temporary object was removed; no local asset directory existed. The API started with unavailable FFmpeg paths while its legacy worker was disabled.
- CORS: GET/HEAD/PUT preflights returned 204 for the exact localhost:5173 and 127.0.0.1:5173 origins. An unlisted origin returned 403 without an allow-origin header.
- Instructor browser: published the synthetic course and assigned the test student.
- Assigned student browser: saw the course, played all eight seconds with no media error, sought to four seconds, marked completion and reloaded. Session and 100% completion persisted.
- A temporary 60-second playback lifetime verified automatic signed URL renewal while preserving the paused four-second position. The API was then restored to the normal 300-second lifetime.
- Unassigned student browser: dashboard showed zero assigned courses; opening the direct course route displayed access denied with no video element.
- Real HTTP/R2 revocation check: removing only the synthetic assignment denied a new ticket (403). The already issued unexpired URL still served a byte range (206), as documented. Assignment was restored and fresh access returned 200.
- Frontend: lint, eight tests and production build passed. Backend: 25 tests passed, including legacy regression tests and new real-MongoDB/HTTP tests with explicitly mocked object storage. Production dependency audits found zero known vulnerabilities; staged files were scanned for credentials before publication.

The short fixture does not verify large-file performance, every interruption/cancellation point, every codec/browser/device, deployed cookie/proxy settings, backup recovery or viewer capacity. H.264/AAC MP4 remains the recommended input. Signed URLs remain bearer credentials until expiry; buffered/downloaded bytes cannot be revoked.

## Cloudflare frontend/proxy preparation

The frontend now includes Wrangler 4.145.0, a Workers Static Assets configuration and a fixed Render API proxy. Seventeen tests pass (the existing eight plus nine focused proxy cases). Lint, the production Vite build, dependency audit (zero known vulnerabilities) and Wrangler deployment dry run passed. Wrangler's local runtime initially detected unsupported entry-point helper exports; moving helpers into a separate module resolved it, and the corrected runtime checks passed.

The real local Wrangler runtime served `/`, `/login` and a course deep link as SPA HTML. It forwarded read-only requests to the deployed Render API: `/api/health` returned 200 JSON, while `/api` and an unknown API route returned 404 JSON. All API responses carried private/no-store headers. The legacy video byte route returned 410 locally and a cross-origin write returned 403 before forwarding. No production account/course/session mutation or Cloudflare deployment was performed.

Proxy tests verify raw body/method/query forwarding, separate Set-Cookie headers including Expires commas/logout, original Origin and Sec-Fetch-Site, cookie forwarding, removal of forged forwarding chains, safe manual redirects, no-store handling, and JSON errors. Browser cookie behavior on the eventual Cloudflare HTTPS domain still requires a post-deployment check after the exact origin is configured in Render and R2. The backend's shared anonymous/failed-login IP limits are documented as a separate follow-up.
