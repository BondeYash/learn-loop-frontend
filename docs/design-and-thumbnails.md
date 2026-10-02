# Reference-led design, course covers and in-app dialogs

The supplied white/teal panel screenshot was materialized and visually inspected, followed by local baseline screens. LessonLoop adapts its compact metric cards, fine borders, soft depth and clear panels into original light/dark layouts. Course detail now shows real course metadata, optional requirements/outcomes/instructor biography, available lesson outline, completion progress and start/continue controls. It adds no invented reviews, ratings or activity statistics. Continue selects an available incomplete lesson after reload; it does not claim persistent video-position resume.

Course management includes a cover picker, local preview, upload/replace, progress and retained-file retry. Saved images appear on instructor/student cards and course headers. Missing/failed images fall back to LessonLoop artwork. Inputs: still JPEG/PNG/WebP, **5 MiB maximum, 16 megapixels** on the server. The matching backend stores normalized covers in existing private R2; see [backend configuration and rollout](https://github.com/BondeYash/learn-loop-backend/blob/main/docs/course-thumbnails.md). Deploy that backend first when ordering is controlled. No frontend secret or new provider is needed.

All app-owned browser confirmation/rename prompts use in-app dialogs. Destructive actions require confirmation. Dialogs wrap keyboard focus, restore the trigger, support Escape/cancel/navigation back, prevent pending double submissions and retain failures for retry. Lesson action disclosures close on Escape/outside input. Existing admin/archive dialogs share focus wrapping. Browser-owned file pickers and security prompts remain native.

## Verification

Frontend lint, eighteen auth/video/proxy checks, production build, Worker dry-run and production dependency audit pass (zero known advisories). Isolated Chrome 151 checks in `tests/design_flow_browser.py` verify thumbnail errors/retry/replacement/reload, cover propagation, metadata, rename/confirmation focus, pending/failure/retry, navigation and 320px light/dark dialogs. Existing `course_flow_browser.py` and `student_player_browser.py` pass for PDF creation/sharing/open/download, skeleton/error/empty recovery, reduced motion, playback renewal, watermark/fullscreen and role previews. Final synthetic role screenshots at 1440px/390px were captured; local light/dark screens were visually inspected. These checks do not prove deployed R2/cookies, every browser/device or assistive technology.

Optional browser checks use installed Python Playwright, Pillow, Chrome and FFmpeg to create disposable synthetic fixtures. Run each script separately; its local Vite server uses port 5186 and blocks external API/media requests. FFmpeg here only generates test media; it does not enable production conversion.

## Video compatibility boundary

Uploads remain preconverted MP4, with H.264 video/AAC audio recommended. The app checks the MP4 header and first decoded frame; it **does not independently verify all audio codecs**. A real synthetic H.264/AAC MP4 decoded audio in Chrome and the player starts with sound enabled. Preview lessons with sound before sharing.

WebM/MOV/MKV conversion is not implemented. Their extensions do not guarantee browser-compatible video/audio. Reliable support across those inputs requires a separate decision between instructor-side conversion, a durable conversion worker, or a managed provider. No paid service, new worker, browser conversion engine or payment integration was introduced.
