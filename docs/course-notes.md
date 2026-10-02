# Course creation, PDF notes and loading states

Create a course by entering its details and choosing **Continue to content**. A default Lessons module is ready for video lessons; extra modules are optional. Upload lessons or PDF handouts, then use **Assign students**. This shares ready content with registered student addresses without a separate publish click. Internal readiness/assigned-only checks remain on the server. Existing course access is preserved. Optional pause/reopen and archive controls are available under **Access and archive controls**; restoration keeps access closed for review.

Owners/admins can upload multiple course-level PDFs under **Course notes**. Limits: twenty notes/course, 10 MiB each, 1–500 pages, unencrypted, without recognized scripts or embedded files. Upload progress, storage checks, errors and same-selection retry are shown. Failed uploads never appear in student lists. After a reload, remove a failed entry before choosing it again. Assigned students can use **Open PDF** or **Download** for ready notes. Opening requires a new tab/popups to be allowed. PDF downloads are allowed; the video download-deterrent request does not apply to them.

Uploads use the existing private R2 bucket through the API; note links expire after five minutes. No public bucket or frontend secret is introduced. Already-issued links/received bytes cannot be revoked immediately. Parsing/active-content checks are not antivirus or proof of compatibility with all PDF readers. Notes do not contribute to lesson completion percentages.

Loading placeholders cover student/instructor/admin dashboards, course lists and course details in light/dark themes. Loading text is announced once through a status region, placeholders are decorative, and reduced motion disables their pulse. Errors, retry and empty states replace placeholders when requests finish.

## Release evidence

Frontend lint, eighteen auth/video/proxy checks, production build and non-deploying Worker dry-run pass. The proxy regression includes multipart PDF bytes and boundary preservation. Backend has 48 passing tests, with real disposable MongoDB/HTTP and mocked R2. Isolated Chrome checks cover details → multiple PDFs → assignment; storage-failure retry; student read-only UI/open/download; mobile themes; skeleton loading announcements/reduced motion/error/retry/empty states; and video playback/renewal/fullscreen.

Optional local UI checks require installed Python Playwright, Google Chrome, ffmpeg and frontend dependencies:

```sh
python3 tests/course_flow_browser.py
python3 tests/student_player_browser.py
```

Both scripts start/stop an isolated loopback fixture server on port 5186, use synthetic accounts/content, intercept all API/media requests and block external browser requests. They are UI checks; they do not prove deployed permissions, R2, production cookies, actual PDF viewers, all devices, assistive technology or load capacity. Screenshots use a temporary directory unless `PLAYER_EVIDENCE_DIR` is set.

Backend-first rollout is required for the new endpoints and sharing action. No destructive migration or new mandatory environment variable is needed; startup creates note indexes. Existing bucket credentials need object access for `notes/`. Preserve private bucket access and exact-origin GET CORS, and never put an incoming-object expiry on referenced `notes/` or `videos/` objects. The operator retains live deployment checks.

Read the [backend PDF/rollout guide](https://github.com/BondeYash/learn-loop-backend/blob/main/docs/course-notes.md) and [current source-grounded readiness/security review](https://github.com/BondeYash/learn-loop-backend/blob/main/docs/security-review-2026-10-02.md). The review lists remaining production gaps and acceptance tests; it does not imply those fixes were implemented.
