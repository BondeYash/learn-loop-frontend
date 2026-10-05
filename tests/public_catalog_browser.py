"""Isolated public discovery, preview and authoring checks. All API/media use
synthetic fixtures; unexpected external and API requests are blocked.
Run: python3 tests/public_catalog_browser.py (same prerequisites as player check).
"""
from copy import deepcopy
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect
import student_player_browser as harness

ORIGIN = harness.ORIGIN
COURSE_ID = "507f1f77bcf86cd799439022"
CATEGORY_ID = "507f1f77bcf86cd799439033"
TEXT_ID = "507f1f77bcf86cd799439044"
VIDEO_ID = "507f1f77bcf86cd799439055"
CARD = {"id": COURSE_ID, "title": "Synthetic CCC course", "slug": "synthetic-ccc", "examName": "CCC", "summary": "Synthetic local fixture for computer knowledge.", "language": "Hindi", "level": "beginner", "amountMinor": 12050, "currency": "inr", "category": {"id": CATEGORY_ID, "name": "Computer qualification"}, "thumbnail": {"url": ""}, "instructorName": "Public teaching name", "hasPreview": True}
DETAIL = {"course": {**CARD, "description": "Owner-written fixture course details.", "audience": "Synthetic government-exam aspirants", "learningOutcomes": ["Synthetic learning outcome"], "requirements": [], "instructorBio": "Explicitly public teaching bio.", "support": {}, "policies": {}}, "modules": [{"title": "Basics", "lessons": [{"title": "Text sample", "contentType": "text", "duration": 0, "preview": True}, {"title": "Protected lesson", "contentType": "video", "duration": 30, "preview": False}]}]}


