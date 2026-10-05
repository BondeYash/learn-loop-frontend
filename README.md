# LessonLoop frontend

The React app for LessonLoop, a government-exam learning platform. Visitors can explore explicitly public courses and selected samples; instructors manage courses, MP4/text lessons, PDF notes and assignments; students open their available materials and track completion. Responsive light/dark screens use system typography and a restrained teal accent. See [public discovery, owner controls and rollout](docs/public-discovery.md).

Admin-only instructor provisioning, access controls, user/course/video oversight and recoverable course archive/restore are now included. Read [admin management and rollout](docs/admin-management.md). Existing instructors/data are preserved; the operator runs the protected first-admin setup.

Backend: [BondeYash/learn-loop-backend](https://github.com/BondeYash/learn-loop-backend).

Course creation is now details → lessons/PDF notes → assign students, without a separate required publish step. Owners/admins can add private course handouts; assigned students can open/download ready PDFs. Dashboards/course screens include accessible light/dark loading skeletons and real retry/empty states. See [current flow, limits, rollout and checks](docs/course-notes.md).

Reference-led dashboard/course design, private course thumbnail upload/replace and accessible in-app dialogs are included. See [behavior, verification and rollout](docs/design-and-thumbnails.md).

## Run locally

Use Node.js 22.12+. From this repository root, run `npm ci`, copy `.env.example` to `.env` only if absent, then `npm run dev -- --host 127.0.0.1 --strictPort`. Start the backend separately on port 5000. Open http://localhost:5173. No parent client/server directory is needed.

Keep `VITE_API_URL=/api`; Vite proxies local API requests. All VITE variables are public, so never put secrets here. Stack: React 18, Vite 7, React Router 7, Redux Toolkit, Axios and Tailwind CSS.

## Video flow

Upload precompressed H.264/AAC MP4 only (up to 2 GiB/four hours). Convert WebM/MOV/MKV externally and preview with sound. The browser validates the container header and decodes the first frame, then sends the file directly to private R2 using a temporary URL from the API. This is not full codec/security validation; target-browser compatibility still matters.

Progress, cancel, retry and rechecking a completed upload are available. Interrupted single PUT transfers restart from the beginning; there is no chunk resume or server conversion. The backend verifies object metadata/header and freezes the ready object under a different key.

Assigned students receive short-lived signed playback URLs. The player renews before expiry and preserves position; access denial or network errors expose retry. Revocation stops new tickets but already issued URLs remain bearer credentials until expiry. Previously downloaded bytes cannot be revoked.

Student playback hides supported download actions and shows a partial learner-code watermark, including wrapper fullscreen where available. These discourage casual sharing; they cannot prevent downloading or screen recording. See [behavior, browser limits and isolated player checks](docs/student-video-deterrents.md).

## Verify

Run `npm run lint`, `npm test`, `npm run build` and `npm audit`. Eighteen checks cover authentication races, MP4 validation and the Worker proxy, including multipart PDF preservation, cookies, CSRF headers, forwarding-header sanitization, fixed routing, unsafe redirects and no-store behavior. They are unit tests, not deployed-browser tests.

The development API must be configured for private R2 and Atlas/local MongoDB. Apply [local CORS](docs/r2-local-cors.json) in the R2 bucket dashboard; keep the bucket private. Cloudflare Workers Static Assets deployment and a fixed same-origin `/api` proxy to the live Render API are configured in `wrangler.jsonc` and `worker/index.js`. See [exact deployment settings](docs/deployment.md). Run `npm run check:cloudflare` after building for a non-deploying bundle check. Actual deployed origins must be configured explicitly. Cross-site API cookies are not the supported setup.

## Current verification scope

The production build and lint pass. After the exact local bucket CORS rule was saved, the retained synthetic MP4 uploaded through the instructor browser, passed real R2 confirmation, was published and assigned, and played to the end in the student browser. Native seeking, completion persistence after reload and automatic signed URL renewal were verified. No production/load test or all-browser/all-codec guarantee is claimed. Captions, adaptive bitrate, quizzes, payments and certificates are outside scope.

Live evidence and limits: [local verification record](docs/verification.md).

Current public enrollment and payment-record behavior: [Stage 2 documentation](docs/public-enrollment.md).
