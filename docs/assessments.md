# Chapter quizzes and timed mock tests

This slice provides instructor/admin authoring and student practice for generic government-exam courses. No question bank or official CCC content is added. Course ownership and current student entitlement continue to be enforced by the backend.

## Authoring

Open **Mock tests and quizzes** on an instructor course card, or **Manage mock tests** from curriculum/course preview. `/instructor/courses/:id/assessments` lists authored drafts and published assessments. Choose **Create mock test** for a timed course test (30 minutes initially, editable 1–180), or **Create chapter quiz** for an existing module. Add question text, 2–6 options, a correct answer, an optional explanation and an optional topic tag. Drafts may be incomplete or empty; saving persists them across refresh. Publishing requires complete question content and correct answers; individual review and explanations are optional. Saving a published assessment as a draft stops new attempts. Existing attempts keep their original authored version.

Cancel uses an in-app confirmation for unsaved changes. Server conflicts/errors retain the form so the author can review or reload. Save drafts before leaving; unsaved edits are not automatically persisted. Limits are 40 assessments per course (including drafts), 40 questions per assessment, 1–180 timed minutes and 100 attempts per learner/assessment. Draft deletion/reclamation is pending.

## Student practice

Open **Mock tests** from an entitled course card or the course header. `/courses/:id/assessments` lists published chapter quizzes and course mock tests plus own attempt history and topic summaries. Start requires confirmation explaining question count, timer and scoring. A retried start resumes the active attempt. Existing attempts can also be resumed directly from history.

`/assessment-attempts/:id` displays one question at a time with native radio controls, saved-answer status and previous/next and numbered question navigation. Each selection is saved on the server; interrupted saves expose retry. Refresh and leaving retain saved answers, and a timed deadline keeps running. The display derives from server time and a monotonic browser clock; the server enforces the deadline. An elapsed timer retrieves the result automatically; failed submissions can be retried. Submission confirmation includes the unanswered count, and cancel leaves the attempt active. Expired sessions return to sign-in with the attempt destination preserved. Fresh access denial removes the attempt content.

Scoring is +1 correct, 0 incorrect/unanswered with no negative marking. New mock attempts reveal the correct option immediately after the server saves the first answer to that question. The correct option turns green; an incorrect selected option turns red, with written Correct/Incorrect labels. That first saved choice is final, including after refresh or returning to the question. Unanswered questions have no answer feedback or keys. Chapter quizzes and attempts started before this change keep editable answers and reveal keys only when the attempt ends. Ended attempts show the score, correct answers and any supplied explanations. A revision guard avoids replacing a newer answer with a stale poll response. Result/history labels describe actual saved actions and question versions; quiz submission does not change lesson completion or promise exam readiness.

The weak-topic summary includes only explicit author tags below 70% correct across the latest 100 submitted/timed-out attempts. Untagged questions are excluded; history has 20 entries per page. Current course access is required to review history and results.

## Checks and deployment limits

Run `npm run lint`, `npm test`, `npm run build` and the non-deploying `npm run check:cloudflare` after building. `tests/assessments_browser.py` exercises actual author/student components in Chrome with synthetic intercepted APIs: drafts/publish, reload, validation retention/cancel, instructor/admin roles, light/dark narrow/desktop and zoom layouts, interrupted answer/submit, result explanations, timer expiry/refresh, login return and denied access. Backend integrity is tested separately against isolated MongoDB/HTTP.

No production assessment content, course visibility/price, provider configuration or external service is changed. These frontend routes require the matching backend assessment APIs. GitHub publication and mocked browser success do not establish deployed API/authentication/payment readiness. Practical exercises, saved learning place/progress and private questions are now delivered in [learning support](learning-support.md).

On 2026-10-05, final lint, frontend unit tests, production build and Cloudflare dry run passed. The assessment browser flow and existing public catalog/sample, test/live payment and private-player regressions passed in isolated Chrome 151. The backend's complete 114-test suite and final focused 9-test assessment run passed. Local light/dark authoring/result screenshots were inspected visually; screenshots use synthetic fixtures and remain local QA evidence.


## Instructor-to-student mock-test flow — 2026-10-06

1. Instructor: **My courses → Mock tests and quizzes → Create mock test**. Enter the test title and duration. Add each question, 2–6 distinct options, its correct answer and an optional explanation. Save a draft while preparing; publish complete content without individual review checks. **Back to tests** returns to the draft/published list. Admins can manage a course through its curriculum or the same owner route.
2. Student: open a course you can access, then **Mock tests**. Choose the published named mock, read its instructions and confirm start. Answer with the radio options, wait for saved status, and use numbered/previous/next navigation. Refresh or use history to resume the same active attempt; the timer continues.
3. Submit and confirm, or let the timer expire. Review saved score, correct answers/explanations and history. In new mock attempts, each answered question reveals its correct option while active; unanswered keys and explanations remain hidden until the attempt ends. Editing a published test affects future attempts only; started attempts retain their original questions/explanations and feedback rules.

Drafts cannot be started. A published test does not change course sharing, enrollment or payment. If the course is unshared, use curriculum to prepare materials/choose students. Paid/private/free access remains server enforced. No production question bank or student accounts are created by this feature.

First-save retries now retain a single test after an accepted response is interrupted. New draft/publish requests reuse a stable UUID; changed payloads on an already saved creation request must be resolved by returning to the list and editing the saved test. Update conflicts preserve the form. Navigation aborts pending editor responses, and changing/losing course access clears stale course/editor content.

