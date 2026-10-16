# Platform reliability and UI audit — 16 October 2026

This review covers the existing student, instructor and administrator flows in both Learn Loop repositories. Tests use disposable local databases, synthetic accounts, local video fixtures and mocked external providers. No live charge, refund, email delivery or paid AI call was made.

## Changes delivered

| Area | Problem found | Change |
| --- | --- | --- |
| Sign-in | Anonymous `/auth/me` 401 responses used the failed sign-in allowance shared behind the API proxy. | Session reads and logout no longer use the failed-write budget. Failed writes have separate normalized-account/action budgets. Malformed password objects return 400. |
| Course progress | Unfinished video uploads counted toward completion. Concurrent first completions could overwrite the cached percentage. | The course outline and progress share the same available-lesson definition. Completion updates use an atomic set union and percentage calculation; duplicate-upsert races recover. |
| Course opening | Opening a course required a sequential second request for progress. Progress calculation repeatedly searched the lesson array. | Accessible student course responses include progress, reuse the fetched curriculum, and use maps for lesson lookup. The client retains compatibility with older responses. |
| Playback | A temporary course refresh or early signed-link renewal failure removed the playing video. | Temporary refresh failures retain the lesson and player. Early renewal retries preserve an unexpired ticket, position and settings. Access denials and actual link expiry stop playback. |
| Background requests | Course polling ran in hidden tabs; payment polling overlapped slow requests and continued after payment verification. | Student course refresh interval changes from 15 to 60 seconds, pauses while hidden/in flight, and revalidates on return. Payment reads are single-flight, abort stale reads before manual reconciliation and stop after terminal status. |
| Course navigation/editing | Changing route IDs could retain the previous page's state. A failed edit load displayed a blank editable form. | Page state remounts when the pathname changes. A failed/archived edit load provides recovery without an editable default form. |
| Doubt Dost | The course picker loaded the whole published marketplace before filtering to accessible courses. | It requests the new `enrolled=true` scope; access checks and payment waivers remain enforced. |
| Upload allocation | Concurrent tabs could exceed the three unfinished-upload limit; expired sessions occupied capacity. | A short, per-owner MongoDB lease serializes allocation across direct and legacy upload endpoints. Expired sessions are excluded; actual transfers remain concurrent. |
| Password recovery | SMTP could leave requests waiting and an older failed delivery could invalidate a newer reset link. | Connection, greeting, socket and overall delivery deadlines; safe 503 recovery; reset cleanup conditional on this request's token hash. |
| Database queries | Course-assignment and owner/status reads lacked matching indexes. | Added course/student enrollment, owner/status video, and published/instructor course indexes. |
| Initial download | Home eagerly imported private learning, payment and administration screens. | Secondary routes load on demand. A recoverable page boundary provides Reload and Home actions after render/chunk failure. |
| Readability and mobile UX | Several captions were 7–11px, mobile fields could trigger iOS zoom, and larger labels misaligned dashboard values. | Standardized small copy around 13px, supporting copy 15px, key actions 14px and fields 16px. Key controls are at least 44px. Statistic headers reserve label space; mobile admin sections wrap into a visible grid and chat navigation keeps Payments in view. Landing imagery, chat controls, contrast, focus and zoom layouts were checked. |
| Monitoring | Health checks resolved sessions before responding, obscuring database outages. | Session-independent `/api/health` liveness and `/api/ready` connection-state readiness. Health includes the short Render commit ID when supplied by Render. Readiness is not a provider or database-query probe. |

## Evidence

