"""Toast behavior and accessibility against local, synthetic auth fixtures only."""
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness


def run_checks(browser, _media, evidence):
    errors, unexpected, contexts = [], [], []
    failure = "Synthetic sign-in failed. Check your connection and retry."

    def fixture(theme, reduced=False):
        ctx = browser.new_context(viewport={"width": 320, "height": 900}, service_workers="block", reduced_motion="reduce" if reduced else "no-preference")
        contexts.append(ctx)
        ctx.add_init_script(f"localStorage.setItem('lessonloop_theme', '{theme}')")
        page = ctx.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        state = {"signed_in": False, "fail": True}

        def route(r):
            u = urlparse(r.request.url)
            if f"{u.scheme}://{u.netloc}" != harness.ORIGIN:
                unexpected.append(r.request.url); r.abort(); return
            if not u.path.startswith("/api/"):
                r.continue_(); return
            user = {"id": harness.STUDENT_ID, "name": "Synthetic learner", "email": "fixture@example.invalid", "role": "student", "status": "active", "mustChangePassword": False}
            if u.path == "/api/auth/me":
                if not state["signed_in"]: r.fulfill(status=401, json={"message": "Sign in required"}); return
                data = {"user": user}
            elif u.path == "/api/auth/login":
                if state["fail"]: r.fulfill(status=503, json={"message": failure}); return
                state["signed_in"] = True; data = {"user": user}
            elif u.path == "/api/courses": data = {"courses": []}
            else:
                unexpected.append(r.request.url); r.fulfill(status=500, json={"message": "Unconfigured fixture"}); return
            r.fulfill(json={"data": data})

        ctx.route("**/*", route)
        return page, state

    def emit(page, kind, text):
        return page.evaluate("async ({kind,text}) => (await import('/src/services/notifications.jsx')).toast[kind](text)", {"kind": kind, "text": text})

    def dismiss_all(page):
        while page.locator(".Toastify__toast[data-in='true']").count():
            current = page.locator(".Toastify__toast[data-in='true']").first
            identifier = current.get_attribute("id")
            current.get_by_role("button", name="Dismiss notification").click()
            expect(page.locator(f'[id="{identifier}"]')).to_have_count(0)

    try:
        for theme in ["light", "dark"]:
            page, state = fixture(theme)
            page.goto(harness.ORIGIN + "/login")
            page.get_by_label("Email", exact=True).fill("fixture@example.invalid")
            page.get_by_label("Password", exact=True).fill("synthetic-password")
            page.get_by_role("button", name="Sign in", exact=True).click()
            expect(page.get_by_role("alert")).to_contain_text(failure)
            page.get_by_role("button", name="Sign in", exact=True).click()
            expect(page.get_by_role("alert")).to_have_count(1)
            page.wait_for_function("[...document.querySelectorAll('.Toastify__toast')].every(e => e.getAnimations().every(a => a.playState !== 'running'))")
            harness.check(page.get_by_role("alert").locator(".notification-icon").get_attribute("aria-hidden") == "true", theme + " error has a text label and decorative icon")
            close = page.get_by_role("button", name="Dismiss notification")
            harness.check(close.evaluate("e => e.getBoundingClientRect().width >= 44 && e.getBoundingClientRect().height >= 44"), theme + " dismiss target is at least 44px")
            for width in [320, 1280]:
                page.set_viewport_size({"width": width, "height": 900})
                harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"error toast fits {width}px {theme}")
                harness.check(page.locator(".Toastify__toast[data-in='true']").evaluate("e => {const r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight}"), "settled toast is fully visible")
                page.screenshot(path=str(evidence / f"toast-error-{width}-{theme}.png"))
            page.wait_for_timeout(4800)
            expect(page.get_by_role("alert")).to_contain_text(failure)
            close.focus(); page.keyboard.press("Enter")
            expect(page.get_by_role("alert")).to_have_count(0)
            harness.check(True, theme + " error remains until keyboard dismissal; repeat submission is deduplicated")
            state["fail"] = False
            page.get_by_role("button", name="Sign in", exact=True).click()
            expect(page.get_by_role("status").filter(has_text="Welcome back!")).to_be_visible()
            page.wait_for_function("[...document.querySelectorAll('.Toastify__toast')].every(e => e.getAnimations().every(a => a.playState !== 'running'))")
            for width in [320, 1280]:
                page.set_viewport_size({"width": width, "height": 900})
                page.screenshot(path=str(evidence / f"toast-success-{width}-{theme}.png"))
            page.mouse.move(0, 0)
            expect(page.get_by_role("status").filter(has_text="Welcome back!")).to_have_count(0, timeout=8000)
            expect(page.locator(".Toastify__toast")).to_have_count(0)
            harness.check(True, theme + " successful auth survives navigation and expires after its reading window")
            emit(page, "info", "Synthetic information. पढ़ाई जारी रखें.")
            expect(page.get_by_role("status").filter(has_text="Synthetic information")).to_be_visible()
            page.get_by_role("button", name=f"Switch to {'light' if theme == 'dark' else 'dark'} theme").click()
            background = page.locator(".Toastify__toast[data-in='true']").evaluate("e => getComputedStyle(e).backgroundColor")
            harness.check(background == ("rgb(255, 255, 255)" if theme == "dark" else "rgb(36, 33, 51)"), "visible toast follows theme toggle")
            dismiss_all(page)
            for text in ["First actionable failure", "Second actionable failure", "Third queued failure", "Third queued failure"]: emit(page, "error", text)
            expect(page.get_by_role("alert")).to_have_count(2)
            page.get_by_role("button", name="Dismiss notification").first.click()
            expect(page.get_by_role("alert").filter(has_text="Third queued failure")).to_have_count(1)
            dismiss_all(page)
            expect(page.locator(".Toastify__toast")).to_have_count(0)
            emit(page, "error", "Third queued failure")
            expect(page.get_by_role("alert")).to_contain_text("Third queued failure")
            dismiss_all(page)
            harness.check(True, "visible and queued errors are deduplicated; dismissal allows a fresh retry notification")
            emit(page, "error", "Synthetic long error: " + "Please retry safely. " * 80)
            page.set_viewport_size({"width": 320, "height": 900})
            harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "long error fits 320px")
            page.set_viewport_size({"width": 640, "height": 900})
            page.evaluate("document.documentElement.style.zoom = '2'")
            harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "long error remains within viewport at 200% zoom")
            long_copy = page.locator(".notification-copy p")
            expect(long_copy).to_have_attribute("tabindex", "0")
            long_copy.focus(); long_copy.press("ArrowDown")
            page.wait_for_function("document.querySelector('.notification-copy p').scrollTop > 0")
            harness.check(True, "long errors can be scrolled with the keyboard")
            close = page.get_by_role("button", name="Dismiss notification")
            close.focus()
            page.keyboard.press("Shift+Tab"); page.keyboard.press("Tab")
            expect(close).to_be_focused()
            harness.check(close.evaluate("e => getComputedStyle(e).outlineStyle === 'solid'"), "keyboard dismiss has a visible focus outline")
            close.press("Enter"); expect(page.get_by_role("alert")).to_have_count(0)
            page.evaluate("document.documentElement.style.zoom = ''")
        reduced, _ = fixture("dark", reduced=True)
        reduced.goto(harness.ORIGIN + "/login")
        emit(reduced, "success", "Reduced-motion success remains readable")
        reduced.wait_for_timeout(1000)
        expect(reduced.get_by_role("status").filter(has_text="Reduced-motion success")).to_be_visible()
        reduced.mouse.move(0, 0)
        expect(reduced.get_by_role("status").filter(has_text="Reduced-motion success")).to_have_count(0, timeout=7000)
        emit(reduced, "info", "Information timing remains readable")
        reduced.wait_for_timeout(5000)
        expect(reduced.get_by_role("status").filter(has_text="Information timing")).to_be_visible()
        reduced.mouse.move(0, 0)
        expect(reduced.get_by_role("status").filter(has_text="Information timing")).to_have_count(0, timeout=5000)
        harness.check(True, "reduced motion preserves success and information lifetimes")
        harness.check(not errors and not unexpected, f"no runtime errors or unexpected external/API requests: {errors}, {unexpected}")
    finally:
        for ctx in contexts: ctx.close()


if __name__ == "__main__":
    harness.run_checks = run_checks
    harness.main()
