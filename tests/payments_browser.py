"""Isolated frontend payment/price/typography checks; no Stripe account requests."""
import re
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness


def run_checks(browser, media, evidence):
    contexts, unexpected, errors = [], [], []
    def fixture(role="student",theme="light",width=1280,test_mode=True):
        ctx=browser.new_context(viewport={"width":width,"height":900},service_workers="block");contexts.append(ctx)
        ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
        page=ctx.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
        course={"_id":"course-fixture","title":"A paid learning course","description":"Synthetic assigned course","price":123.45,"instructor":{"name":"Fixture teacher"},"category":{"_id":"category-fixture","name":"General"},"isPublished":True}
        state={"paid":False,"status":"pending","ready":True,"failure":True,"unsafe":False,"calls":[],"keys":[],"price":12345,"hold":False,"held":[],"price_change":False,"has_order":False,"wrong_mode":False,"readiness_mode":test_mode}
        order={"id":"order-fixture","courseId":"course-fixture","title":course["title"],"amountMinor":12345,"currency":"inr","testMode":test_mode,"status":"pending"}
        def route(r):
            request,u=r.request,urlparse(r.request.url)
            if u.hostname=="checkout.stripe.com" and u.path in ["/c/pay/cs_test_fixture","/c/pay/cs_live_fixture"]:r.fulfill(content_type="text/html",body="<h1>Local Stripe page fixture</h1>");return
            if u.netloc!="127.0.0.1:5186":unexpected.append(request.url);r.abort();return
            if not u.path.startswith("/api/"):r.continue_();return
            state["calls"].append((request.method,u.path))
            if u.path=="/api/auth/me":answer={"user":{"id":harness.STUDENT_ID,"name":"Fixture learner","role":role,"status":"active"}}
            elif u.path in ["/api/courses","/api/enrollments/me"]:
                paid={**course,"payment":{"required":not state["paid"],"paid":state["paid"],"status":"paid" if state["paid"] else state["status"] if state["has_order"] else "required","amountMinor":state["price"],**({"orderId":"order-fixture"} if state["has_order"] else {})}}
                free={**course,"_id":"free-fixture","title":"A free assigned course","price":0,"payment":{"required":False,"paid":False,"status":"free","amountMinor":0}}
                answer={"courses":[paid,free]} if u.path=="/api/courses" else {"enrollments":[{"_id":"assigned-paid","course":paid,"status":"active"},{"_id":"assigned-free","course":free,"status":"active"}]}
            elif u.path=="/api/categories":answer={"categories":[course["category"]]}
            elif u.path=="/api/courses/mine/course-fixture":answer={"course":course,"modules":[]}
            elif u.path=="/api/courses/course-fixture" and request.method=="PATCH":course.update(request.post_data_json);answer={"course":course}
            elif u.path=="/api/courses/course-fixture":
                if not state["paid"]:r.fulfill(status=402,json={"message":"Payment is required","code":"PAYMENT_REQUIRED","courseId":"course-fixture"});return
                answer={"course":course,"modules":[{"_id":"module-fixture","title":"Lessons","lessons":[{"_id":"lesson-fixture","title":"Paid lesson","contentType":"text","content":"Private lesson content after verified payment"}]}]}
            elif u.path.endswith("/progress"):answer={"progress":{"completedLessons":[],"percentage":0}}
            elif u.path.endswith("/notes"):answer={"notes":[]}
            elif u.path.endswith("/assignments"):answer={"assignments":[]}
            elif u.path=="/api/payments/courses/course-fixture/quote":answer={"quote":{"courseId":"course-fixture","title":course["title"],"amountMinor":state["price"],"currency":"inr","testMode":test_mode,"paid":state["paid"],"requiresPayment":not state["paid"]},"readiness":{"configured":state["ready"],"testMode":state["readiness_mode"]}}
            elif u.path=="/api/payments/checkout":
                state["has_order"]=True
                state["keys"].append(request.headers["idempotency-key"])
                assert request.post_data_json=={"courseId":"course-fixture","quotedAmountMinor":state["price"]}
                if state["failure"]:r.fulfill(status=502,json={"message":"Test checkout temporarily unavailable. Retry."});return
                if state["price_change"]:state["price"]=19999;state["price_change"]=False;r.fulfill(status=409,json={"message":"Course price changed. Review the new price."});return
                answer={"order":{**order,"testMode":not test_mode if state["wrong_mode"] else test_mode},"url":"https://evil.invalid/checkout" if state["unsafe"] else f"https://checkout.stripe.com/c/pay/cs_{'test' if test_mode else 'live'}_fixture"}
                if state["hold"]:state["held"].append((r,answer));return
            elif u.path.startswith("/api/payments/orders/order-fixture"):
                order["status"]=state["status"];answer={"order":order}
            else:unexpected.append(request.url);r.fulfill(status=500,json={"message":"Unknown fixture"});return
            r.fulfill(json={"data":answer})
        ctx.route("**/*",route)
        return page,state,course
    try:
        for theme,test_mode in [("light",True),("dark",True),("light",False),("dark",False)]:
            mode="test" if test_mode else "live"
            checkout_label="Continue to test checkout" if test_mode else "Continue to payment"
            page,state,course=fixture(theme=theme,width=320,test_mode=test_mode)
            page.goto(harness.ORIGIN+"/student")
            expect(page.locator(".course-card")).to_have_count(2)
            expect(page.get_by_text("Payment required",exact=True)).to_be_visible()
            expect(page.get_by_role("link",name="Pay to unlock")).to_be_visible()
            expect(page.get_by_text("A free assigned course",exact=True)).to_be_visible()
            page.get_by_role("link",name="Pay to unlock").click()
            expect(page.get_by_role("button",name=checkout_label)).to_be_visible()
            expect(page.get_by_text("Stripe test mode — no real money is charged." if test_mode else "Live payment — your payment method will be charged in INR.")).to_be_visible()
            expect(page.get_by_text("₹123.45",exact=True)).to_be_visible()
            assert not page.locator("video").count() and not page.get_by_text("Private lesson content after verified payment").count()
            assert not any(path.endswith("/notes") or path.endswith("/playback") for _,path in state["calls"])
            assert page.evaluate("getComputedStyle(document.documentElement).fontSize==='17px' && document.documentElement.scrollWidth<=innerWidth")
            page.get_by_role("button",name=checkout_label).click();expect(page.get_by_role("alert")).to_contain_text("temporarily unavailable")
            state["failure"]=False;state["unsafe"]=True
            page.get_by_role("button",name=checkout_label).click();expect(page.get_by_role("alert")).to_contain_text("valid Stripe checkout")
            assert state["keys"][0]==state["keys"][1]
            state["unsafe"]=False;state["wrong_mode"]=True
            page.get_by_role("button",name=checkout_label).click();expect(page.get_by_role("alert")).to_contain_text("displayed mode")
            assert page.url.startswith(harness.ORIGIN)
            state["wrong_mode"]=False;state["price_change"]=True
            page.get_by_role("button",name=checkout_label).click();expect(page.get_by_role("alert")).to_contain_text("price changed");expect(page.get_by_text("₹199.99",exact=True)).to_be_visible()
            page.screenshot(path=str(evidence/f"payment-{mode}-mobile-{theme}.png"),full_page=True)
            state["hold"]=True;before=len(state["keys"])
            page.get_by_role("button",name=checkout_label).click();expect(page.get_by_role("button",name="Opening Stripe…")).to_be_disabled()
            page.get_by_role("button",name="Opening Stripe…").evaluate("button=>{button.click();button.click()}")
            assert len(state["keys"])==before+1 and len(state["held"])==1
            r,answer=state["held"].pop();r.fulfill(json={"data":answer})
            page.wait_for_url("https://checkout.stripe.com/**");expect(page.get_by_role("heading",name="Local Stripe page fixture")).to_be_visible()
            page.goto(harness.ORIGIN+"/payments/order-fixture?checkout=success")
            expect(page.get_by_role("heading",name="Awaiting payment verification")).to_be_visible()
            assert not page.get_by_role("link",name="Open course",exact=True).count()
            state["paid"]=True;state["status"]="paid"
            page.get_by_role("button",name="Check payment status").click();expect(page.get_by_role("heading",name="Test payment verified" if test_mode else "Payment verified")).to_be_visible()
            page.get_by_role("link",name="Open course",exact=True).click();expect(page.get_by_text("Private lesson content after verified payment")).to_be_visible()
            page.goto(harness.ORIGIN+"/student");expect(page.locator(".course-card")).to_have_count(2);expect(page.get_by_text("Paid",exact=True)).to_be_visible()
            expect(page.get_by_role("link",name="Open course")).to_have_count(2)
            state["paid"]=False;state["status"]="refunded";page.get_by_role("button",name="Refresh courses").click()
            expect(page.get_by_text("Payment refunded",exact=True)).to_be_visible();expect(page.locator(".course-card")).to_have_count(2)
            page.get_by_role("link",name="Review payment").click()
            page.goto(harness.ORIGIN+"/payments/order-fixture")
            expect(page.get_by_role("heading",name="Payment was refunded")).to_be_visible();page.get_by_role("link",name="Back to course").click()
            expect(page.get_by_role("button",name=checkout_label)).to_be_visible()
            harness.check(True,f"{mode}/{theme}: 320px paywall, correct mode label, cross-mode redirects blocked, stable retry, unsafe URL blocked, price refresh, double-submit guard, all assigned cards visible before/after payment, verified return and refund re-lock")

        teacher,state,course=fixture(role="instructor",width=390)
        teacher.goto(harness.ORIGIN+"/instructor/courses/course-fixture/edit")
        price=teacher.get_by_label("Course price (INR)");expect(price).to_have_value("123.45")
        price.fill("499.95");teacher.get_by_role("button",name="Save course details").click();teacher.wait_for_url("**/curriculum")
        assert str(course["price"])=="499.95";teacher.goto(harness.ORIGIN+"/instructor/courses/course-fixture/edit");expect(price).to_have_value("499.95")
        assert teacher.evaluate("document.documentElement.scrollWidth<=innerWidth")
        price.fill("1.001");teacher.get_by_role("button",name="Save course details").click();assert teacher.url.endswith("/edit")
        teacher.screenshot(path=str(evidence/"instructor-price-mobile.png"),full_page=True)
        harness.check(True,"instructor INR price persists, reloads and invalid decimal precision stays in form; mobile wraps")
        checkout_label="Continue to test checkout"
        page,state,_=fixture();state["ready"]=False;page.goto(harness.ORIGIN+"/courses/course-fixture")
        expect(page.get_by_role("button",name=checkout_label)).to_be_disabled();expect(page.get_by_text("Checkout is being configured. Please try again later.")).to_be_visible()
        page,state,_=fixture(test_mode=False);state["readiness_mode"]=True;page.goto(harness.ORIGIN+"/courses/course-fixture")
        expect(page.get_by_role("button",name="Continue to payment")).to_be_disabled();expect(page.get_by_text("Checkout is being configured. Please try again later.")).to_be_visible()
        assert not page.get_by_text("no real money",exact=False).count()
        harness.check(True,"missing configuration and inconsistent server modes disable Checkout")
        harness.check(not errors,f"no browser runtime errors: {errors}");harness.check(not unexpected,f"all external calls intercepted/blocked: {unexpected}")
    finally:
        for ctx in contexts:ctx.unroute_all(behavior="wait");ctx.close()


if __name__=="__main__":harness.run_checks=run_checks;harness.main()
