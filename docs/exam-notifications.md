# Homepage exam updates

The lazy-loaded landing sections include an anonymous “Latest exam notifications” section after the course catalog. `ExamNotifications` calls only the backend's `GET /public/exam-notifications`. No Parse credential, account request or direct provider call reaches the browser.

The backend fetches the latest `latest-job` page from Parse's SarkariResult.com.cm marketplace API and shares it across visitors with a durable 12-hour attempt interval. Set `PARSE_API_KEY` privately in the Render backend; setup and limitations are documented in the backend's `docs/exam-notifications.md`. No frontend environment changes are required.

The section displays source attribution, publication dates, last refresh time in IST, local title search and six updates initially with an option to show the remaining fetched updates. Search and expansion make no network calls. Notices open the third-party source in a new tab with `noopener noreferrer`. Application deadlines and eligibility are left to the official recruiting authority's notice.

Without a configured key, the section stays hidden. Loading, valid empty data, unavailable source, failed requests and stale saved notices have separate states; the rest of the landing page remains usable. Backend data older than seven days is hidden. “Retry updates” repeats a cache read and cannot force a provider refresh or bypass its attempt budget.

Run `python3 tests/exam_notifications_browser.py` for isolated Chrome/Playwright checks with synthetic API fixtures and external requests blocked. It covers both themes, small/large viewports, zoom, keyboard search/expansion, safe source links, zero extra API calls during filtering, and every feed state. Existing catalog and visual browser suites disable this optional feed through an explicit fixture.
