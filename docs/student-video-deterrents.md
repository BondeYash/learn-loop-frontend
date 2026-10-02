# Student video download deterrents

Student course playback requests `controlsList="nodownload"` and suppresses the context menu only on the video element. There were no separate download links/actions to remove. The signed URL remains necessary in the media source and is not displayed as a link. Server authorization, assignment checks and short-lived private R2 tickets are unchanged.

A small top-right overlay displays `Learner ` followed by the last eight characters of the authenticated student's account ID, uppercase. It omits the name, email and full account ID. It is a stable partial identifier, not anonymous data, a guaranteed unique code or proof of who made a copy. The overlay ignores pointer events and is hidden from assistive technology; playback controls remain accessible.

When container fullscreen is available, a keyboard-accessible Full screen button enters fullscreen on the wrapper so the watermark remains visible. The browser's video-only fullscreen control is hidden where supported. If container fullscreen is unsupported or rejected, the native fullscreen option remains available. Instructor course previews and admin previews retain their existing native controls and have no learner overlay. Picture-in-picture, remote playback, speed, volume and seeking remain enabled.

## Limits

These are casual-sharing deterrents. They do not prevent downloading bytes, extracting the signed source URL, editing/removing the overlay, OS screen recording, screenshots or external-camera recording. The overlay is not burned into the file and is not forensic watermarking. Browser support for `controlsList` varies. Native video fullscreen, picture-in-picture and remote playback can omit the DOM overlay, particularly on mobile devices. No DRM or capture-prevention guarantee is made.

Authorization controls new ticket issuance. Already-issued bearer URLs can be used until expiration; an existing transfer and buffered/downloaded bytes may outlive URL expiry. CORS and a hidden download button are not access controls.

References: [MDN controlsList](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/controlsList), [MDN requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen).

## Local verification, 2026-10-02

`npm run lint`, `npm test` (17 existing assertions/tests across auth, video validation and proxy checks), and `npm run build` passed. An isolated Chrome 151 browser check uses the real React routes with synthetic account/course/API responses and a generated 30-second MP4. It blocks external browser requests and never contacts the production API or R2.

The optional regression script requires Python 3 with Playwright, Google Chrome and ffmpeg already installed, plus the frontend dependencies. It starts and stops its own loopback Vite server on port 5186, creates temporary media, and leaves screenshots in a temporary directory unless configured otherwise:

```sh
python3 tests/student_player_browser.py
# Optional screenshot destination and browser executable:
PLAYER_EVIDENCE_DIR=/tmp/student-player-evidence CHROME_BIN=/usr/bin/google-chrome python3 tests/student_player_browser.py
```

Checks cover student controls/context-menu scope; partial learner identity and pointer/accessibility behavior; actual playback; automatic ticket renewal while playing and paused; seeking near expiry; keyboard fullscreen and watermark containment; 320px/390px layout; denied renewal and manual retry; unavailable/rejected fullscreen fallback; and instructor/admin preview playback. This does not verify real signed URLs, production permission enforcement, audio, captions, assistive technology or every mobile/browser combination. Existing backend authorization is unchanged. Test actual supported devices and the hosted workflow separately before release.
