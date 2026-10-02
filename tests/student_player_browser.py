"""Optional isolated browser regression check; see docs/student-video-deterrents.md.

Uses installed Python Playwright, Google Chrome and ffmpeg. Never contacts an API:
all /api and video requests use fixtures, and external requests are blocked.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "http://127.0.0.1:5186"
STUDENT_ID = "507f1f77bcf86cd799439011"
COURSE = {
    "course": {"_id": "course-fixture", "title": "Video playback review", "description": "Synthetic local fixture", "instructor": {"name": "Demo instructor"}},
    "modules": [{"_id": "module-fixture", "title": "First module", "lessons": [{"_id": "lesson-fixture", "title": "Practice lesson", "contentType": "video", "video": {"status": "ready"}}]}],
}


def check(condition, label):
    assert condition, label
    print(f"PASS {label}", flush=True)


def run_checks(browser, media, evidence):
    contexts = []
    unexpected = []
    errors = []

    def fixture(role="student", short=False, no_fullscreen=False):
        context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
        contexts.append(context)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        if no_fullscreen:
            page.add_init_script("Object.defineProperty(document, 'fullscreenEnabled', {get: () => false})")
        state = {"count": 0, "short": short, "denied": False}
        initial_expiry = int(time.time() * 1000) + 35000

        def route_request(route):
            request = route.request
            url = urlparse(request.url)
            if f"{url.scheme}://{url.netloc}" != ORIGIN:
                unexpected.append(request.url)
                route.abort()
                return
            if url.path == "/__fixture__/video.mp4":
                headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
                byte_range = request.headers.get("range")
                if byte_range:
                    start, end = byte_range.removeprefix("bytes=").split("-")
                    start, end = int(start or 0), int(end) if end else len(media) - 1
                    headers["Content-Range"] = f"bytes {start}-{end}/{len(media)}"
                    route.fulfill(status=206, content_type="video/mp4", headers=headers, body=media[start:end + 1])
                else:
                    route.fulfill(content_type="video/mp4", headers=headers, body=media)
                return
            if not url.path.startswith("/api/"):
                route.continue_()
                return
            data = None
            if url.path == "/api/auth/me":
                data = {"user": {"id": STUDENT_ID, "name": "Demo learner", "email": "fixture@example.invalid", "role": role, "status": "active", "mustChangePassword": False}}
            elif url.path == "/api/courses/course-fixture":
                data = COURSE
            elif url.path == "/api/courses/course-fixture/progress":
                data = {"progress": {"completedLessons": [], "percentage": 0}}
            elif url.path == "/api/lessons/lesson-fixture/playback":
                state["count"] += 1
                if state["denied"]:
                    route.fulfill(status=403, json={"message": "Course access is no longer available."})
                    return
                expires = initial_expiry if state["short"] else page.evaluate("Date.now() + 300000")
                data = {"url": f"{ORIGIN}/__fixture__/video.mp4?ticket={state['count']}", "expiresAt": expires}
            elif url.path == "/api/admin/overview":
                data = {"instructors": 1, "students": 1, "courses": 1, "published": 1, "videos": 1, "ready": 1, "suspended": 0}
            elif url.path == "/api/admin/videos":
                data = {"videos": [{"id": "video-fixture", "filename": "fixture.mp4", "status": "ready", "attached": True, "course": {"id": "course-fixture", "title": "Video playback review"}, "lesson": {"id": "lesson-fixture", "title": "Practice lesson"}}], "page": 1, "limit": 20, "total": 1}
            else:
                unexpected.append(request.url)
                route.fulfill(status=500, json={"message": "Unconfigured fixture"})
                return
            route.fulfill(json={"data": data})

        page.route("**/*", route_request)
        page.goto(ORIGIN + ("/admin?tab=videos" if role == "admin" else "/courses/course-fixture"))
        if role == "admin":
            page.get_by_role("button", name="Preview", exact=True).click()
        page.wait_for_function("document.querySelector('video')?.readyState >= 2")
        state["short"] = False
        return page, state

    def video_state(page):
        return page.locator("video").evaluate("v => ({time:v.currentTime,paused:v.paused,src:v.currentSrc})")

    def renew_via_seek(page):
        old = video_state(page)["src"]
        page.evaluate("window.fixtureOriginalNow = Date.now; Date.now = () => window.fixtureOriginalNow() + 290000; document.querySelector('video').currentTime = 9")
        page.wait_for_function("old => document.querySelector('video')?.currentSrc !== old && document.querySelector('video')?.readyState >= 2", arg=old)
        page.evaluate("Date.now = window.fixtureOriginalNow")

    try:
        page, state = fixture(short=True)
        video = page.locator("video")
        expect(video).to_have_attribute("controlslist", "nodownload nofullscreen")
        check(video.evaluate("v => v.controls && !v.disablePictureInPicture && !v.disableRemotePlayback"), "native playback, picture-in-picture and remote controls remain enabled")
        watermark = page.locator(".private-player-watermark")
        expect(watermark).to_have_text("Learner 99439011")
        check(watermark.get_attribute("aria-hidden") == "true" and watermark.evaluate("e => getComputedStyle(e).pointerEvents") == "none", "watermark does not intercept input or add screen-reader noise")
        check(not any(value in watermark.inner_text() for value in [STUDENT_ID, "Demo learner", "fixture@example.invalid"]), "watermark omits full ID, name and email")
        check(not video.evaluate("v => v.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true}))"), "student video context menu is suppressed")
        check(page.locator("h1").evaluate("e => e.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true}))"), "page context menu remains available")
        check(page.locator("a[download], a[href*='video.mp4']").count() == 0, "no download action or raw video URL link is exposed")
        video.evaluate("v => {v.currentTime = 5; v.muted = true; return v.play()}")
        old = video_state(page)["src"]
        page.wait_for_function("old => document.querySelector('video')?.currentSrc !== old && !document.querySelector('video')?.paused && document.querySelector('video')?.currentTime >= 5", arg=old, timeout=12000)
        check(True, "automatic ticket renewal preserves playing state and position")
        page.get_by_role("button", name="Enter video fullscreen").focus()
        page.keyboard.press("Enter")
        page.wait_for_function("document.fullscreenElement?.classList.contains('private-player')")
        expect(watermark).to_be_visible()
        check(watermark.evaluate("e => document.fullscreenElement.contains(e)"), "keyboard fullscreen includes the watermark")
        page.wait_for_function("document.querySelector('video').readyState >= 3 && !document.querySelector('video').paused")
        page.locator("video").evaluate("v => new Promise(resolve => v.requestVideoFrameCallback(() => resolve()))")
        page.screenshot(path=str(evidence / "student-fullscreen.png"))
        renew_via_seek(page)
        check(page.evaluate("document.fullscreenElement?.classList.contains('private-player')"), "near-expiry seeking renews inside fullscreen")
        page.get_by_role("button", name="Exit video fullscreen").click()
        page.wait_for_function("!document.fullscreenElement")
        for width in [390, 320]:
            page.set_viewport_size({"width": width, "height": 844})
            box, mark = video.bounding_box(), watermark.bounding_box()
            check(mark["x"] >= box["x"] and mark["x"] + mark["width"] <= box["x"] + box["width"] and mark["y"] + mark["height"] < box["y"] + box["height"] / 2, f"watermark fits {width}px viewport above native controls")
            check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"no horizontal overflow at {width}px")
        page.screenshot(path=str(evidence / "student-mobile.png"), full_page=True)
        page.set_viewport_size({"width": 1280, "height": 900})
        page.screenshot(path=str(evidence / "student-desktop.png"), full_page=True)

        paused, _ = fixture(short=True)
        paused.locator("video").evaluate("v => { v.pause(); v.currentTime = 7 }")
        old = video_state(paused)["src"]
        paused.wait_for_function("old => document.querySelector('video')?.currentSrc !== old && document.querySelector('video')?.readyState >= 2", arg=old, timeout=12000)
        check(video_state(paused)["paused"] and abs(video_state(paused)["time"] - 7) < .2, "automatic renewal preserves paused position")

        # Simulate a denied renewal without contacting a server or changing permissions.
        state["denied"] = True
        page.evaluate("window.fixtureOriginalNow = Date.now; Date.now = () => window.fixtureOriginalNow() + 600000; document.querySelector('video').currentTime = 12")
        expect(page.get_by_role("alert")).to_contain_text("Course access is no longer available")
        check(page.locator("video").count() == 0, "denied renewal removes the playable video")
        state["denied"] = False
        page.evaluate("Date.now = window.fixtureOriginalNow")
        page.get_by_role("button", name="Retry playback").click()
        page.wait_for_function("document.querySelector('video')?.readyState >= 2")
        expect(page.locator(".private-player-watermark")).to_be_visible()
        check(True, "manual retry restores the student player and watermark")

        fallback, _ = fixture(no_fullscreen=True)
        expect(fallback.locator("video")).to_have_attribute("controlslist", "nodownload")
        check(fallback.get_by_role("button", name="Enter video fullscreen").count() == 0, "unsupported container fullscreen keeps the native option")
        rejected, _ = fixture()
        rejected.evaluate("() => { document.querySelector('.private-player').requestFullscreen = () => Promise.reject(new Error('Fixture denial')); }")
        rejected.get_by_role("button", name="Enter video fullscreen").click()
        expect(rejected.locator("video")).to_have_attribute("controlslist", "nodownload")
        expect(rejected.get_by_role("status")).to_contain_text("Fullscreen is unavailable")
        check(True, "rejected fullscreen request restores native fullscreen controls")

        for role in ["instructor", "admin"]:
            preview, _ = fixture(role)
            check(preview.locator("video").get_attribute("controlslist") is None and preview.locator(".private-player-watermark").count() == 0, f"{role} preview retains native controls without learner watermark")
            check(preview.locator("video").evaluate("v => v.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true,cancelable:true}))"), f"{role} preview context menu remains available")
            preview.locator("video").evaluate("v => {v.currentTime = 4; v.muted = true; return v.play()}")
            preview.wait_for_function("document.querySelector('video').currentTime > 4.2 && !document.querySelector('video').paused")
            check(True, f"{role} preview plays and seeks")
        check(not unexpected, f"all API/media requests isolated; unexpected requests: {unexpected}")
        check(not errors, f"no browser runtime errors: {errors}")
    finally:
        for context in contexts:
            context.close()


def main():
    evidence = Path(os.environ.get("PLAYER_EVIDENCE_DIR", tempfile.mkdtemp(prefix="student-player-evidence-")))
    evidence.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="student-player-fixture-") as temporary:
        media = Path(temporary) / "fixture.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(media)], check=True)
        env = {**os.environ, "VITE_API_URL": "/api"}
        with open(Path(temporary) / "vite.log", "w+") as log:
            server = subprocess.Popen(["node", "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5186", "--strictPort"], cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    if server.poll() is not None:
                        log.seek(0)
                        raise RuntimeError(log.read())
                    try:
                        with urlopen(ORIGIN, timeout=.2):
                            break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise RuntimeError("Local fixture server did not start")
                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch(executable_path=os.environ.get("CHROME_BIN", shutil.which("google-chrome")), headless=True)
                    print(f"Browser: Chrome {browser.version}", flush=True)
                    try:
                        run_checks(browser, media.read_bytes(), evidence)
                    finally:
                        browser.close()
            finally:
                server.terminate()
                server.wait(timeout=10)
    print(json.dumps({"result": "passed", "screenshots": str(evidence)}), flush=True)


if __name__ == "__main__":
    main()
