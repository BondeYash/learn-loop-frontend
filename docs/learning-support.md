# Practical tasks, private course questions and resume

The course curriculum links owners/admins to `/instructor/courses/:id/support`. Entitled students use `/courses/:id/support` from their learning page. The support page loads separately from the main bundle and uses the existing theme, native inputs, focus states and decision dialogs.

Owners author real task instructions, up to twenty optional checklist items and an optional same-course lesson. Students can save a private text/checklist response and explicitly mark self-reported completion. The UI explains that this is ungraded and does not certify competence, complete a lesson or change an assessment score. Edited instructions create a new task version; older records are retained. Nothing is auto-generated or seeded. Authors can hide tasks; forty task slots are available per course.

Course questions are visible only to the requesting student and course owner/admin. The owner writes replies manually. Students can resolve or reopen their threads with explicit confirmation. Other students cannot read these questions. The UI communicates fifty retained threads per student/course and ten question requests per hour; replies are bounded to ten per thread. Owner lists show student names, without copying private email addresses. No external message, attachment, automated answer or response-time promise is created.

Student practical records, question creation and owner replies use stable UUIDs for retrying the same payload. Local text remains after interrupted responses and pending writes are disabled. Task/question cancellation uses the shared decision dialog; Escape keeps unsaved input. Server revisions reject stale task, record and thread changes. Support is not available merely because a course is publicly discoverable: assignment/public enrollment, publication/archive and any required verified payment remain server-enforced.

## Honest progress

Course cards and the dashboard display server-derived completed/current lesson counts. Continue links to the latest available saved lesson; deleted/unavailable targets disappear or fall back to an available lesson. Course playback restores saved position, and authorized learner visits, pauses, seeks and periodic playback save the learning place. Save errors offer an explicit retry; ordinary course polling does not steal another tab's revision. Public samples and owner previews do not save a student's position.

Completion remains an explicit student action. Passive playback, questions, practical self-reports and quiz/mocks do not award lesson completion. Percentage follows the current curriculum rather than a stale cached count. Resume is a convenience, not verified watch time or analytics.

## Verification

Run the existing lint, unit, production build and Cloudflare dry-run checks. `python3 tests/learning_support_browser.py` uses installed Python Playwright, Chrome, ffmpeg and a loopback Vite server. All API/media responses are synthetic; unexpected external requests are blocked. Its MP4 fixture supports byte ranges, as seeking requires accurate partial responses.

The support flow covers owner/admin authoring, retained input and cancellation, accepted-response interruption and stable retries for records/questions/replies, resolve/reopen, actual saved-video restore after reload, explicit lesson completion, stale destinations, expired-session return, revoked-access clearing, both themes at 320px/1280px and 200% zoom. Existing private-player, assessment, public-catalog/enrollment, payment and design/course-flow browser checks cover integration with prior features. Backend tests independently verify persisted privacy, access, concurrency, bounds and purge using disposable local MongoDB.

Deploy the matching backend before or with this frontend through the existing pipeline. Real owner/student acceptance testing needs authored content and normal authenticated sessions; mocked checks and unauthenticated deployment reads do not establish production learning progress or replies.
