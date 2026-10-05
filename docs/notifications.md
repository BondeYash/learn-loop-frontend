# Shared notifications

Authentication and sign-out notifications use the LessonLoop panel, text and focus tokens in both themes. A status label and decorative icon accompany the original API message. Notifications sit at the bottom right, fit a 320px viewport, reserve device safe-area space, and have a keyboard-accessible 44px dismiss button. Long messages scroll and can receive keyboard focus.

Success stays for 4.5 seconds and information for 6.5 seconds. Errors and warnings require explicit dismissal. Hover, window blur and focus within a toast pause its timer; clicking its text does not dismiss it. Reduced motion preserves the timer instead of shortening it with the app's global animation rule. Two cards display at once; identical visible or queued notifications are deduplicated until dismissal. Distinct failures remain queued.

Use the shared `toast` export from `src/services/notifications.jsx` for success, error, info and warning. Keep actionable API errors intact. Inline page and form errors retain their existing behavior.

Verification uses synthetic local auth responses only: `PLAYER_EVIDENCE_DIR=/absolute/evidence/path python3 tests/notifications_browser.py`. Installed Python Playwright, Google Chrome and ffmpeg are the same prerequisites as the existing browser checks. It covers both themes, mobile/desktop, 200% zoom, theme switching, preserved server errors, repeat submissions, visible/queued deduplication, keyboard dismissal/focus, navigation and reduced-motion timing. It does not create accounts or contact payment providers.
