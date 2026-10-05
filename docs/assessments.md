# Chapter quizzes and timed mock tests

This slice provides instructor/admin authoring and student practice for generic government-exam courses. No question bank or official CCC content is added. Course ownership and current student entitlement continue to be enforced by the backend.

## Authoring

Open **Manage assessments** from course curriculum or owner preview. `/instructor/courses/:id/assessments` lists authored drafts and published assessments. Create a chapter quiz attached to an existing module, or a timed course mock test. Add question text, 2–6 options, a correct answer, an explanation and optional topic tag. Drafts may be incomplete or empty; saving persists them across refresh. Publishing requires complete reviewed content. Saving a published assessment as a draft stops new attempts. Existing attempts keep their original authored version.

Cancel uses an in-app confirmation for unsaved changes. Server conflicts/errors retain the form so the author can review or reload. Save drafts before leaving; unsaved edits are not automatically persisted. Limits are 40 assessments per course (including drafts), 40 questions per assessment, 1–180 timed minutes and 100 attempts per learner/assessment. Draft deletion/reclamation is pending.

## Student practice

Open **Open assessments** from an entitled course. `/courses/:id/assessments` lists published chapter quizzes and course mock tests plus own attempt history and topic summaries. Start requires confirmation explaining question count, timer and scoring. A retried start resumes the active attempt. Existing attempts can also be resumed directly from history.

`/assessment-attempts/:id` displays one question at a time with native radio controls, saved-answer status and previous/next navigation. Each selection is saved on the server; interrupted saves expose retry. Refresh and leaving retain saved answers, and a timed deadline keeps running. The display derives from server time and a monotonic browser clock; the server enforces the deadline. An elapsed timer retrieves the result automatically; failed submissions can be retried. Submission confirmation includes the unanswered count, and cancel leaves the attempt active. Expired sessions return to sign-in with the attempt destination preserved. Fresh access denial removes the attempt content.

Scoring is +1 correct, 0 incorrect/unanswered with no negative marking. Ended attempts show score and question explanations. Answer keys are not supplied by active learner endpoints. A revision guard avoids replacing a newer answer with a stale poll response. Result/history labels describe actual saved actions and question versions; quiz submission does not change lesson completion or promise exam readiness.

The weak-topic summary includes only explicit author tags below 70% correct across the latest 100 submitted/timed-out attempts. Untagged questions are excluded; history has 20 entries per page. Current course access is required to review history and results.

## Checks and deployment limits

Run `npm run lint`, `npm test`, `npm run build` and the non-deploying `npm run check:cloudflare` after building. `tests/assessments_browser.py` exercises actual author/student components in Chrome with synthetic intercepted APIs: drafts/publish, reload, validation retention/cancel, instructor/admin roles, light/dark narrow/desktop and zoom layouts, interrupted answer/submit, result explanations, timer expiry/refresh, login return and denied access. Backend integrity is tested separately against isolated MongoDB/HTTP.

No production assessment content, course visibility/price, provider configuration or external service is changed. These frontend routes require the matching backend assessment APIs. GitHub publication and mocked browser success do not establish deployed API/authentication/payment readiness. Practical exercises, saved learning place/progress and private questions are now delivered in [learning support](learning-support.md).

On 2026-10-05, final lint, frontend unit tests, production build and Cloudflare dry run passed. The assessment browser flow and existing public catalog/sample, test/live payment and private-player regressions passed in isolated Chrome 151. The backend's complete 114-test suite and final focused 9-test assessment run passed. Local light/dark authoring/result screenshots were inspected visually; screenshots use synthetic fixtures and remain local QA evidence.
