# Doubt Dost

Admins manage the course knowledge base at `/admin/doubt-dost`. Choose a course, select PDFs, upload them, wait for indexing, test a question in the preview and publish approved PDFs. Published sources can be opened by students who have access to that course. Course handouts are separate and are not indexed automatically.

Students open “Doubt Dost” from the main navigation, the student dashboard or the quick entry near the top of their course. `/doubts` lists only courses with active material access; each course has a saved conversation at `/courses/:id/doubts`. The assistant supports Hinglish, Hindi and English, preserves private history, shows source excerpts and opens cited PDFs. Missing evidence offers instructor help. “Ask instructor” opens a draft in learning support; the student reviews and sends it explicitly.

All provider requests and credentials stay on the backend. There is no `VITE_GROQ_API_KEY`. Keep `VITE_API_URL=/api`; the existing Cloudflare proxy forwards these authenticated requests without caching. New pages are lazy loaded.

The backend needs `GROQ_API_KEY`, MongoDB and the existing private R2 configuration. PDF passages are extracted and searched locally; Groq receives selected passages for each answer. Scanned PDFs need OCR first. Existing published PDFs are reindexed automatically while retaining their publication setting. See the [backend setup, cost controls and operational limits](https://github.com/BondeYash/learn-loop-backend/blob/main/docs/doubt-dost.md). Admin usage controls set global monthly answers/pages, per-student daily answers and PDF storage/document allowances. Defaults are intentionally small. They are count limits, not a currency spending cap.

## Browser verification

Run `python3 tests/doubt_dost_e2e_browser.py` with Python Playwright, Chrome, reportlab, Node dependencies installed in both sibling repositories and an isolated MongoDB listening on `TEST_MONGO_PORT` (default 27018). The script starts disposable frontend/backend fixtures and drops only its randomly named test database when it exits.

If the repositories are not siblings, set `DOUBT_BACKEND_DIR` to the backend checkout path.

The test covers admin upload/index/preview/publish, student payment-waiver access, private conversation persistence, source viewing, Hindi/Hinglish, feedback, manual retry, evidence abstention, instructor draft handoff, paused mode and 320/1280px light/dark layouts plus 200% zoom. Only Groq and R2 are simulated. External requests are blocked. It does not spend live AI credits or verify the production Groq key.

## Student chat interface

The course chat uses a centered message thread and a composer anchored below its own scrolling conversation. Desktop has a course-conversation rail; smaller screens have a labeled course switcher. Changing course mounts a new chat and cancels the previous read/request, so the old course’s messages and draft do not carry over. This interface continues the existing per-course history; it does not create separate chat sessions or reset the AI context.

Enter sends and Shift+Enter inserts a line break. IME composition is respected. The textarea grows up to a bounded height, send is disabled for empty/active/exhausted requests, and the submitted question appears immediately while the backend prepares the answer. Failed requests retain the draft and use the existing idempotency rules. Scrolling up preserves the reading position; “Latest message” returns to the bottom. A visual-viewport resize keeps the composer reachable when a mobile keyboard changes the available height.

Answers render Markdown headings, lists, code and GFM tables with `react-markdown` and `remark-gfm`. Raw HTML is skipped, remote images are suppressed and generated links render as text. Only the authenticated PDF source action opens cited course material. Copy, helpful/unhelpful feedback, simpler follow-ups and reviewed instructor drafts remain available. No streaming is simulated and AI requests are never automatically retried.

The UI keeps history at the backend’s existing 30-turn window and retains existing source/access checks and quotas. There are no new AI providers, secrets or chargeable background calls.

Additional verification: `python3 tests/doubt_chat_ui_browser.py` uses local fixtures for student discovery, course isolation, formatted answer safety, clipboard/keyboard actions, saved history, scrolling, desktop/mobile/landscape layouts, quota exhaustion, unavailable assistants and denied access.
