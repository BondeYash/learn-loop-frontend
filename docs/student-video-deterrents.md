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

## Student playback controls, 2026-10-13

The shared player provides visible play/pause, backward/forward buttons, speeds from 0.25× to 3×, and a 5/10/30-second skip selector (10 seconds by default). Speed and skip interval are stored as device preferences in `learnloop:video-controls:v1`; no account details or signed URLs are stored. Corrupt or blocked storage falls back to normal speed and a 10-second skip. The native timeline, volume, picture-in-picture and supported casting controls remain available. Instructor, admin and public sample previews use the same controls.

Keyboard shortcuts apply only within the player: Space/K toggles playback, J/L uses the chosen skip interval, left/right arrows move five seconds, </> steps through speeds, M mutes, and F toggles supported container fullscreen. The native video retains its own Space and arrow handling so its built-in sliders and buttons remain keyboard accessible; custom Space/arrow shortcuts apply to the wrapper. Inputs and focused buttons retain their normal keyboard behavior. A collapsible guide describes these shortcuts, and skip/rate changes have brief accessible feedback. Controls wrap for small screens and remain inside container fullscreen.

Ticket renewal preserves the latest position and playing/paused state, selected speed, volume, mute and video keyboard focus. Skipping continues to use the existing learning-place reporting and never marks a lesson complete automatically. No backend entitlement, payment, progress or signed-ticket API contract changes are required.

`tests/student_player_browser.py` also checks actual media rates, skip boundaries, keyboard scope, native/custom control synchronization, preferences across lessons/reloads, automatic renewal, both themes at 320/390/1280px, 200% zoom and landscape fullscreen. `tests/videoPreferences.test.js` covers corrupt and denied storage.
