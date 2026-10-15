"""Slow requests, automatic recovery, saved content and honest course pricing.
Uses synthetic public API data; no provider, private account or payment requests.
"""
from copy import deepcopy
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import CARD, DETAIL


def run_checks(browser, _media, evidence):
    contexts, errors, unexpected = [], [], []
    course = {**CARD, "title": "NIELIT Course on Computer Concepts (CCC)", "amountMinor": 19900, "summary": "Learn computer fundamentals, revise key concepts and build a regular study routine."}
    feed = {"enabled": True, "status": "ready", "updatedAt": datetime.now(timezone.utc).isoformat(), "notices": [{"id": str(n), "title": f"Synthetic SSC recruitment update {n+1}", "url": f"https://sarkariresult.com.cm/fixture-{n}/", "publishedOn": "2026-10-13"} for n in range(8)]}
    def fixture(mode="held", theme="light", motion_fail=False):
        ctx = browser.new_context(viewport={"width":1440,"height":1000},service_workers="block"); contexts.append(ctx)
        ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
        page=ctx.new_page();page.clock.install();page.on('pageerror',lambda error:errors.append(str(error)))
        state={"courses":mode,"notices":mode,"calls":[],"held":[],"summary":course['summary'],"motionBlocked":False}
        def respond(route):
            request,u=route.request,urlparse(route.request.url)
            if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(request.url);route.abort();return
            if motion_fail and u.path.endswith('/LandingMotion.jsx'):state['motionBlocked']=True;route.abort();return
            if not u.path.startswith('/api/'):route.continue_();return
            state['calls'].append((request.method,u.path,u.query))
            if u.path=='/api/auth/me':route.fulfill(status=401,json={'message':'Sign in'});return
            if u.path==f'/api/public/courses/{course["slug"]}':
                detail=deepcopy(DETAIL);detail['course'].update(course);route.fulfill(json={'data':detail});return
            if u.path in ['/api/public/courses','/api/public/exam-notifications']:
                kind='courses' if u.path.endswith('/courses') else 'notices'
                if state[kind]=='held':state['held'].append((kind,route));return
                if state[kind]=='error':route.fulfill(status=503,json={'message':'PRIVATE_TEMPORARY_FAILURE'});return
                if kind=='courses':data={'courses':[{**course,'summary':state['summary']}],'total':1,'page':1,'limit':12,'categories':[course['category']]}
                else:data=feed if state[kind]!='unavailable' else {**feed,'status':'unavailable','notices':[]}
                route.fulfill(json={'success':True,'data':data});return
            if harness.fulfill_optional_acquisition(route,u):return
            unexpected.append(request.url);route.fulfill(status=500,json={'message':'Unexpected request'})
        ctx.route('**/*',respond)
        return page,state
    def release(state,kind):
        state[kind]='ready'
        for name,route in list(state['held']):
            if name==kind:
                data=feed if kind=='notices' else {'courses':[course],'total':1,'page':1,'limit':12,'categories':[course['category']]}
                route.fulfill(json={'success':True,'data':data});state['held'].remove((name,route))
    def clean(page):
        expect(page.get_by_role('button',name='Retry courses')).to_have_count(0)
        expect(page.get_by_role('button',name='Retry updates')).to_have_count(0)
        assert 'PRIVATE_TEMPORARY_FAILURE' not in page.locator('body').inner_text()
        expect(page.locator('s,del')).to_have_count(0)
    try:
        page,state=fixture();page.goto(harness.ORIGIN)
        expect(page.locator('#catalog [aria-busy=true]')).to_be_visible();expect(page.locator('.exam-feed-skeleton')).to_be_visible()
        assert {kind for kind,_ in state['held']}=={'courses','notices'},'Both feeds start immediately'
        assert len(state['held'])==2,'Strict mode must not duplicate requests'
        clean(page);page.screenshot(path=str(evidence/'landing-skeleton-desktop.png'),full_page=True)
        release(state,'courses');expect(page.locator('#catalog').get_by_role('heading',name=course['title'])).to_be_visible()
        expect(page.locator('.exam-feed-skeleton')).to_be_visible();release(state,'notices');expect(page.locator('.exam-notice-list li')).to_have_count(6)
        expect(page.locator('.hero-price-link strong')).to_have_text('₹199');expect(page.locator('.course-sale-price')).to_have_text('₹199')
        for theme in ['light','dark']:
            if theme=='dark':page.get_by_role('button',name='Switch to dark theme').click()
            for width in [320,768,1440]:
                page.set_viewport_size({'width':width,'height':1000});page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
                assert page.get_by_role('link',name='Start learning · ₹199').bounding_box()['y'] < 1000
                harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'sales landing fits {width}px {theme}')
                page.screenshot(path=str(evidence/f'sales-landing-{width}-{theme}.png'),full_page=True,animations='disabled')
                page.locator('.study-hero').screenshot(path=str(evidence/f'sales-hero-{width}-{theme}.png'),animations='disabled')
        page.set_viewport_size({'width':640,'height':1000});page.evaluate("document.documentElement.style.zoom='2'");harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'sales landing fits 200% zoom');page.evaluate("document.documentElement.style.zoom=''")
        page.locator('.hero-course-offer').get_by_role('link',name='View course & enroll').click()
        expect(page.get_by_role('heading',name='About this course')).to_be_visible();expect(page.get_by_role('link',name='Sign in to buy')).to_be_visible()
        # Saved public content renders even while a later backend request fails.
        state['courses']='error';state['notices']='error';page.goto(harness.ORIGIN)
        expect(page.locator('#catalog').get_by_role('heading',name=course['title'])).to_be_visible();expect(page.locator('.exam-notice-list li')).to_have_count(6)
        expect(page.locator('#catalog [aria-busy=true],.exam-feed-skeleton')).to_have_count(0);clean(page)
        state['courses']='ready';state['notices']='ready';state['summary']='Fresh course details after background recovery.'
        page.clock.fast_forward(3000);expect(page.locator('#catalog')).to_contain_text(state['summary'])
        harness.check(True,'parallel initial requests, skeletons, saved content during failure, automatic refresh and unchanged ₹199 enrollment path')
        retry,retry_state=fixture('error');retry.goto(harness.ORIGIN)
        expect(retry.locator('#catalog')).to_contain_text('Getting your courses ready');expect(retry.locator('.exam-updates')).to_contain_text('Gathering the latest updates');clean(retry)
        retry_state['courses']='ready';retry_state['notices']='ready';retry.clock.fast_forward(2000)
        expect(retry.locator('#catalog').get_by_role('heading',name=course['title'])).to_be_visible();expect(retry.locator('.exam-notice-list li')).to_have_count(6)
        assert len([x for x in retry_state['calls'] if x[1]=='/api/public/courses'])==2
        harness.check(True,'first-visit transient failures recover without a retry button or page reload')
        assert not any(method!='GET' or '/payments/' in path for method,path,_ in state['calls']), 'The landing page never creates a purchase'
        motion,motion_state=fixture('ready',motion_fail=True);motion.goto(harness.ORIGIN)
        expect(motion.locator('#catalog').get_by_role('heading',name=course['title'])).to_be_visible()
        expect(motion.get_by_role('heading',name='Bade sapne. Roz ki taiyaari.')).to_be_visible()
        motion.wait_for_function("document.querySelector('.hero-actions a') !== null")
        assert motion_state['motionBlocked'], 'Optional animation module was not exercised'
        harness.check(True,'optional animation download failure preserves the landing page and course actions')
        harness.check(not errors and not unexpected,f'no runtime errors or external traffic: {errors}, {unexpected}')
    finally:
        for ctx in contexts:ctx.unroute_all(behavior='ignoreErrors');ctx.close()

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
