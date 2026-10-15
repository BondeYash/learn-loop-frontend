# Doubt Dost

Admins manage the course knowledge base at `/admin/doubt-dost`. Choose a course, select PDFs, upload them, wait for indexing, test a question in the preview and publish approved PDFs. Published sources can be opened by students who have access to that course. Course handouts are separate and are not indexed automatically.

Students open “Meet Doubt Dost” from their course. The assistant supports Hinglish, Hindi and English, preserves private history, shows source excerpts and opens cited PDFs. Missing evidence offers instructor help. “Ask instructor” opens a draft in learning support; the student reviews and sends it explicitly.

All provider requests and credentials stay on the backend. There is no `VITE_GEMINI_API_KEY`. Keep `VITE_API_URL=/api`; the existing Cloudflare proxy forwards these authenticated requests without caching. New pages are lazy loaded.

The backend needs `GEMINI_API_KEY`, MongoDB and the existing private R2 configuration. See the [backend setup, cost controls and operational limits](https://github.com/BondeYash/learn-loop-backend/blob/main/docs/doubt-dost.md). Admin usage controls set global monthly answers/pages, per-student daily answers and PDF storage/document allowances. Defaults are intentionally small. They are count limits, not a currency spending cap.

## Browser verification

Run `python3 tests/doubt_dost_e2e_browser.py` with Python Playwright, Chrome, reportlab, Node dependencies installed in both sibling repositories and an isolated MongoDB listening on `TEST_MONGO_PORT` (default 27018). The script starts disposable frontend/backend fixtures and drops only its randomly named test database when it exits.

If the repositories are not siblings, set `DOUBT_BACKEND_DIR` to the backend checkout path.

The test covers admin upload/index/preview/publish, student payment-waiver access, private conversation persistence, source viewing, Hindi/Hinglish, feedback, manual retry, evidence abstention, instructor draft handoff, paused mode and 320/1280px light/dark layouts plus 200% zoom. Only Gemini and R2 are simulated. External requests are blocked. It does not spend live AI credits or verify the production Gemini key.
