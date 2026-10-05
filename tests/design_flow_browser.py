"""Synthetic local UI checks for thumbnails, dialogs, course details and AAC audio.

The backend suite checks real authorization/persistence separately. All browser
API/media requests here are fixtures; external requests are blocked.
"""
import io
import re
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import expect
import student_player_browser as harness

out = io.BytesIO()
Image.new("RGB", (640, 360), "#48bfb5").save(out, format="PNG")
PNG = out.getvalue()


def run_checks(browser, media, evidence):
    contexts, errors, native_dialogs, unexpected, held = [], [], [], [], []
    closing = False
    def fixture(role="instructor", theme="light"):
        context = browser.new_context(viewport={"width":1280,"height":900}, service_workers="block")
        contexts.append(context)
        context.add_init_script(f"if (!localStorage.getItem('lessonloop_theme')) localStorage.setItem('lessonloop_theme','{theme}')")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("dialog", lambda dialog: (native_dialogs.append(dialog.type), dialog.dismiss()))
        course = {"_id":"course-fixture","title":"Learning design","description":"Synthetic local course","category":{"_id":"category-fixture","name":"Design"},"instructor":{"name":"Maya Shah"},"level":"beginner","language":"English","isPublished":True,"requirements":["A notebook"],"learningOutcomes":["Create a learning objective"]}
        lesson = {"_id":"lesson-fixture","title":"A thoughtful first lesson","contentType":"video","video":{"_id":"video-fixture","status":"ready","uploadMode":"direct","filename":"lesson.mp4"}}
        state = {"course":course,"modules":[{"_id":"module-fixture","title":"Lessons","lessons":[lesson]}],"notes":[{"id":"note-fixture","filename":"guide.pdf","pages":1,"size":1000,"status":"ready"}],"assignments":[{"student":{"_id":"student-fixture","name":"Avery Morgan","email":"avery@example.invalid"},"status":"active"}],"upload_fail":True,"version":0,"calls":[],"pending":False}
        def respond(route):
            if closing: route.abort();return
            request, url = route.request, urlparse(route.request.url)
            if url.netloc != "127.0.0.1:5186": unexpected.append(request.url);route.abort();return
            if url.path == "/__fixture__/video.mp4": route.fulfill(content_type="video/mp4",body=media);return
            if not url.path.startswith("/api/"): route.continue_();return
            state["calls"].append((request.method,url.path))
            if state["pending"] and request.method=="DELETE" and "/lessons/" in url.path: held.append(route);return
            if url.path=="/api/auth/me": data={"user":{"id":harness.STUDENT_ID,"name":"Avery Morgan" if role=="student" else "Maya Shah","role":role,"status":"active"}}
            elif url.path=="/api/categories": data={"categories":[course["category"]]}
            elif url.path in ["/api/courses","/api/courses/mine"]: data={"courses":[course]}
            elif url.path in ["/api/courses/course-fixture","/api/courses/mine/course-fixture"]: data={"course":course,"modules":state["modules"]}
            elif url.path=="/api/courses/course-fixture/thumbnail":
                if request.method=="GET": route.fulfill(content_type="image/png",body=PNG);return
                assert "multipart/form-data; boundary=" in request.headers["content-type"]
                if state["upload_fail"]: route.fulfill(status=503,json={"message":"Fixture storage unavailable."});return
                state["version"]+=1;course["thumbnail"]={"url":f"/api/courses/course-fixture/thumbnail?v={state['version']}"};data={"course":course}
            elif harness.fulfill_learning_place(route, url): return
            elif url.path=="/api/courses/course-fixture/progress": data={"progress":{"completedLessons":[],"percentage":0}}
            elif url.path.endswith("/notes"):
                data={"notes":state["notes"]}
            elif "/notes/" in url.path and request.method=="DELETE": state["notes"]=[];data={}
            elif url.path.endswith("/assignments"): data={"assignments":state["assignments"]}
            elif "/assignments/" in url.path and request.method=="DELETE": state["assignments"]=[];data={}
            elif url.path=="/api/lessons/lesson-fixture/playback": data={"url":harness.ORIGIN+"/__fixture__/video.mp4","expiresAt":9999999999999}
            elif "/lessons/" in url.path and request.method=="PATCH": lesson["title"]=request.post_data_json["title"];data={"lesson":lesson}
            elif "/lessons/" in url.path and request.method=="DELETE": state["modules"][0]["lessons"]=[];data={}
            elif url.path=="/api/uploads/video-fixture" and request.method=="DELETE": lesson["video"]=None;data={}
            else: unexpected.append(request.url);route.fulfill(status=500,json={"message":"Unknown fixture"});return
            route.fulfill(json={"data":data})
        context.route("**/*",respond)
        return page,state
    try:
        for theme in ["light","dark"]:
            page,state=fixture(theme=theme)
            page.goto(harness.ORIGIN+"/instructor/courses/course-fixture/curriculum")
            expect(page.get_by_role("heading",name="Course thumbnail")).to_be_visible()
            upload=page.get_by_role("button",name="Save thumbnail",exact=True)
            expect(upload).to_be_disabled()
            page.get_by_label("Choose course thumbnail",exact=True).set_input_files({"name":"wrong.txt","mimeType":"text/plain","buffer":b"wrong"})
            expect(page.get_by_role("alert").filter(has_text="Choose a JPEG")).to_be_visible()
            page.get_by_label("Choose course thumbnail",exact=True).set_input_files({"name":"cover.png","mimeType":"image/png","buffer":PNG})
            expect(page.get_by_text("Selected image preview · save to apply")).to_be_visible()
            upload.click();expect(page.get_by_role("alert").filter(has_text="kept for retry")).to_be_visible()
            state["upload_fail"]=False
            upload.click();expect(page.get_by_role("status").filter(has_text="Course thumbnail saved")).to_be_visible()
            expect(page.locator(".thumbnail-editor .course-image")).to_have_attribute("src",re.compile(r"thumbnail\?v=1"))
            page.reload();expect(page.get_by_label("Replace course thumbnail",exact=True)).to_be_visible()
            page.get_by_label("Replace course thumbnail",exact=True).set_input_files({"name":"replacement.png","mimeType":"image/png","buffer":PNG})
            upload.click();expect(page.locator(".thumbnail-editor .course-image")).to_have_attribute("src",re.compile(r"thumbnail\?v=2"))
            harness.check(True,f"thumbnail type error, retained retry, save/reload and replacement work in {theme}")

            page.get_by_label("Actions for A thoughtful first lesson",exact=True).click()
            page.get_by_role("button",name="Rename lesson",exact=True).click()
            dialog=page.get_by_role("dialog",name="Rename lesson")
            expect(dialog).to_be_visible();expect(dialog.get_by_label("Lesson title",exact=True)).to_be_focused()
            for _ in range(7): page.keyboard.press("Tab");assert page.evaluate("Boolean(document.activeElement.closest('dialog'))")
            page.keyboard.press("Escape");expect(dialog).not_to_be_visible()
            expect(page.get_by_label("Actions for A thoughtful first lesson",exact=True)).to_be_focused()
            page.get_by_label("Actions for A thoughtful first lesson",exact=True).click();page.keyboard.press("Escape")
            assert not page.locator(".lesson-actions").evaluate("e=>e.open")
            page.get_by_label("Actions for A thoughtful first lesson",exact=True).click();page.get_by_role("button",name="Rename lesson",exact=True).click()
            field=dialog.get_by_label("Lesson title",exact=True);field.fill("   ")
            expect(dialog.get_by_role("button",name="Save lesson title")).to_be_disabled()
            field.fill("Renamed lesson");dialog.get_by_role("button",name="Save lesson title").click()
            expect(page.get_by_role("heading",name="Renamed lesson",exact=True)).to_be_visible()
            harness.check(True,f"rename form validates, traps/restores focus and saves in {theme}")

            before=sum(method=="DELETE" for method,_ in state["calls"])
            page.get_by_role("button",name="Remove guide.pdf").click();dialog=page.get_by_role("dialog",name="Remove this PDF?")
            dialog.get_by_role("button",name="Cancel",exact=True).click();assert sum(method=="DELETE" for method,_ in state["calls"])==before
            page.get_by_role("button",name="Remove guide.pdf").click();dialog.get_by_role("button",name="Remove PDF",exact=True).click()
            expect(page.get_by_text("No PDF notes yet.")).to_be_visible()
            page.get_by_role("button",name="Remove assignment",exact=True).click();dialog=page.get_by_role("dialog",name="Remove instructor assignment?")
            dialog.get_by_role("button",name="Remove assignment",exact=True).click();expect(page.get_by_text("No students assigned yet.")).to_be_visible()
            harness.check(True,f"PDF/access destructive actions require in-app confirmation in {theme}")

            page.get_by_label("Actions for Renamed lesson",exact=True).click();page.get_by_role("button",name="Delete lesson",exact=True).click()
            dialog=page.get_by_role("dialog",name="Delete this lesson?")
            state["pending"]=True;dialog.get_by_role("button",name="Delete lesson",exact=True).click();page.keyboard.press("Enter");page.keyboard.press("Escape")
            expect(dialog).to_be_visible();expect(dialog.get_by_role("button",name="Cancel",exact=True)).to_be_disabled()
            assert len(held)==1
            held.pop().fulfill(status=503,json={"message":"Fixture operation failed. Retry safely."});state["pending"]=False
            expect(dialog.get_by_role("alert")).to_contain_text("Retry safely")
            page.set_viewport_size({"width":320,"height":844})
            assert dialog.bounding_box()["width"]<=288
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            page.screenshot(path=str(evidence/f"confirmation-mobile-{theme}.png"),full_page=True,animations="disabled")
            dialog.get_by_role("button",name="Delete lesson",exact=True).click();expect(dialog).not_to_be_visible()
            assert state["modules"][0]["lessons"]==[]
            harness.check(True,f"pending double submit/Escape blocked, failure retained and retry succeeds at 320px in {theme}")

            page.goto(harness.ORIGIN+"/instructor/courses")
            expect(page.locator(".course-card .course-image")).to_have_attribute("src",re.compile(r"thumbnail\?v=2"))
            page.goto(harness.ORIGIN+"/courses/course-fixture")
            expect(page.locator(".course-overview .course-image")).to_have_attribute("src",re.compile(r"thumbnail\?v=2"))
            expect(page.get_by_text("Create a learning objective",exact=True)).to_be_visible()
            page.goto(harness.ORIGIN+"/instructor/courses/course-fixture/edit")
            page.get_by_label("Course title",exact=True).fill("Unsaved title")
            page.get_by_role("link",name="Cancel",exact=True).click();dialog=page.get_by_role("dialog",name="Discard unsaved changes?")
            dialog.get_by_role("button",name="Cancel",exact=True).click();expect(page.get_by_label("Course title",exact=True)).to_have_value("Unsaved title")
            page.get_by_role("link",name="Cancel",exact=True).click();page.go_back();expect(dialog).not_to_be_visible()
            harness.check(True,f"cover reaches cards/header, real metadata appears and route back dismisses dialog in {theme}")

        student,state=fixture("student")
        state["course"]["thumbnail"]={"url":"/api/courses/course-fixture/thumbnail?v=1"}
        student.goto(harness.ORIGIN+"/courses/course-fixture")
        student.get_by_role("button",name="Start learning").click()
        assert student.locator(".course-content-panel").evaluate("e=>e===document.activeElement")
        assert not student.get_by_role("button",name="Save thumbnail",exact=True).count()
        student.wait_for_function("document.querySelector('video')?.readyState>=2")
        assert student.locator("video").evaluate("v=>!v.muted && v.volume===1")
        student.locator("video").evaluate("v=>{v.muted=true;return v.play()}")
        student.wait_for_function("document.querySelector('video').currentTime>.5 && document.querySelector('video').webkitAudioDecodedByteCount>0")
        harness.check(True,"H.264/AAC MP4 audio decodes; player starts with sound enabled and student upload controls absent")
        student.set_viewport_size({"width":390,"height":844});student.emulate_media(reduced_motion="reduce")
        assert student.evaluate("getComputedStyle(document.documentElement).scrollBehavior==='auto'")
        assert student.evaluate("document.documentElement.scrollWidth<=innerWidth")
        harness.check(not errors,f"no browser runtime errors: {errors}")
        harness.check(not native_dialogs,f"no app-owned native dialogs: {native_dialogs}")
        harness.check(not unexpected,f"all network requests isolated: {unexpected}")
    finally:
        closing=True
        while held:
            try: held.pop().abort()
            except Exception: pass
        for context in contexts: context.unroute_all(behavior="wait");context.close()


if __name__=="__main__":
    harness.run_checks=run_checks
    harness.main()
