"""Exam feed UI against synthetic responses. No Parse requests or credits.
Run with the same Chrome/Playwright prerequisites as student_player_browser.py.
"""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import CARD


def run_checks(browser, _media, evidence):
    contexts, errors, unexpected = [], [], []
    notices = [{"id": str(n), "title": f"{name} — Synthetic recruitment notice {n + 1}", "url": f"https://sarkariresult.com.cm/fixture-{n}/", "publishedOn": "2026-10-12"} for n, name in enumerate(["SSC", "Railway", "Banking", "UPSC", "State PSC", "Teaching", "Defence", "Computer qualification"])]
    feed = {"enabled": True, "status": "ready", "notices": notices, "updatedAt": datetime.now(timezone.utc).isoformat(), "source": {"name": "SarkariResult.com.cm", "via": "Parse", "url": "https://sarkariresult.com.cm/"}}

    def fixture(theme="light", mode="ready"):
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, service_workers="block")
        contexts.append(ctx); ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
        state = {"mode": mode, "calls": [], "held": []}
        page = ctx.new_page(); page.clock.install(); page.on("pageerror", lambda error: errors.append(str(error)))

        def route(r):
            u = urlparse(r.request.url)
            if f"{u.scheme}://{u.netloc}" != harness.ORIGIN: unexpected.append(r.request.url); r.abort(); return
            if not u.path.startswith("/api/"): r.continue_(); return
            state["calls"].append((r.request.method, u.path, u.query))
            if u.path == "/api/auth/me": r.fulfill(status=401, json={"message": "Sign in required"}); return
            if u.path == "/api/public/courses": data = {"courses": [CARD], "total": 1, "page": 1, "limit": 12, "categories": [CARD["category"]]}
            elif u.path == "/api/public/exam-notifications":
                data = deepcopy(feed)
                if state["mode"] == "pending": state["held"].append(r); return
                if state["mode"] == "error": r.fulfill(status=503, json={"message": "Private diagnostics must not appear"}); return
                if state["mode"] == "disabled": data.update(enabled=False, status="disabled", notices=[], updatedAt=None)
                if state["mode"] == "empty": data["notices"] = []
                if state["mode"] == "stale": data.update(status="stale", updatedAt=(datetime.now(timezone.utc)-timedelta(days=2)).isoformat())
                if state["mode"] == "unavailable": data.update(status="unavailable", notices=[])
                if state["mode"] == "unsafe":
                    data["notices"] = [{**notices[0], "title": "<img src=x onerror=alert(1)> Plain text"}, {**notices[1], "url": "javascript:alert(1)"}, {**notices[2], "url": "https://evil.invalid/"}]
            else: unexpected.append(r.request.url); r.fulfill(status=500, json={"message": "Unexpected request"}); return
            r.fulfill(json={"success": True, "data": data})

        ctx.route("**/*", route)
        return page, state

    def fits(page, label): harness.check(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), label)
    try:
        for theme in ["light", "dark"]:
            page, state = fixture(theme)
            page.goto(harness.ORIGIN)
            section = page.get_by_role("region", name="Latest exam notifications")
            expect(section.locator(".exam-notice-list li")).to_have_count(6)
            expect(section).to_contain_text("Third-party updates via Parse")
            expect(section.locator(".exam-updates-freshness")).to_contain_text("IST")
            for width in [320, 768, 1440]:
                page.set_viewport_size({"width": width, "height": 1000}); fits(page, f"exam updates fit {width}px {theme}")
                page.locator("h1").click(); page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
                section.screenshot(path=str(evidence / f"exam-updates-{width}-{theme}.png"), animations="disabled")
                page.evaluate("window.scrollTo({top:document.querySelector('.exam-updates').getBoundingClientRect().top+scrollY-20,behavior:'instant'})")
                page.screenshot(path=str(evidence / f"exam-updates-viewport-{width}-{theme}.png"), animations="disabled")
            page.set_viewport_size({"width": 640, "height": 1000}); page.evaluate("document.documentElement.style.zoom='2'")
            fits(page, "exam updates fit 200% " + theme); page.evaluate("document.documentElement.style.zoom=''")
            page.set_viewport_size({"width": 1440, "height": 1000})
            calls = list(state["calls"])
            more = section.get_by_role("button", name="Show all 8 updates"); more.focus(); more.press("Enter")
            expect(section.locator(".exam-notice-list li")).to_have_count(8)
            expect(section.get_by_role("button", name="Show fewer updates")).to_have_attribute("aria-expanded", "true")
            search = section.get_by_label("Find an exam in these updates")
            search.focus(); search.fill("railway")
            expect(section.locator(".exam-notice-list li")).to_have_count(1)
            expect(section).to_contain_text("1 update matching your search")
            search.fill("No such exam"); expect(section).to_contain_text("No matching update")
            search.fill(""); expect(section.locator(".exam-notice-list li")).to_have_count(6)
            assert calls == state["calls"], "Client search and expansion must not request more data"
            for link in section.locator(".exam-notice-list a").all():
                assert link.get_attribute("href").startswith("https://sarkariresult.com.cm/")
                assert link.get_attribute("target") == "_blank"
                assert "noopener" in link.get_attribute("rel") and "noreferrer" in link.get_attribute("rel")
            page.locator("h1").click(); page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
            page.screenshot(path=str(evidence / f"home-exam-updates-{theme}.png"), full_page=True, animations="disabled")
            harness.check(True, "keyboard filter/expansion and safe links, without extra network requests: " + theme)

        for mode, copy in [("empty", "No new notifications"), ("stale", "Last updated"), ("unavailable", "Gathering the latest updates"), ("error", "Gathering the latest updates")]:
            page, state = fixture(mode=mode); page.goto(harness.ORIGIN)
            section = page.get_by_role("region", name="Latest exam notifications")
            expect(section).to_contain_text(copy)
            expect(page.locator("#catalog").get_by_role("heading", name=CARD["title"])).to_be_visible()
            assert "Private diagnostics" not in section.inner_text()
            if mode == "stale":
                expect(section.locator(".exam-notice-list li")).to_have_count(6)
                assert section.locator(".exam-updates-freshness time").get_attribute("datetime")
            if mode in ["unavailable", "error"]:
                state["mode"] = "ready"; page.clock.fast_forward(61000)
                expect(section.locator(".exam-notice-list li")).to_have_count(6)
            harness.check(True, "feed state and course isolation: " + mode)

        page, _ = fixture(mode="disabled"); page.goto(harness.ORIGIN)
        expect(page.get_by_role("heading", name="Har din thoda. Har din aage.")).to_be_visible()
        expect(page.locator(".exam-updates")).to_have_count(0)
        page, _ = fixture(mode="unsafe"); page.goto(harness.ORIGIN)
        expect(page.locator(".exam-notice-list li")).to_have_count(1)
        expect(page.locator(".exam-notice-list img")).to_have_count(0)
        expect(page.locator(".exam-notice-list")).to_contain_text("<img src=x onerror=alert(1)>")
        page, state = fixture(mode="pending"); page.goto(harness.ORIGIN)
        expect(page.locator(".exam-feed-skeleton[aria-busy=true]")).to_be_visible()
        expect(page.locator("#catalog").get_by_role("heading", name=CARD["title"])).to_be_visible()
        state["mode"] = "ready"
        for route in state["held"]: route.fulfill(json={"data": feed})
        expect(page.locator(".exam-notice-list li")).to_have_count(6)
        harness.check(not errors and not unexpected, f"no browser errors or provider/account calls: {errors}, {unexpected}")
    finally:
        for ctx in contexts: ctx.close()


if __name__ == "__main__":
    harness.run_checks = run_checks
    harness.main()
