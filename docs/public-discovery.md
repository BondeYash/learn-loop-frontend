# Public course discovery — Stage 1

The homepage presents LessonLoop as a government-exam learning platform. CCC is the first ready offering according to the owner; course names, categories, language, prices and samples come from the backend inventory. There are no invented courses, reviews, results, instructor credentials or launch dates.

## Visitor flow

`/` and `/catalog` work without signing in. Visitors search courses, filter actual inventory categories and paginate results. `/catalog/:slug` shows the actual INR price, language, course description/audience, learning outcomes, prerequisites, curriculum, authored public instructor profile, configured support/policy links and a sample when selected. Blank optional fields use honest empty states or omit absent links. The site includes light/dark themes, keyboard focus/skip navigation and responsive layouts.

Text samples render as escaped plain text with preserved line breaks. Video samples use the public selected-preview endpoint and the same expiring-ticket player as private lessons, without a learner identity overlay. When fresh sample access is withdrawn the player removes its video and offers retry. Previously issued URLs remain usable until expiry; already delivered bytes cannot be recalled.

Stage 1 course access is arranged by an instructor. Public pages say this explicitly and let existing learners sign in/open their course; the selected course destination is retained for sign-in. Public self-service signup/payment/automatic enrollment is Stage 2. This release does not promise a working public checkout or fix the existing live Stripe 400.

## Owner flow

Course details include Private/Public discovery controls (Private by default), actual exam name, summary/audience, explicit public teaching identity, support/policy links and a same-course sample selector. Public discovery only opens when the course is published and unarchived. Saving Public on an already published course shares the page/sample immediately. Full learning content still uses the current assignment/payment rules.

The curriculum supports creating and editing plain-text lessons as well as existing video/PDF management. To add a text sample, create a text lesson, write/save its content, then select it in course details. For a video sample, complete its MP4 upload first. Returning the selection to No public sample stops fresh preview requests. Existing account profile/contact information is not filled into public fields automatically. Existing Free/Paid controls and saved prices are preserved.

## Isolated checks and launch

Run `npm run lint`, `npm test`, `npm run build` and `npm run check:cloudflare`. The last command is a deployment dry run.

`python3 tests/public_catalog_browser.py` uses the existing installed Python Playwright/Chrome/FFmpeg harness, a loopback Vite server and synthetic course/account/media responses. It blocks unexpected external/API calls and checks anonymous browsing, search/category filters, useful text/video samples, plaintext escaping, empty/error/retry/unavailable states, retracted-video denial, explicit public owner settings, text authoring, retained paid pricing and new-course private/free defaults. It checks 320px/1280px light/dark public layouts and 320px owner forms. `python3 tests/student_player_browser.py` separately regresses existing private playback/renewal, denial and watermark/fullscreen behavior. Synthetic test prices, bios, text and course names are never production inventory.

Stage 1 verification passed: frontend lint, existing authentication/video/proxy tests, production build and Cloudflare deployment dry run; both isolated public-catalog and private-player browser checks in Chrome 151. Homepage, catalog and course pages fit 320px/1280px with the actual light/dark theme asserted across reloads. No unexpected protected API/external requests or browser JavaScript errors occurred. Backend verification passed all 97 tests, including six public-discovery checks and mocked payment coverage. The pushed backend's deployed anonymous catalog returned HTTP 200, JSON and `Cache-Control: private, no-store`; its total was zero, confirming that the push did not publish existing courses. The frontend deployment itself still needs a read-only check on the configured live frontend hostname.

Deploy the matching backend first or together using the existing GitHub/Render and Cloudflare pipeline. No new hosting, accounts or settings are introduced. After deployment verify public routes/deep links and `/api/public/courses` through the same-origin proxy. Real CCC publication still needs owner-authored course details, actual price/language/support and a chosen preview; no production course is made public by the code push.