- Backend: 177 passing tests against real isolated MongoDB and HTTP, including signed Razorpay webhooks with a synthetic provider, individual free access grants, course authorization, upload races, reset-token races, Groq failures and PDF publishing/retrieval.
- Frontend unit tests, lint, production build and Cloudflare dry run passed. All **22 browser suites** passed after the documented fixes and fixture corrections.
- Browser suites cover acquisition, assessments, discovery, course authoring, dashboards, chat/knowledge base, notifications, landing recovery, mock-test extraction/recovery, payments, enrollment, private playback and the new held-request reliability cases.
- Final automated accessibility scans: **134 states, zero reported violations**. The signup link and keyboard-scroll findings were corrected and rechecked. See [machine-readable evidence](platform-audit-evidence-2026-10-16.json) for the retained earlier test attempts and incomplete rule IDs.
- UI coverage includes 320–1920px widths, light/dark themes, 200% zoom, keyboard dialogs, reduced motion, forced colors and mobile checkout. axe-core scans use WCAG 2 A/AA, 2.1 AA and 2.2 AA rule tags. Automated scans do not certify accessibility; incomplete/manual checks still need human review, including caption availability in instructor videos and real device/browser testing.
- Initial main JavaScript chunk: **524.22 → 339.74 kB** (about 35% smaller); gzip **167.62 → 117.38 kB** (about 30% smaller). This measures the main chunk, not every later feature download or real network page-load time.
- Local warm load experiment: 50 text lessons, 3,001 enrollments, 40 authenticated course opens at concurrency 10: **0 errors, p50 217.3ms, p95 283.3ms, max 334.2ms**. The assignment query used `course_1_student_1` and examined one key/document. This is a local sanity check, not production capacity certification.
- Both production dependency audits report zero known vulnerabilities. Compatible tooling updates reduce the full frontend audit from 11 to 7 findings; the remaining findings are in the Tailwind 3 build dependency tree. npm proposes a Tailwind 4 upgrade, which needs a separately validated migration. Build tools are not included in the served app runtime.

## Remaining work requiring production/account evidence

1. **Hosting capacity:** measure Render cold starts, peak traffic, MongoDB connections and memory in the actual deployment. A warm local benchmark cannot establish production throughput. Increasing hosting capacity needs the owner's account/budget decision.
2. **Proxy identity and scaling:** validate trusted network attribution across Cloudflare and Render before using per-client IP limits. Existing global limits still share an anonymous proxy allowance. In-memory rate/concurrency budgets need a shared store before running multiple instances.
3. **Provider operations:** verify a real low-value live Razorpay purchase and refund, webhook delivery history, Groq quota behaviour, R2 permissions and actual password-reset delivery in the owner accounts. Test SMTP reachability on the selected Render plan; an HTTPS mail provider may be necessary where SMTP is restricted.
4. **Data operations:** confirm automated MongoDB/R2 backups, retention and a restore drill. No production backup or migration was executed during this review. Confirm the new MongoDB indexes were built in production.
5. **Storage limits:** direct-upload file size/type are verified after upload; strict limits before storage ingestion still require a provider/browser-verified upload policy. New signed links enforce current access, but an already issued URL remains usable until its expiry.
6. **Large marketplaces and source content:** authenticated full-course lists still need product pagination when the catalog grows substantially. Scanned PDFs need OCR; free AI quotas and the app's own monthly allowance remain finite. Instructor-provided videos need captions to serve deaf/hard-of-hearing learners.

## Reproduce

Use Node 22.13+ and an owned MongoDB test instance on port 27018; never point tests at production. In the backend run `NODE_ENV=test CLIENT_URL=http://127.0.0.1:5186 npm test`. In the frontend run `npm test`, `npm run lint`, `npm run build` and `npm run check:cloudflare`.

Browser fixtures use Playwright, Chrome and ffmpeg. Run `PLAYER_EVIDENCE_DIR=/tmp/learn-loop-ui python3 tests/visual_refresh_browser.py`; add `PLATFORM_A11Y=1` for its accessibility report. To scan another fixture suite at screenshot checkpoints, run `PLAYER_EVIDENCE_DIR=/tmp/learn-loop-payments python3 tests/audit_checkpoints.py tests/payments_browser.py`. Inspect each generated JSON report as well as the screenshots; reports retain incomplete checks rather than treating them as passes.