def run_checks(browser, media, evidence):
    contexts, errors, unexpected = [], [], []

    def fixture(role=None, theme="light", sample_kind="text"):
        context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
        contexts.append(context)
        context.add_init_script(f"if (!localStorage.getItem('lessonloop_theme')) localStorage.setItem('lessonloop_theme', '{theme}')")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        state = {"empty": False, "fail_list": False, "fail_preview": False, "missing": False, "preview_calls": 0, "queries": [], "payloads": [], "detail": deepcopy(DETAIL)}
        if sample_kind == "video":
            state["detail"]["modules"][0]["lessons"][0].update(title="Video sample", contentType="video")
        managed = {"_id": COURSE_ID, "title": CARD["title"], "slug": CARD["slug"], "description": "Owner-written fixture", "category": {"_id": CATEGORY_ID}, "language": "Hindi", "level": "beginner", "price": 120.5, "isPublished": True, "visibility": "private", "requirements": [], "learningOutcomes": []}
        modules = [{"_id": "module-fixture", "title": "Basics", "lessons": [{"_id": TEXT_ID, "title": "Text sample", "contentType": "text", "content": "Owner-authored fixture text"}, {"_id": VIDEO_ID, "title": "Video sample", "contentType": "video", "video": {"_id": "video-fixture", "status": "ready", "filename": "fixture.mp4", "duration": 30}}]}]

        def respond(route):
            request, url = route.request, urlparse(route.request.url)
            if f"{url.scheme}://{url.netloc}" != ORIGIN:
                unexpected.append(request.url); route.abort(); return
            if url.path == "/__fixture__/sample.mp4":
                headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
                byte_range = request.headers.get("range")
                if byte_range:
                    start, end = byte_range.removeprefix("bytes=").split("-")
                    start, end = int(start or 0), int(end) if end else len(media) - 1
                    headers["Content-Range"] = f"bytes {start}-{end}/{len(media)}"
                    route.fulfill(status=206, content_type="video/mp4", headers=headers, body=media[start:end + 1])
                else: route.fulfill(content_type="video/mp4", headers=headers, body=media)
                return
            if not url.path.startswith("/api/"): route.continue_(); return
            data = None
            if url.path == "/api/auth/me":
                if not role: route.fulfill(status=401, json={"message": "Sign in required"}); return
                data = {"user": {"id": harness.STUDENT_ID, "name": "Private account fixture", "role": role, "status": "active", "mustChangePassword": False}}
            elif url.path == "/api/public/courses":
                state["queries"].append(parse_qs(url.query))
                if state["fail_list"]: route.fulfill(status=503, json={"message": "Fixture unavailable. Please retry."}); return
                data = {"courses": [] if state["empty"] else [CARD], "total": 0 if state["empty"] else 1, "page": 1, "limit": 12, "categories": [{"id": CATEGORY_ID, "name": "Computer qualification"}]}
            elif url.path.startswith("/api/public/courses/"):
                if state["missing"]: route.fulfill(status=404, json={"message": "Public course not found."}); return
                if url.path.endswith("/preview"):
                    state["preview_calls"] += 1
                    if state["fail_preview"]: route.fulfill(status=404, json={"message": "This sample lesson is unavailable."}); return
                    preview = {"title": "Text sample", "contentType": "text", "content": "Public sample\nUseful second line. <script>plaintext</script>"} if sample_kind == "text" else {"title": "Video sample", "contentType": "video", "url": ORIGIN + f"/__fixture__/sample.mp4?ticket={state['preview_calls']}", "expiresAt": page.evaluate("Date.now() + 300000")}
                    data = {"preview": preview}
                else: data = state["detail"]
            elif url.path == "/api/categories": data = {"categories": [{"_id": CATEGORY_ID, "name": "Computer qualification"}]}
            elif url.path == f"/api/courses/mine/{COURSE_ID}": data = {"course": managed, "modules": modules}
            elif url.path == f"/api/courses/{COURSE_ID}" and request.method == "PATCH":
                payload = request.post_data_json; state["payloads"].append(payload); managed.update(payload); data = {"course": managed}
            elif url.path == "/api/courses" and request.method == "POST":
                payload = request.post_data_json; state["payloads"].append(payload); managed.update(payload); data = {"course": managed}
            elif url.path == f"/api/courses/{COURSE_ID}/lessons/{TEXT_ID}" and request.method == "PATCH":
                modules[0]["lessons"][0]["content"] = request.post_data_json["content"]; data = {"lesson": modules[0]["lessons"][0]}
            elif url.path == f"/api/courses/{COURSE_ID}/modules/module-fixture/lessons" and request.method == "POST":
                payload = request.post_data_json; state["payloads"].append(payload); modules[0]["lessons"].append({"_id": "new-text-fixture", **payload}); data = {"lesson": modules[0]["lessons"][-1]}
            elif url.path == f"/api/courses/{COURSE_ID}/notes": data = {"notes": []}
            elif url.path == f"/api/courses/{COURSE_ID}/assignments": data = {"assignments": []}
            else:
                unexpected.append(request.url); route.fulfill(status=500, json={"message": "Unconfigured fixture"}); return
            route.fulfill(json={"data": data})

        context.route("**/*", respond)
        return page, state

    def fits(page, label): harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), label)

    try:
        page, state = fixture()
        page.goto(ORIGIN)
        expect(page.get_by_role("heading", name="Padhai, apne pace pe.")).to_be_visible()
        expect(page.get_by_role("heading", name=CARD["title"])).to_be_visible()
        harness.check(page.locator(".course-art").first.evaluate("element => element.getBoundingClientRect().height > 100"), "course cover has a visible frame even without an image")
        harness.check("only CCC" not in page.locator("body").inner_text(), "brand remains government-exam learning; courses come from inventory")
        page.get_by_label("Search courses", exact=True).fill("CCC")
        with page.expect_response(lambda response: response.url.startswith(ORIGIN + "/api/public/courses?") and parse_qs(urlparse(response.url).query).get("q") == ["CCC"]):
            page.get_by_role("button", name="Search", exact=True).click()
        expect(page.get_by_role("heading", name=CARD["title"])).to_be_visible()
        harness.check(state["queries"][-1].get("q") == ["CCC"], "search is submitted to the public catalog")
        with page.expect_response(lambda response: parse_qs(urlparse(response.url).query).get("category") == [CATEGORY_ID]):
            page.get_by_label("Category", exact=True).select_option(CATEGORY_ID)
        expect(page.get_by_role("heading", name=CARD["title"])).to_be_visible()
        harness.check(state["queries"][-1].get("category") == [CATEGORY_ID], "actual inventory category is submitted")
        page.get_by_role("link", name="View course", exact=True).click()
        expect(page.get_by_role("heading", name="About this course")).to_be_visible()
        harness.check(state["preview_calls"] == 0, "sample content is requested only when opened")
        page.get_by_role("button", name="Open sample lesson").click()
        expect(page.get_by_text("Public sample\nUseful second line. <script>plaintext</script>", exact=True)).to_be_visible()
        harness.check(page.locator("#sample script").count() == 0, "sample text renders safely as plain text")
        expect(page.get_by_text("The instructor has not provided a public support contact yet.")).to_be_visible()
        harness.check(page.get_by_role("navigation", name="Course policies").count() == 0, "missing policy links are not invented")
        for theme in ["light", "dark"]:
            if theme == "dark": page.get_by_role("button", name="Switch to dark theme").click()
            for width in [320, 1280]:
                harness.check(page.locator("html").evaluate("element => element.classList.contains('dark')") == (theme == "dark"), f"{theme} theme is active")
                page.set_viewport_size({"width": width, "height": 900}); fits(page, f"public details and text sample fit {width}px {theme}")
                page.screenshot(path=str(evidence / f"public-course-{width}-{theme}.png"), full_page=True)
                page.goto(ORIGIN + "/catalog"); expect(page.get_by_role("heading", name=CARD["title"])).to_be_visible(); fits(page, f"public catalog fits {width}px {theme}")
                page.screenshot(path=str(evidence / f"public-catalog-{width}-{theme}.png"), full_page=True)
                page.goto(ORIGIN); expect(page.get_by_role("heading", name="Padhai, apne pace pe.")).to_be_visible(); fits(page, f"public home fits {width}px {theme}")
                page.screenshot(path=str(evidence / f"public-home-{width}-{theme}.png"), full_page=True)
                page.goto(ORIGIN + "/catalog/synthetic-ccc"); expect(page.get_by_role("heading", name="About this course")).to_be_visible()
        state["fail_list"] = True; page.goto(ORIGIN + "/catalog")
        expect(page.get_by_role("alert")).to_contain_text("Fixture unavailable")
        state["fail_list"] = False; page.get_by_role("button", name="Retry courses").click(); expect(page.get_by_role("heading", name=CARD["title"])).to_be_visible()
        state["empty"] = True; page.goto(ORIGIN + "/catalog"); expect(page.get_by_role("heading", name="Courses will appear here when published")).to_be_visible()
        state["missing"] = True; page.goto(ORIGIN + "/catalog/private-course"); expect(page.get_by_role("heading", name="Course unavailable")).to_be_visible()
        harness.check(True, "catalog handles errors, retry, empty inventory and unavailable/private courses")

        video_page, video_state = fixture(sample_kind="video")
        video_page.goto(ORIGIN + "/catalog/synthetic-ccc"); video_page.get_by_role("button", name="Open sample lesson").click()
        video_page.wait_for_function("document.querySelector('video')?.readyState >= 2")
        harness.check(video_state["preview_calls"] >= 1 and video_page.locator(".private-player-watermark").count() == 0, "public sample uses selected preview endpoint without learner identity")
        video_state["fail_preview"] = True
        video_page.evaluate("window.fixtureNow = Date.now; Date.now = () => window.fixtureNow() + 290000; document.querySelector('video').currentTime = 3")
        expect(video_page.get_by_role("alert")).to_contain_text("sample lesson is unavailable")
        harness.check(video_page.locator("video").count() == 0, "public sample player stops when fresh preview permission is withdrawn")
        video_page.evaluate("Date.now = window.fixtureNow")
        video_state["fail_preview"] = False; video_page.get_by_role("button", name="Retry playback").click(); video_page.wait_for_function("document.querySelector('video')?.readyState >= 2")

        owner, owner_state = fixture("instructor")
        owner.goto(ORIGIN + f"/instructor/courses/{COURSE_ID}/edit")
        expect(owner.get_by_role("radio", name="Private", exact=True)).to_be_checked()
        expect(owner.get_by_label("Course price (INR)")).to_have_value("120.5")
        owner.get_by_role("radio", name="Public", exact=True).check(); owner.get_by_label("Exam or qualification name").fill("CCC")
        owner.get_by_label("Public sample lesson").select_option(TEXT_ID)
        owner.get_by_role("button", name="Save course details").click()
        expect(owner.get_by_role("heading", name="Public discovery: Public")).to_be_visible()
        payload = owner_state["payloads"][-1]
        harness.check(payload["visibility"] == "public" and payload["previewLesson"] == TEXT_ID and payload["price"] == "120.5", "owner edits public settings without altering existing paid price")
        owner.get_by_label("Lesson text", exact=True).fill("Updated owner-authored sample")
        owner.get_by_role("button", name="Save lesson text").click(); expect(owner.get_by_role("status").filter(has_text="Lesson text saved.")).to_be_visible()
        owner.get_by_label("New lesson title").fill("New text sample"); owner.get_by_label("Lesson format").select_option("text"); owner.get_by_label("New lesson text").fill("New author-written example")
        owner.get_by_role("button", name="Add text lesson").click(); expect(owner.get_by_role("heading", name="New text sample")).to_be_visible()
        harness.check(owner_state["payloads"][-1]["contentType"] == "text", "curriculum creates and edits text sample content")
        owner.goto(ORIGIN + "/instructor/courses/new")
        expect(owner.get_by_role("radio", name="Private", exact=True)).to_be_checked(); expect(owner.get_by_role("radio", name="Free", exact=False)).to_be_checked()
        harness.check(owner.get_by_label("Course price (INR)").is_hidden(), "new courses default private and free with paid price hidden")
        for theme in ["light", "dark"]:
            if theme == "dark": owner.get_by_role("button", name="Switch to dark theme").click()
            owner.set_viewport_size({"width": 320, "height": 900}); fits(owner, f"owner public settings fit 320px {theme}")
        harness.check(not errors, f"no browser JavaScript errors: {errors}")
        harness.check(not unexpected, f"no protected/unexpected API or external requests: {unexpected}")
    finally:
        for context in contexts: context.close()


if __name__ == "__main__":
    harness.run_checks = run_checks
    harness.main()
