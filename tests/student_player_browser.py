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
from copy import deepcopy
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


def fulfill_learning_place(route, url):
    # Legacy suites acknowledge the new visit API. Persistence and access are
    # exercised separately in learning_support_browser.py and backend HTTP tests.
    if url.path.startswith("/api/lessons/") and url.path.endswith("/visit") and route.request.method == "POST":
        body = route.request.post_data_json
        route.fulfill(json={"data":{"progress":{"completedLessons":[],"percentage":0,"resumeRevision":body["revision"]+1,"resume":{"lesson":url.path.split("/")[-2],"position":body["position"]}}}})
        return True
    return False


def fulfill_optional_exam_notifications(route, url):
    # Dedicated coverage is in exam_notifications_browser.py. Other suites run
    # with the optional feed disabled and never contact Parse.
    if url.path == "/api/public/exam-notifications" and route.request.method == "GET":
        route.fulfill(json={"data": {"enabled": False, "status": "disabled", "notices": [], "updatedAt": None}})
        return True
    return False


def fulfill_optional_acquisition(route, url):
    if url.path.startswith("/api/public/courses/") and url.path.endswith("/acquisition") and route.request.method == "GET":
        route.fulfill(json={"data":{"measurementEnabled":False,"interestEnabled":False,"policyUrl":"","retentionDays":90}})
        return True
    return False


