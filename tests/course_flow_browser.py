"""Isolated UI regression checks; server authorization is tested by the backend suite."""
import re
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect
import student_player_browser as harness

ORIGIN = harness.ORIGIN
def synthetic_pdf():
    text = b"BT /F1 16 Tf 50 700 Td (Synthetic private handout) Tj ET"
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>", b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", b"<< /Length " + str(len(text)).encode() + b" >>\nstream\n" + text + b"\nendstream"]
    pdf, offsets = b"%PDF-1.4\n", [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf)); pdf += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(pdf)
    pdf += b"xref\n0 6\n0000000000 65535 f \n" + b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    return pdf + f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()


PDF = synthetic_pdf()


def run_checks(browser, _media, evidence):
    contexts, errors, unexpected, waiting = [], [], [], []
    closing = False
    course = {"_id": "course-fixture", "title": "Private handouts", "description": "Synthetic local course", "category": {"_id": "category-fixture"}, "level": "beginner", "language": "English", "instructor": {"name": "Demo instructor"}, "isPublished": False}
    state = {"course": course, "modules": [], "notes": [], "assignments": [], "fail_upload": False, "upload_ids": [], "links": []}

    def fixture(role="instructor", theme="light", pending_path=None):
        context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
        contexts.append(context)
        page = context.new_page()
        pending = []
        waiting.append(pending)
        context.add_init_script(f"localStorage.setItem('lessonloop_theme', '{theme}')")
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("dialog", lambda dialog: dialog.accept())

        def respond(route):
            if closing:
                route.abort(); return
            request, url = route.request, urlparse(route.request.url)
            if f"{url.scheme}://{url.netloc}" != ORIGIN:
                unexpected.append(request.url); route.abort(); return
            if not url.path.startswith("/api/"):
                if url.path == "/__fixture__/handout":
                    route.fulfill(content_type="text/plain", body="Synthetic private PDF navigation fixture")
                else:
                    route.continue_()
                return
            if url.path == pending_path:
                pending.append(route); return
            data = None
            if url.path == "/api/auth/me":
                data = {"user": {"id": harness.STUDENT_ID, "name": "Demo account", "role": role, "status": "active", "mustChangePassword": False}}
            elif url.path == "/api/categories":
                data = {"categories": [{"_id": "category-fixture", "name": "General"}]}
            elif url.path == "/api/courses" and request.method == "POST":
                body = request.post_data_json
                harness.check(body.get("setupLessons") is True, "creation requests a default Lessons module")
                state["course"].update(body)
                state["modules"] = [{"_id": "module-fixture", "title": "Lessons", "lessons": []}]
                data = {"course": state["course"]}
            elif url.path in ["/api/courses", "/api/courses/mine"]:
                data = {"courses": [state["course"]]}
            elif url.path in ["/api/courses/mine/course-fixture", "/api/courses/course-fixture"]:
                data = {"course": state["course"], "modules": state["modules"]}
            elif harness.fulfill_learning_place(route, url): return
            elif url.path == "/api/courses/course-fixture/progress":
                data = {"progress": {"completedLessons": [], "percentage": 0}}
            elif url.path == "/api/courses/course-fixture/assignments":
                if request.method == "POST":
                    harness.check(request.post_data_json.get("makeAvailable") is True, "assignment requests readiness-checked access without a publish click")
                    if not state["notes"]:
                        route.fulfill(status=409, json={"message": "Add a lesson or PDF note before sharing with students."}); return
                    state["course"]["isPublished"] = True
                    state["assignments"] = [{"_id": "assignment-fixture", "student": {"_id": "student-fixture", "name": "Demo learner", "email": "learner@example.invalid"}, "status": "active"}]
                data = {"assignments": state["assignments"]}
            elif url.path == "/api/courses/course-fixture/notes":
                if request.method == "POST":
                    harness.check("multipart/form-data; boundary=" in request.headers.get("content-type", ""), "PDF request uses multipart file upload")
                    body = request.post_data_buffer.decode("latin1")
                    upload_id = re.search(r'name="uploadId"\r\n\r\n([^\r]+)', body).group(1)
                    state["upload_ids"].append(upload_id)
                    if state["fail_upload"]:
                        route.fulfill(status=503, json={"message": "Storage is temporarily unavailable."}); return
                    note = {"id": f"note-{len(state['notes']) + 1}", "filename": f"handout-{len(state['notes']) + 1}.pdf", "size": len(PDF), "pages": 1, "status": "ready"}
                    state["notes"].append(note); data = {"note": note}
                else:
                    data = {"notes": state["notes"]}
            elif re.match(r"/api/courses/course-fixture/notes/note-\d+/url$", url.path):
                state["links"].append(parse_qs(url.query).get("download", ["false"])[0])
                data = {"url": ORIGIN + "/__fixture__/handout", "expiresAt": 9999999999999}
            elif url.path == "/api/enrollments/me":
                data = {"enrollments": []}
            elif url.path == "/api/admin/overview":
                data = {"students": 0, "courses": 1}
            elif url.path == "/api/admin/users":
                data = {"users": [], "total": 0, "page": 1, "limit": 20}
            else:
                unexpected.append(request.url); route.fulfill(status=500, json={"message": "Unknown fixture"}); return
            route.fulfill(json={"data": data, "message": "Course shared with assigned students." if request.method == "POST" and url.path.endswith("assignments") else "OK"})

        context.route("**/*", respond)
        return page, context, pending

    try:
        page, context, _ = fixture()
        page.goto(ORIGIN + "/instructor/courses/new")
        page.get_by_label("Course title", exact=True).fill("Private handouts")
        page.get_by_label("Description", exact=True).fill("Synthetic local course")
        page.get_by_role("button", name="Continue to content").click()
        expect(page.get_by_role("heading", name="Lessons", exact=True)).to_be_visible()
        harness.check(page.get_by_role("button", name="Publish course", exact=True).count() == 0, "new course flow has no mandatory draft/publish action")
        page.get_by_label("Student email addresses").fill("learner@example.invalid")
        page.get_by_role("button", name="Assign course", exact=True).click()
        expect(page.get_by_role("alert")).to_contain_text("Add a lesson or PDF note")
        page.get_by_label("PDF course note", exact=True).set_input_files({"name": "wrong.txt", "mimeType": "text/plain", "buffer": b"fixture"})
        expect(page.get_by_role("alert").filter(has_text="Choose a PDF")).to_be_visible()
        state["fail_upload"] = True
        page.get_by_label("PDF course note", exact=True).set_input_files({"name": "handout.pdf", "mimeType": "application/pdf", "buffer": PDF})
        page.get_by_role("button", name="Upload PDF", exact=True).click()
        expect(page.get_by_role("alert").filter(has_text="selected file is kept")).to_be_visible()
        state["fail_upload"] = False
        page.get_by_role("button", name="Upload PDF", exact=True).click()
        expect(page.get_by_role("heading", name="handout-1.pdf")).to_be_visible()
        harness.check(state["upload_ids"][0] == state["upload_ids"][1], "UI retries the same upload identifier after storage failure")
        page.get_by_label("PDF course note", exact=True).set_input_files({"name": "second.pdf", "mimeType": "application/pdf", "buffer": PDF})
        page.get_by_role("button", name="Upload PDF", exact=True).click()
        expect(page.get_by_role("heading", name="handout-2.pdf")).to_be_visible()
        page.get_by_label("Student email addresses").fill("learner@example.invalid")
        page.get_by_role("button", name="Assign course", exact=True).click()
        expect(page.get_by_text("Visible to all students. Videos open for assigned students", exact=False)).to_be_visible()
        harness.check(len(state["notes"]) == 2, "course creation, multiple PDFs and assignment complete without publication step")
        for theme in ["light", "dark"]:
            if theme == "dark": page.get_by_role("button", name="Switch to dark theme").click()
            page.set_viewport_size({"width": 390, "height": 844})
            harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"course management fits mobile {theme} theme")
            page.screenshot(path=str(evidence / f"course-notes-mobile-{theme}.png"), full_page=True)

        student, student_context, _ = fixture("student")
        student.goto(ORIGIN + "/courses/course-fixture")
        expect(student.get_by_role("heading", name="handout-1.pdf")).to_be_visible()
        harness.check(student.get_by_role("button", name="Upload PDF", exact=True).count() == 0 and student.get_by_role("button", name="Remove handout-1.pdf").count() == 0, "student notes provide read actions without mutation controls")
        for name in ["Open handout-1.pdf", "Download handout-1.pdf"]:
            with student_context.expect_page() as opened:
                student.get_by_role("button", name=name, exact=True).click()
            popup = opened.value
            popup.wait_for_url(ORIGIN + "/__fixture__/handout")
            harness.check(popup.evaluate("window.opener === null"), f"{name} opens an isolated tab")
            popup.close()
        harness.check(state["links"][-2:] == ["false", "true"], "Open and Download request their corresponding signed dispositions")

        for path, role, api, label in [("/courses", "student", "/api/courses", "courses"), ("/student", "student", "/api/courses", "dashboard"), ("/instructor/courses", "instructor", "/api/courses/mine", "instructor"), ("/courses/course-fixture", "student", "/api/courses/course-fixture", "detail"), ("/admin", "admin", "/api/admin/users", "admin")]:
            for theme in ["light", "dark"]:
                skeleton, _, pending = fixture(role, theme, api)
                skeleton.goto(ORIGIN + path)
                expect(skeleton.locator(".skeleton").first).to_be_visible()
                harness.check(skeleton.locator("[aria-busy='true']").count() > 0, f"{label} {theme} skeleton announces loading")
                skeleton.emulate_media(reduced_motion="reduce")
                harness.check(skeleton.locator(".skeleton").first.evaluate("e => getComputedStyle(e).animationName") == "none", f"{label} {theme} respects reduced motion")
                for route in pending[:]: route.fulfill(status=503, json={"message": "Fixture unavailable. Retry shortly."})
                pending.clear()
                expect(skeleton.get_by_role("alert")).to_contain_text("Fixture unavailable")
                expect(skeleton.locator(".skeleton")).to_have_count(0)
                harness.check(True, f"{label} {theme} skeleton resolves to a visible error")
                skeleton.close()
        # Course-list retry resolves into a real empty state.
        empty, _, pending = fixture("student", pending_path="/api/courses")
        empty.goto(ORIGIN + "/courses")
        expect(empty.locator(".skeleton").first).to_be_visible()
        pending.pop().fulfill(status=503, json={"message": "Fixture unavailable"})
        empty.get_by_role("button", name="Retry courses").click()
        expect(empty.locator(".skeleton").first).to_be_visible()
        pending.pop().fulfill(json={"data": {"courses": []}})
        expect(empty.get_by_text("No published courses yet.")).to_be_visible()
        harness.check(True, "course-list retry resolves to an empty state")
        harness.check(not errors, f"no browser runtime errors: {errors}")
        harness.check(not unexpected, f"all requests isolated: {unexpected}")
    finally:
        closing = True
        for pending in waiting:
            while pending:
                route = pending.pop()
                try: route.abort()
                except Exception: pass  # Its page may already have closed after the test.
        for context in contexts:
            context.unroute_all(behavior="wait")
            context.close()


if __name__ == "__main__":
    harness.run_checks = run_checks
    harness.main()
