"""All published metadata is rendered without offering private/unready enrollment.
API responses are synthetic; unexpected learning/payment calls are blocked.
"""
from copy import deepcopy
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import CARD, DETAIL


def run_checks(browser, _media, evidence):
    errors, unexpected, contexts = [], [], []
    inventory = []
    for n in range(14):
        item = {**deepcopy(CARD), "id": f"507f1f77bcf86cd799439{n + 100:03d}", "slug": f"synthetic-course-{n}", "title": ["Assignment course", "Legacy course", "Preparing public course"][n] if n < 3 else f"Synthetic course {n}", "hasPreview": False, "availability": {"enrollment": "assignment" if n < 2 else "public", "ready": n != 2}}
        inventory.append(item)

    def fixture(theme, student=False):
        ctx = browser.new_context(viewport={"width": 320, "height": 900}, service_workers="block")
        contexts.append(ctx); ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
        page = ctx.new_page(); page.on("pageerror", lambda error: errors.append(str(error)))
        calls = []

        def route(r):
            u = urlparse(r.request.url)
            if f"{u.scheme}://{u.netloc}" != harness.ORIGIN: unexpected.append(r.request.url); r.abort(); return
            if not u.path.startswith("/api/"): r.continue_(); return
            calls.append((r.request.method, u.path))
            if u.path == "/api/auth/me":
                if not student: r.fulfill(status=401, json={"message": "Sign in required"}); return
                data = {"user": {"id": harness.STUDENT_ID, "name": "Synthetic learner", "role": "student", "status": "active", "mustChangePassword": False}}
            elif u.path == "/api/public/courses":
                query = parse_qs(u.query); number = int(query.get("page", [1])[0])
                selected = [item for item in inventory if query.get("q", [""])[0].lower() in item["title"].lower()]
                data = {"courses": selected[(number - 1) * 12:number * 12], "total": len(selected), "page": number, "limit": 12, "categories": [CARD["category"]]}
            elif u.path.startswith("/api/public/courses/"):
                item = next((entry for entry in inventory if entry["slug"] == u.path.split("/")[-1]), None)
                if not item: unexpected.append(r.request.url); r.fulfill(status=500, json={"message": "Unexpected sample or course request"}); return
                detail = deepcopy(DETAIL); detail["course"].update(item)
                for module in detail["modules"]:
                    for lesson in module["lessons"]: lesson["preview"] = False
                data = detail
            else:
                unexpected.append(r.request.url); r.fulfill(status=500, json={"message": "Unexpected protected/payment request"}); return
            r.fulfill(json={"data": data})

        ctx.route("**/*", route)
        return page, calls

    try:
        for theme in ["light", "dark"]:
            page, calls = fixture(theme)
            for path in ["/", "/catalog"]:
                page.goto(harness.ORIGIN + path)
                expect(page.locator(".public-course-card")).to_have_count(12)
                expect(page.get_by_text("14 courses available to explore", exact=True)).to_be_visible()
                for title in ["Assignment course", "Legacy course", "Preparing public course"]: expect(page.get_by_role("heading", name=title, exact=True)).to_be_visible()
                expect(page.get_by_text("Instructor assignment required", exact=True)).to_have_count(2)
                expect(page.get_by_text("Materials being prepared", exact=True)).to_have_count(1)
                for width in [320, 1280]:
                    page.set_viewport_size({"width": width, "height": 900})
                    harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"all-course catalog fits {width}px {theme}")
                    page.screenshot(path=str(evidence / f"catalog-all-{path.strip('/') or 'home'}-{width}-{theme}.png"), full_page=True)
                page.get_by_role("button", name="Next", exact=True).click()
                expect(page.locator(".public-course-card")).to_have_count(2)
                expect(page.get_by_text("Page 2 of 2", exact=True)).to_be_visible()
                page.get_by_role("button", name="Previous", exact=True).click()
                expect(page.locator(".public-course-card")).to_have_count(12)
            page.get_by_label("Search courses", exact=True).fill("Legacy")
            page.get_by_role("button", name="Search", exact=True).click()
            expect(page.locator(".public-course-card")).to_have_count(1)
            expect(page.get_by_role("heading", name="Legacy course", exact=True)).to_be_visible()
            for student in [False, True]:
                detail, detail_calls = fixture(theme, student)
                for number in [0, 1, 2]:
                    detail.goto(harness.ORIGIN + "/catalog/" + inventory[number]["slug"])
                    expected = "Materials being prepared" if number == 2 else "Instructor assignment required"
                    expect(detail.get_by_role("heading", name=expected, exact=True)).to_be_visible()
                    expect(detail.get_by_role("button", name="Enroll for free")).to_have_count(0)
                    expect(detail.get_by_role("button", name="Continue to test checkout")).to_have_count(0)
                    expect(detail.get_by_role("link", name="Sign in to enroll")).to_have_count(0)
                    expect(detail.get_by_role("button", name="Open sample lesson")).to_have_count(0)
                    expect(detail.get_by_role("link", name="Check my course access" if student else "Sign in to check access", exact=True)).to_be_visible()
                    harness.check(not any("payment" in path or path.endswith("/enroll") or path.endswith("/preview") for _, path in detail_calls), "private/legacy/unready details do not request payment, enrollment or sample access")
                    detail.set_viewport_size({"width": 320, "height": 900})
                    harness.check(detail.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"policy details fit 320px {theme}")
                    detail.screenshot(path=str(evidence / f"catalog-policy-{number}-{'student' if student else 'visitor'}-{theme}.png"), full_page=True)
            harness.check(True, "anonymous home and catalog render all pages, legacy courses, search and truthful availability")
        harness.check(not unexpected and not errors, f"no protected/payment/external calls or runtime errors: {unexpected}, {errors}")
    finally:
        for ctx in contexts: ctx.close()


if __name__ == "__main__":
    harness.run_checks = run_checks
    harness.main()