For actual local end-to-end checks, run `MOCK_TEST_BACKEND_DIR=/path/to/backend python3 tests/mock_test_e2e_browser.py` with a disposable local MongoDB on port 27018, the existing installed Chrome/Playwright/ffmpeg and both matching checkouts. The script uses real cookie login, real Express endpoints and MongoDB persistence, forwarding API calls to a random loopback backend. It tests instructor authoring through eligible student attempts/results, draft invisibility, invalid duration/question content, interruption and duplicate clicks, refresh, immutable versions, timer expiry, other-course/user denial, revoked entitlement and mobile/light/dark/zoom. Unexpected external calls are blocked. Its fixture changes only a synthetic deadline to exercise timeout quickly; no production credentials, connection strings or providers are used. The fixture database and test processes are shut down afterward. Existing assessment/browser regressions separately cover quiz flows, auth return and provider/storage mocks.

Final backend checks pass 133 tests, including 10 focused assessment tests. Frontend lint/unit/build/Cloudflare dry-run and browser checks are publication gates. Public deployment asset/API reads are distinct from a real hosted instructor/student acceptance session, which remains unverified without normal authorized accounts.

## PDF, Excel and CSV import — 2026-10-06

The assessment editor includes local digital/scanned PDF extraction, English/Hindi OCR, automatic standard spreadsheet mapping, templates and optional editing in groups of five. Append adds directly; replacing existing questions requires confirmation. Source metadata survives draft saves. Complete imported content publishes without individual review checks on both frontend and backend. [Import behavior, resource bounds, privacy, dependency licenses and actual-file verification](assessment-import.md).

## Immediate mock-answer feedback — 2026-10-07

The start confirmation explains that a new mock attempt locks each first saved answer and reveals its correct option. The attempt uses the server's snapshotted `feedbackMode`, so resuming an older attempt retains its original rules. Feedback appears only after an accepted save; a failed save offers retry without guessing the answer key. Identical retries are safe. A conflicting first choice reloads the authoritative answer. The student can still skip unanswered questions, use previous/next or numbered navigation, and submit explicitly. The original timer continues during feedback, navigation and reload. Final scoring uses saved first choices, with incorrect and unanswered questions earning zero.

Native radio controls keep their option names and link to written feedback. Keyboard focus moves to feedback after a save, and to the question heading when navigating. Color and text work in both themes. Locked questions have no clear-answer control; chapter quizzes and legacy attempts retain it. Active mock feedback contains only the correct index and correctness of questions already answered by this learner, with no explanations or import metadata.

`tests/mock_feedback_browser.py` uses real cookie login, local Express/MongoDB and synthetic instructor/admin questions, blocking outside requests. It covers correct/incorrect styles and text, keyboard navigation, 320px/desktop/200% layouts, lost accepted responses and retry/conflict recovery, stale polls, reload/browser Back, skipped questions, submission cancellation, final scoring, another learner's denial and expired-session cleanup. `tests/assessment_feedback_assertions.py` checks answered-only privacy in this test and the existing real mock/import browser flows. The complete 142-test backend suite, frontend unit tests, lint and production build pass locally. These routes require the matching backend update; no migration changes older attempts, and hosted acceptance remains unverified. No push or deployment is performed by these checks.

Final local regression checks also pass the non-deploying Cloudflare dry run, real instructor/student mock flow, existing quiz/legacy attempt browser flow, CSV/XLSX/digital PDF/English-Hindi OCR import, and recovery with the original 100-question PDF through explicit ranges, reviewed publication and student scoring. Feedback screenshots were visually inspected in both themes. The prior importer implementation, parser fixtures/tests and import documentation remain unchanged; only its browser privacy assertion adopts the new answered-only feedback contract.

## Optional explanations and publishing — 2026-10-08

Explanation fields are labelled optional in both the editor and importer. Missing source explanations do not block publication. Publish automatically checks question structure and displays a focused error summary linking to incomplete questions. Saving drafts still permits unfinished questions. Ended attempts show supplied explanations without rendering empty explanation paragraphs.

Frontend validation tests cover omitted/blank explanations, CSV and PDF content without explanations or review checks, answer/option requirements and question limits. The authenticated instructor/student mock browser flow verifies draft/reload, publication without explanations, clickable validation errors, version snapshots, student scores, timers and both themes/mobile layouts.

Verification for this change passes frontend lint, all 44 unit tests, the production build and the Cloudflare dry run. Real cookie/API/MongoDB browser checks also pass CSV/XLSX/PDF/English-Hindi OCR import and instructor/admin recovery of a synthetic 100-question PDF bank, including publication without entering explanations and student scoring.

## Top actions and session responsiveness — 2026-10-08

Publish, Save draft, Import and Add question now sit in a sticky toolbar at the top of the editor, with a question count and automatic readiness status. Imported questions are collapsed and can be expanded to edit; no review checkboxes are required. The file importer exposes its actions at the top, automatically maps standard spreadsheet headers and uses the filename as the test title when the title is blank. The Back to curriculum control is a full-size button with an arrow and the course-specific destination.

The app restores its HttpOnly cookie session once on opening and no longer polls /auth/me every minute. Login/register remain immediately usable during restoration. Cross-tab account changes, password-change events and API authorization still update the session. Concurrent session requests are deduplicated.

Verification for simplified publishing passes all 45 frontend tests, lint, production build and the Cloudflare dry run, plus 20 focused backend assessment/feedback tests. Real cookie/API/MongoDB browser flows pass CSV/XLSX/digital PDF/English-Hindi OCR imports, instructor/admin 100-question recovery, unchecked publication, student scoring, session expiration, double-click protection and mobile/desktop/light/dark layouts. A browser clock advanced beyond one minute confirms no periodic session request. The back button has a 44px minimum target and the action toolbar remains visible while scrolling.
