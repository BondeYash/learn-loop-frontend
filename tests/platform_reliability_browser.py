"""Held requests and transient failures against local fixtures; no paid providers."""
from copy import deepcopy
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness


def run_checks(browser, media, evidence):
    contexts=[]
    def fixture(role='student'):
        ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block');contexts.append(ctx)
        page=ctx.new_page();state={'course_status':200,'play_status':200,'course_calls':0,'progress_calls':0,'reads':0,'hold':False,'held':[]}
        course=deepcopy(harness.COURSE);course['progress']={'completedLessons':[],'percentage':0}
        def route(r):
            u=urlparse(r.request.url)
            assert u.netloc=='127.0.0.1:5186', 'No external request allowed'
            if u.path=='/__fixture__/video.mp4':r.fulfill(content_type='video/mp4',body=media);return
            if not u.path.startswith('/api/'):r.continue_();return
            if u.path=='/api/auth/me' and role is None:r.fulfill(status=401,json={'message':'Sign in required'});return
            if u.path=='/api/auth/me':answer={'user':{'id':harness.STUDENT_ID,'role':role,'name':'Audit account','status':'active','mustChangePassword':False}}
            elif u.path=='/api/courses/course-fixture':
                state['course_calls']+=1
                if state['course_status']!=200:r.fulfill(status=state['course_status'],json={'message':'Synthetic course interruption'});return
                answer=course
            elif u.path.endswith('/progress'):state['progress_calls']+=1;answer={'progress':course['progress']}
            elif u.path.endswith('/playback'):
                if state['play_status']!=200:r.fulfill(status=state['play_status'],json={'message':'Synthetic playback interruption'});return
                answer={'url':harness.ORIGIN+'/__fixture__/video.mp4','expiresAt':page.evaluate('Date.now()+300000')}
            elif harness.fulfill_learning_place(r,u):return
            elif u.path.endswith('/notes'):answer={'notes':[]}
            elif u.path=='/api/categories':answer={'categories':[{'_id':'category-fixture','name':'General'}]}
            elif u.path=='/api/courses/mine/course-fixture':
                r.fulfill(status=503,json={'message':'Course details could not be loaded'});return
            elif u.path.startswith('/api/payments/orders/'):
                if r.request.method=='GET':
                    state['reads']+=1
                    if state['hold']:state['held'].append(r);return
                answer={'order':{'id':'order-fixture','courseId':'course-fixture','title':'Audit course','amountMinor':19900,'status':'paid' if r.request.method=='POST' else 'pending','canAccess':r.request.method=='POST','testMode':True}}
            else:raise AssertionError('Unconfigured fixture '+u.path)
            r.fulfill(json={'data':answer})
        ctx.route('**/*',route);return page,state
    try:
        page,state=fixture();page.goto(harness.ORIGIN+'/courses/course-fixture');page.wait_for_function("document.querySelector('video')?.readyState>=2")
        assert state['progress_calls']==0,'Inline progress eliminates the serial request'
        page.locator('video').evaluate('v=>{window.auditVideo=v;v.muted=true;return v.play()}')
        state['course_status']=503
        page.evaluate("window.auditNow=Date.now;Date.now=()=>window.auditNow()+16000;window.dispatchEvent(new Event('focus'))")
        expect(page.get_by_role('alert')).to_contain_text('Synthetic course interruption')
        assert page.evaluate('document.querySelector("video")===window.auditVideo && !window.auditVideo.paused'),'Refresh failure preserves playing video'
        state['course_status']=200;page.get_by_role('button',name='Retry course').click();expect(page.get_by_role('alert')).to_have_count(0)
        state['play_status']=503
        page.evaluate('Date.now=()=>window.auditNow()+290000;document.querySelector("video").currentTime=8')
        expect(page.get_by_role('status').filter(has_text='Reconnecting the video link')).to_be_visible()
        assert page.evaluate('document.querySelector("video")===window.auditVideo && !window.auditVideo.paused'),'Failed early renewal keeps the valid ticket'
        state['play_status']=403
        page.locator('video').evaluate('v=>{v.currentTime=10}')
        expect(page.locator('video')).to_have_count(0)
        harness.check(True,'Course refresh and signed URL renewal preserve playback on 503, and deny access on 403')
        page.screenshot(path=str(evidence/'playback-denied-mobile.png'),full_page=True)
        expired,estate=fixture();expired.clock.install();expired.goto(harness.ORIGIN+'/courses/course-fixture');expired.wait_for_function("document.querySelector('video')?.readyState>=2")
        estate['play_status']=503;expired.clock.run_for(300100)
        expect(expired.locator('video')).to_have_count(0);expect(expired.get_by_role('alert')).to_contain_text('video link expired')
        estate['play_status']=200;expired.get_by_role('button',name='Retry playback',exact=True).click();expired.wait_for_function("document.querySelector('video')?.readyState>=2")
        harness.check(True,'An expired signed link stops playback and can be retried immediately')
        pay,pstate=fixture();pay.clock.install();pay.goto(harness.ORIGIN+'/payments/order-fixture');expect(pay.get_by_role('heading',name='Awaiting payment verification')).to_be_visible()
        pstate['hold']=True;pay.clock.run_for(3500);pay.wait_for_function('true');assert len(pstate['held'])==1
        before=pstate['reads'];pay.clock.run_for(12000);assert pstate['reads']==before,'Slow payment read stays single-flight'
        pay.get_by_role('button',name='Check payment status',exact=True).click();expect(pay.get_by_role('heading',name='Test payment verified')).to_be_visible()
        for r in pstate['held']:
            try:r.fulfill(json={'data':{'order':{'status':'pending'}}})
            except Exception:pass
        pay.clock.run_for(12000);expect(pay.get_by_role('heading',name='Test payment verified')).to_be_visible();assert pstate['reads']==before,'Terminal payment stops automatic checks'
        harness.check(True,'Payment reads never overlap and cannot regress verified payment')
        pay.screenshot(path=str(evidence/'payment-verified-mobile.png'),full_page=True)
        owner,_=fixture('instructor');owner.goto(harness.ORIGIN+'/instructor/courses/course-fixture/edit')
        expect(owner.get_by_role('alert')).to_contain_text('Course details could not be loaded');expect(owner.locator('form')).to_have_count(0)
        expect(owner.get_by_role('button',name='Reload course details')).to_be_visible()
        harness.check(True,'A failed edit load cannot submit empty defaults over an existing course')
        broken,_=fixture(None)
        pattern='**/src/pages/auth/LoginPage.jsx*'
        broken.route(pattern,lambda r:r.fulfill(content_type='text/javascript',body='export default function Login(){throw new Error("Synthetic rendering failure")}'))
        broken.goto(harness.ORIGIN+'/login')
        expect(broken.get_by_role('heading',name='This page couldn’t open.')).to_be_visible()
        expect(broken.get_by_role('link',name='Home',exact=True)).to_have_attribute('href','/')
        broken.unroute(pattern)
        broken.get_by_role('button',name='Reload page',exact=True).click()
        expect(broken.get_by_role('heading',name='Welcome back',exact=True)).to_be_visible()
        harness.check(True,'Page rendering failures provide working reload and home actions')

    finally:
        for ctx in contexts:ctx.close()

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
