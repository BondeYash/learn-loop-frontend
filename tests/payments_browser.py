"""Real browser -> cookie auth -> Express/MongoDB -> synthetic Razorpay.
Only the checkout SDK/provider are replaced; no live account requests or charges.
MOCK_TEST_BACKEND_DIR=/path/to/backend python3 tests/payments_browser.py
"""
import json
import os
from pathlib import Path
import selectors
import subprocess
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness

def run_checks(browser, media, evidence):
    backend=Path(os.environ['MOCK_TEST_BACKEND_DIR']).resolve()
    env={k:v for k,v in os.environ.items() if k not in ['MONGO_URI','MONGO_DB_NAME','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET']}
    env.update(NODE_ENV='test',CLIENT_URL=harness.ORIGIN,RAZORPAY_MODE='test')
    fixture=subprocess.Popen(['node','tests/razorpayBrowserFixture.js'],cwd=backend,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    contexts=[];errors=[];unexpected=[];calls=[]
    def read():
        with selectors.DefaultSelector() as selector:
            selector.register(fixture.stdout,selectors.EVENT_READ)
            if not selector.select(25):raise RuntimeError('Disposable payment backend timed out')
        line=fixture.stdout.readline()
        if not line:raise RuntimeError('Disposable backend ended: '+fixture.stderr.read()[-2000:])
        value=json.loads(line);assert 'error' not in value,value;return value
    def control(action,**values):fixture.stdin.write(json.dumps(dict(action=action,**values))+'\n');fixture.stdin.flush();return read()
    try:
        meta=read();cid=meta['courseId'];api=meta['apiOrigin'];assert api.startswith('http://127.0.0.1:')
        def page_for(role,theme='light'):
            ctx=browser.new_context(viewport={'width':320,'height':900},service_workers='block');contexts.append(ctx);ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));state={'drop_verify':False,'capture':None}
            def route(r):
                req=r.request;u=urlparse(req.url)
                if req.url=='https://checkout.razorpay.com/v1/checkout.js':r.fulfill(content_type='application/javascript',body=(harness.ROOT/'tests/razorpayWidgetFixture.js').read_text());return
                if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
                if u.path=='/__fixture__/capture':state['capture']=control('pay',**req.post_data_json);r.fulfill(json=state['capture']);return
                if not u.path.startswith('/api/'):r.continue_();return
                calls.append((role,req.method,u.path))
                response=r.fetch(url=api+u.path+('?' + u.query if u.query else ''),max_retries=1 if req.method=='GET' else 0)
                if state['drop_verify'] and u.path.endswith('/verify'):state['drop_verify']=False;r.fulfill(status=503,json={'message':'Synthetic accepted verification response interrupted'});return
                r.fulfill(response=response)
            ctx.route('**/*',route)
            page.goto(harness.ORIGIN+'/login');page.get_by_label('Email',exact=True).fill(meta['users'][role]['email']);page.get_by_label('Password',exact=True).fill(meta['users'][role]['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url('**/instructor' if role=='owner' else '**/student')
            return page,state
        def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
        owner,_=page_for('owner');owner.goto(harness.ORIGIN+f'/instructor/courses/{cid}/curriculum')
        publish=owner.get_by_role('button',name='Publish course',exact=True);expect(publish).to_be_visible();assert publish.bounding_box()['y'] < 900
        fits(owner,'publish action fits mobile above course materials');publish.click();expect(owner.get_by_text('Published · Students can buy and get access automatically',exact=False)).to_be_visible();assert control('assignments')=={'assignments':0}
        first,state=page_for('student');expect(first.get_by_role('link',name='Pay to unlock',exact=True)).to_be_visible();assert first.get_by_text('Instructor access needed',exact=True).count()==0
        first.get_by_role('link',name='Pay to unlock',exact=True).click();expect(first.get_by_role('button',name='Continue to test checkout')).to_be_visible();assert first.get_by_text('Synthetic learning unlocked after verified payment.',exact=True).count()==0
        first.get_by_role('button',name='Continue to test checkout').click();expect(first.get_by_role('dialog',name='Synthetic Razorpay checkout')).to_be_visible();expect(first.get_by_role('button',name='Processing payment…')).to_be_disabled();first.get_by_role('button',name='Processing payment…').evaluate('b=>{b.click();b.click()}')
        first.get_by_role('button',name='Close checkout').click();expect(first.get_by_role('alert')).to_contain_text('Checkout closed');assert control('stats')=={'orders':1,'enrollments':0,'creates':1}
        first.reload();first.get_by_role('button',name='Continue to test checkout').click();first.get_by_role('button',name='Pay successfully').click();expect(first.get_by_text('Synthetic learning unlocked after verified payment.',exact=True)).to_be_visible();first.reload();expect(first.get_by_text('Synthetic learning unlocked after verified payment.',exact=True)).to_be_visible();fits(first,'captured payment and persisted course access fit mobile')
        first.goto(harness.ORIGIN+'/student');expect(first.get_by_role('link',name='Continue learning',exact=True)).to_have_count(2);assert first.get_by_role('link',name='Pay to unlock',exact=True).count()==0
        first.goto(harness.ORIGIN+'/payments');expect(first.get_by_role('link',name='View payment record')).to_have_count(1);first.get_by_role('link',name='View payment record').click();expect(first.get_by_role('heading',name='Test payment verified')).to_be_visible();expect(first.get_by_role('link',name='Open course',exact=True)).to_be_visible();fits(first,'payment record fits 320px');first.screenshot(path=str(evidence/'razorpay-paid-mobile.png'),full_page=True)
        for width in [1280,320]:first.set_viewport_size({'width':width,'height':900});fits(first,f'payment record fits {width}px')
        p=state['capture']['razorpay_payment_id'];assert control('refund',paymentId=p,amount=1000)['status']==200;first.get_by_role('button',name='Check payment status').click();expect(first.get_by_role('heading',name='Payment needs review after a partial refund')).to_be_visible();assert first.get_by_role('link',name='Open course',exact=True).count()==0
        assert control('refund',paymentId=p,amount=12345)['status']==200;first.reload();expect(first.get_by_role('heading',name='Payment was refunded')).to_be_visible();first.goto(harness.ORIGIN+f'/courses/{cid}');expect(first.get_by_role('button',name='Continue to test checkout')).to_be_visible();assert first.get_by_text('Synthetic learning unlocked after verified payment.',exact=True).count()==0
        second,ss=page_for('second','dark');second.goto(harness.ORIGIN+'/payments');expect(second.get_by_text('You have no payment attempts in this mode.')).to_be_visible();second.goto(harness.ORIGIN+f'/catalog/{meta["slug"]}')
        second.get_by_role('button',name='Continue to test checkout').click();second.get_by_role('button',name='Fail payment').click();expect(second.get_by_role('alert')).to_contain_text('Payment was not completed');assert control('stats')['enrollments']==1
        second.get_by_role('button',name='Continue to test checkout').click();ss['drop_verify']=True;second.get_by_role('button',name='Pay successfully').click();second.wait_for_url('**/payments/*');expect(second.get_by_role('heading',name='Test payment verified')).to_be_visible();second.get_by_role('link',name='Open course',exact=True).click();expect(second.get_by_text('Synthetic learning unlocked after verified payment.',exact=True)).to_be_visible();fits(second,'lost verification response recovers saved purchase in dark theme')
        third,ts=page_for('third');third.goto(harness.ORIGIN+f'/catalog/{meta["slug"]}');third.get_by_role('button',name='Continue to test checkout').click();third.get_by_role('button',name='Capture then close').click();expect(third.get_by_role('button',name='Open course',exact=True)).to_be_visible();assert ts['capture']['webhook']['status']==200;third.get_by_role('button',name='Open course',exact=True).click();expect(third.get_by_text('Synthetic learning unlocked after verified payment.',exact=True)).to_be_visible()
        assert control('stats')=={'orders':4,'enrollments':3,'creates':4};assert control('assignments')=={'assignments':0}
        assert control('missingEnrollment',student='third')['updated'];third.goto(harness.ORIGIN+'/student');expect(third.get_by_role('link',name='Continue learning',exact=True)).to_have_count(2);assert control('stats')['enrollments']==3
        third.get_by_role('link',name='Continue learning',exact=True).first.click();expect(third.get_by_text('Synthetic learning unlocked after verified payment.',exact=True)).to_be_visible()
        assert control('unpublish')['updated'];third.reload();expect(third.get_by_role('alert')).to_be_visible();assert third.get_by_text('Synthetic learning unlocked after verified payment.',exact=True).count()==0
        harness.check(True,'real cookie/API/Mongo: instructor publishes without assignments, private course purchase, dashboard recovery, cancellation + retry, captured access, failed retry, lost response, signed webhook, partial/full refund and ownership scope')
        harness.check(not errors,'no runtime errors: '+str(errors));harness.check(not unexpected,'external provider traffic blocked: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.unroute_all(behavior='ignoreErrors');ctx.close()
        if fixture.poll() is None:
            fixture.terminate()
            try:fixture.wait(timeout=15)
            except subprocess.TimeoutExpired:fixture.kill();fixture.wait()
        stderr=fixture.stderr.read()
        if stderr:print('Disposable backend stderr: '+stderr[-2000:])

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