def run_checks(browser, media, evidence):
    contexts = []
    unexpected = []
    errors = []

    def fixture(role="student", short=False, no_fullscreen=False, multiple=False):
        context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
        contexts.append(context)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        if no_fullscreen:
            page.add_init_script("Object.defineProperty(document, 'fullscreenEnabled', {get: () => false})")
        state = {"count": 0, "short": short, "denied": False, "initial_expiry": None}
        course = deepcopy(COURSE)
        if multiple:
            course["modules"][0]["lessons"].append({"_id": "lesson-second", "title": "Second practice lesson", "contentType": "video", "video": {"status": "ready"}})

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
                data = course
            elif fulfill_learning_place(route, url): return
            elif url.path == "/api/courses/course-fixture/progress":
                data = {"progress": {"completedLessons": [], "percentage": 0}}
            elif url.path == "/api/courses/course-fixture/notes":
                data = {"notes": []}
            elif url.path in ["/api/lessons/lesson-fixture/playback", "/api/lessons/lesson-second/playback"]:
                state["count"] += 1
                if state["denied"]:
                    route.fulfill(status=403, json={"message": "Course access is no longer available."})
                    return
                # Start the synthetic ticket lifetime when issued, so cold Vite
                # compilation cannot consume its renewal window before playback.
                if state["short"] and state["initial_expiry"] is None:
                    state["initial_expiry"] = page.evaluate("Date.now() + 40000")
                expires = state["initial_expiry"] if state["short"] else page.evaluate("Date.now() + 300000")
                data = {"url": state.get("reuse_url") or f"{ORIGIN}/__fixture__/video.mp4?ticket={state['count']}", "expiresAt": expires}
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
        page.get_by_role("combobox", name="Playback speed").select_option("1.5")
        page.get_by_role("combobox", name="Skip interval").select_option("30")
        video.evaluate("v => {v.currentTime = 5; v.muted = true; v.volume = .35; return v.play()}")
        video.focus()
        old = video_state(page)["src"]
        page.wait_for_function("old => document.querySelector('video')?.currentSrc !== old && !document.querySelector('video')?.paused && document.querySelector('video')?.currentTime >= 5", arg=old, timeout=15000)
        check(True, "automatic ticket renewal preserves playing state and position")
        check(video.evaluate("v => v.playbackRate === 1.5 && v.muted && Math.abs(v.volume - .35) < .01"), "automatic renewal preserves speed, volume and mute")
        check(video.evaluate("v => document.activeElement === v"), "renewal preserves keyboard focus on the video")
        expect(page.get_by_role("combobox", name="Skip interval")).to_have_value("30")
        page.get_by_role("button", name="Enter video fullscreen").focus()
        page.keyboard.press("Enter")
        page.wait_for_function("document.fullscreenElement?.classList.contains('private-player')")
        expect(watermark).to_be_visible()
        check(watermark.evaluate("e => document.fullscreenElement.contains(e)"), "keyboard fullscreen includes the watermark")
        check(page.get_by_role("combobox", name="Playback speed").evaluate("e => document.fullscreenElement.contains(e)"), "fullscreen includes speed and skip controls")
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
        paused.get_by_role("combobox", name="Playback speed").select_option("0.75")
        paused.locator("video").evaluate("v => { v.pause(); v.currentTime = 7 }")
        old = video_state(paused)["src"]
        paused.wait_for_function("old => document.querySelector('video')?.currentSrc !== old && document.querySelector('video')?.readyState >= 2", arg=old, timeout=15000)
        check(video_state(paused)["paused"] and abs(video_state(paused)["time"] - 7) < .2, "automatic renewal preserves paused position")
        check(paused.locator("video").evaluate("v => v.playbackRate === .75"), "paused renewal keeps the selected speed")

        controls, control_state = fixture(multiple=True)
        control_video = controls.locator("video")
        shell = controls.locator(".private-player")
        speed = controls.get_by_role("combobox", name="Playback speed")
        interval = controls.get_by_role("combobox", name="Skip interval")
        expect(speed).to_have_value("1")
        expect(interval).to_have_value("10")
        control_video.evaluate("v => {v.pause(); v.currentTime = 12}")
        controls.get_by_role("button", name="Back 10 seconds", exact=True).click()
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - 2) < .1")
        controls.get_by_role("button", name="Forward 10 seconds", exact=True).click()
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - 12) < .1")
        check(video_state(controls)["paused"], "skip buttons seek without resuming a paused lesson")
        interval.select_option("30")
        controls.get_by_role("button", name="Back 30 seconds", exact=True).click()
        controls.wait_for_function("document.querySelector('video').currentTime === 0")
        controls.get_by_role("button", name="Forward 30 seconds", exact=True).click()
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - document.querySelector('video').duration) < .1")
        check(True, "skip buttons clamp to the start and end of the lesson")
        for value in ["0.25", "0.75", "1.5", "2", "3"]:
            speed.select_option(value)
            check(control_video.evaluate("v => v.playbackRate") == float(value), f"speed control applies {value}x to real media")
        control_video.evaluate("v => {v.playbackRate = 1.25; v.currentTime = 12}")
        expect(speed).to_have_value("1.25")
        interval.select_option("5")
        shell.focus(); controls.keyboard.press("j")
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - 7) < .1")
        controls.keyboard.press("l")
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - 12) < .1")
        check(control_video.evaluate("v => ['ArrowLeft', 'ArrowRight', ' '].every(key => v.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true, cancelable:true})))"), "native control arrow and Space events keep their browser behavior")
        shell.focus(); controls.keyboard.press("ArrowRight")
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - 17) < .1")
        controls.keyboard.press("ArrowLeft")
        controls.wait_for_function("Math.abs(document.querySelector('video').currentTime - 12) < .1")
        controls.keyboard.press("Shift+Period"); expect(speed).to_have_value("1.5")
        controls.keyboard.press("Shift+Comma"); expect(speed).to_have_value("1.25")
        controls.keyboard.press("m"); check(control_video.evaluate("v => v.muted"), "M mutes the focused player")
        controls.keyboard.press("Space")
        controls.wait_for_function("!document.querySelector('video').paused")
        expect(controls.get_by_role("button", name="Pause video", exact=True)).to_be_visible()
        controls.keyboard.press("k")
        controls.wait_for_function("document.querySelector('video').paused")
        expect(controls.get_by_role("button", name="Play video", exact=True)).to_be_visible()
        controls.get_by_role("button", name="Play video", exact=True).click()
        controls.wait_for_function("!document.querySelector('video').paused")
        controls.get_by_role("button", name="Pause video", exact=True).click()
        check(video_state(controls)["paused"], "custom play/pause buttons stay in sync with keyboard and native media")
        speed.focus(); before = video_state(controls)["time"]
        controls.keyboard.press("ArrowLeft")
        check(abs(video_state(controls)["time"] - before) < .1, "select keys do not trigger player shortcuts")
        controls.get_by_role("button", name="Mark lesson complete", exact=True).focus(); controls.keyboard.press("l")
        check(abs(video_state(controls)["time"] - before) < .1, "shortcuts outside the player do not seek")
        speed.select_option("1.5"); interval.select_option("30")
        controls.get_by_role("navigation", name="Course lessons").get_by_role("button", name="Second practice lesson").click()
        controls.wait_for_function("document.querySelector('video')?.readyState >= 2")
        expect(speed).to_have_value("1.5"); expect(interval).to_have_value("30")
        check(control_video.evaluate("v => v.playbackRate === 1.5 && v.currentTime < .2"), "new lessons keep speed and skip settings and start at their own position")
        controls.reload(); controls.wait_for_function("document.querySelector('video')?.readyState >= 2")
        expect(speed).to_have_value("1.5"); expect(interval).to_have_value("30")
        check(control_video.evaluate("v => v.playbackRate === 1.5"), "speed and skip interval survive page reload")
        # A provider can return an identical signed URL on an early renewal.
        # It must not leave a loading overlay or disable the existing controls.
        control_state["reuse_url"] = video_state(controls)["src"]
        with controls.expect_response("**/api/lessons/lesson-fixture/playback"):
            controls.evaluate("window.fixtureOriginalNow = Date.now; Date.now = () => window.fixtureOriginalNow() + 290000; document.querySelector('video').currentTime = 9")
        controls.evaluate("Date.now = window.fixtureOriginalNow")
        expect(controls.get_by_text("Loading video…", exact=True)).to_have_count(0)
        expect(controls.get_by_role("button", name="Play video", exact=True)).to_be_enabled()
        check(video_state(controls)["src"] == control_state["reuse_url"], "renewing an unchanged video URL keeps controls ready")
        for theme in ["light", "dark"]:
            if theme == "dark": controls.get_by_role("button", name="Switch to dark theme").click()
            for width in [320, 390, 1280]:
                controls.set_viewport_size({"width": width, "height": 900})
                check(controls.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"student controls fit {width}px in {theme} theme")
                shell.screenshot(path=str(evidence / f"playback-controls-{width}-{theme}.png"))
        controls.set_viewport_size({"width": 640, "height": 1000}); controls.evaluate("document.documentElement.style.zoom = '2'")
        check(controls.evaluate("document.documentElement.scrollWidth <= innerWidth"), "student controls fit at 200% zoom")
        shell.screenshot(path=str(evidence / "playback-controls-zoom.png"))
        controls.evaluate("document.documentElement.style.zoom = ''"); controls.set_viewport_size({"width": 844, "height": 390})
        shell.focus(); controls.keyboard.press("f")
        controls.wait_for_function("document.fullscreenElement?.classList.contains('private-player')")
        expect(speed).to_be_visible()
        controls.screenshot(path=str(evidence / "playback-controls-landscape-fullscreen.png"))
        controls.get_by_role("button", name="Back 30 seconds", exact=True).click()
        controls.get_by_role("button", name="Exit video fullscreen", exact=True).click()
        controls.wait_for_function("!document.fullscreenElement")
        check(True, "new controls remain usable in container fullscreen")

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
        expect(rejected.get_by_role("status").filter(has_text="Fullscreen is unavailable")).to_be_visible()
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
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(media)], check=True)
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
