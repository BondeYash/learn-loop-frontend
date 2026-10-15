"""Real React + Express + MongoDB; synthetic accounts/PDFs and fake Groq/R2.
No production credentials, AI charges, email, payments or external requests.
DOUBT_BACKEND_DIR=/path/to/learn-loop-backend python3 tests/doubt_dost_e2e_browser.py
"""
import io
import json
import os
from pathlib import Path
import selectors
import subprocess
from urllib.parse import urlparse
from reportlab.pdfgen import canvas
from playwright.sync_api import expect
import student_player_browser as harness


def run_checks(browser, _media, evidence):
    backend = Path(os.environ.get('DOUBT_BACKEND_DIR', str(harness.ROOT.parent / 'learn-loop-backend'))).resolve()
    env = {k:v for k,v in os.environ.items() if k not in ['MONGO_URI','MONGO_DB_NAME','GROQ_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','RAZORPAY_KEY_SECRET']}
    env.update(NODE_ENV='test', CLIENT_URL=harness.ORIGIN, AUTH_RATE_LIMIT_MAX='100', RAZORPAY_MODE='test')
    fixture = subprocess.Popen(['node','tests/doubtBrowserFixture.js'],cwd=backend,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    contexts=[]; errors=[]; unexpected=[]; calls=[]
    gateway_failures={'/api/admin/doubt-dost':1, '/api/admin/doubt-dost/activity':1}
    output=io.BytesIO();pdf=canvas.Canvas(output);pdf.drawString(50,750,'RAM stores information temporarily while the computer is working. Synthetic RAM course notes for local testing.');pdf.save();pdf_bytes=output.getvalue()
    def read():
        with selectors.DefaultSelector() as selector:
            selector.register(fixture.stdout,selectors.EVENT_READ)
            if not selector.select(30): raise RuntimeError('Disposable backend response timed out')
        line=fixture.stdout.readline()
        if not line: raise RuntimeError('Disposable backend exited: '+fixture.stderr.read()[-2000:])
        return json.loads(line)
    def control(action):fixture.stdin.write(json.dumps({'action':action})+'\n');fixture.stdin.flush();return read()
    try:
        meta=read();cid=meta['courseId'];api=meta['apiOrigin'];assert api.startswith('http://127.0.0.1:')
        def session(role,theme='light'):
            ctx=browser.new_context(viewport={'width':1280,'height':1000},service_workers='block');contexts.append(ctx)
            ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            def route(r):
                req=r.request;u=urlparse(req.url)
                if u.scheme=='chrome-extension':r.continue_();return
                if u.hostname=='doubt-source.invalid':r.fulfill(content_type='application/pdf',body=pdf_bytes);return
                if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
                if not u.path.startswith('/api/'):r.continue_();return
                calls.append((role,req.method,u.path))
                if role=='admin' and req.method=='GET' and gateway_failures.get(u.path,0):
                    gateway_failures[u.path]-=1;r.fulfill(status=502,body='Temporary gateway interruption');return
                response=r.fetch(url=api+u.path+('?' + u.query if u.query else ''),max_retries=0)
                r.fulfill(response=response)
            ctx.route('**/*',route)
            page.goto(harness.ORIGIN+'/login');page.get_by_label('Email',exact=True).fill(meta['users'][role]['email']);page.get_by_label('Password',exact=True).fill(meta['users'][role]['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url('**/'+('admin' if role=='admin' else 'student'))
            return page
        admin=session('admin');admin.get_by_role('link',name='Doubt Dost knowledge base',exact=False).click()
        expect(admin.get_by_role('heading',name='Doubt Dost knowledge base',exact=True)).to_be_visible()
        admin.get_by_role('combobox',name='Knowledge base course').select_option(cid)
        assert all(value==0 for value in gateway_failures.values())
        expect(admin.get_by_role('alert')).to_have_count(0)
        harness.check(True,'temporary 502 workspace reads recover automatically without a failure banner')
        admin.get_by_label('Knowledge base PDFs',exact=True).set_input_files({'name':'Synthetic memory.pdf','mimeType':'application/pdf','buffer':pdf_bytes})
        admin.get_by_role('button',name='Upload selected PDFs',exact=True).click()
        expect(admin.get_by_text('Indexed draft',exact=True)).to_be_visible(timeout=15000)
        chat=admin.locator('.doubt-chat');chat.get_by_label('Your doubt',exact=True).fill('Explain RAM from this course')
        chat.get_by_label('Answer language',exact=True).select_option('en');chat.get_by_role('button',name='Ask Doubt Dost',exact=True).click()
        expect(chat.get_by_text('RAM is temporary memory.',exact=False)).to_be_visible()
        student=session('student');student.goto(harness.ORIGIN+f'/courses/{cid}')
        student.get_by_role('link',name='Ask Doubt Dost',exact=True).click()
        expect(student.get_by_role('heading',name='Doubt Dost',exact=True,level=1)).to_be_visible()
        expect(student.get_by_text('The course PDFs are indexed and waiting to be published.',exact=False)).to_be_visible()
        expect(student.get_by_label('Your doubt',exact=True)).to_be_disabled()
        admin.get_by_role('button',name='Publish to Doubt Dost',exact=True).click();expect(admin.get_by_text('Published to students',exact=True)).to_be_visible()
        expect(student.get_by_label('Your doubt',exact=True)).to_be_enabled(timeout=20000)
        admin.reload();expect(admin.get_by_text('Published to students',exact=True)).to_be_visible()
        admin.get_by_role('button',name='Unpublish',exact=True).click();expect(admin.get_by_role('dialog')).to_be_visible()
        admin.get_by_role('button',name='Cancel',exact=True).click();assert control('stats')['published']==1
        admin.get_by_role('button',name='Unpublish',exact=True).click();admin.get_by_role('button',name='Unpublish PDF',exact=True).click()
        expect(admin.get_by_text('Indexed draft',exact=True)).to_be_visible()
        student.reload();expect(student.get_by_label('Your doubt',exact=True)).to_be_disabled()
        admin.get_by_role('button',name='Publish to Doubt Dost',exact=True).click();student.get_by_role('button',name='Check again',exact=True).click()
        expect(student.get_by_label('Your doubt',exact=True)).to_be_enabled()
        harness.check(True,'real indexing/preview/publication; open student chat unlocks automatically; publication persists on reload; unpublish needs explicit confirmation')
        student.get_by_label('Your doubt',exact=True).fill('RAM kya hoti hai?');student.get_by_role('button',name='Ask Doubt Dost',exact=True).click()
        expect(student.get_by_text('RAM temporary memory hoti hai.',exact=False)).to_be_visible()
        student.locator('.doubt-sources summary').first.click()
        expect(student.get_by_text('RAM stores information temporarily',exact=False)).to_be_visible()
        with student.expect_popup() as event:student.get_by_role('button',name='Open source PDF',exact=True).click()
        popup=event.value;popup.wait_for_url('https://doubt-source.invalid/**');popup.close()
        student.get_by_role('button',name='Helpful answer',exact=True).click();expect(student.get_by_role('button',name='Helpful answer',exact=True)).to_have_attribute('aria-pressed','true')
        student.get_by_role('button',name='Aasaan bhasha mein',exact=True).click();expect(student.get_by_label('Your doubt',exact=True)).to_have_value('Please explain your answer to “RAM kya hoti hai?” in simpler words, with an example from the course material.')
        student.get_by_label('Your doubt',exact=True).fill('Explain RAM in Hindi');student.get_by_label('Answer language',exact=True).select_option('hi');student.get_by_role('button',name='Ask Doubt Dost',exact=True).click()
        expect(student.get_by_text('RAM अस्थायी मेमोरी है।',exact=False)).to_be_visible()
        student.reload();expect(student.locator('.doubt-turn')).to_have_count(2)
        harness.check(True,'waived paid-course student chat, follow-up, language, citations, source opening, feedback and private history')
        control('fail-next');student.get_by_label('Your doubt',exact=True).fill('Retry this synthetic doubt');student.get_by_role('button',name='Ask Doubt Dost',exact=True).click()
        expect(student.get_by_role('alert').filter(has_text='Synthetic AI interruption')).to_be_visible();expect(student.get_by_label('Your doubt',exact=True)).to_have_value('Retry this synthetic doubt')
        student.get_by_role('button',name='Ask Doubt Dost',exact=True).click();expect(student.get_by_label('Your doubt',exact=True)).to_have_value('')
        student.get_by_label('Answer language',exact=True).select_option('hinglish');student.get_by_label('Your doubt',exact=True).fill('unknown fact from outside the material');student.get_by_role('button',name='Ask Doubt Dost',exact=True).click()
        expect(student.get_by_text('Is course material mein iska pakka jawab nahi mila.',exact=False)).to_be_visible()
        assert 'UNSUPPORTED CONTENT SHOULD NEVER BE SHOWN' not in student.locator('body').inner_text()
        before=control('stats')['questions'];student.get_by_role('link',name='Ask instructor',exact=True).last.click()
        expect(student.get_by_label('Your question',exact=True)).to_have_value('unknown fact from outside the material');assert control('stats')['questions']==before
        student.get_by_role('button',name='Send question',exact=True).click();expect(student.get_by_text('Your question was saved privately.',exact=True)).to_be_visible();assert control('stats')['questions']==before+1
        harness.check(True,'interruption keeps the question; missing evidence abstains; instructor handoff is a reviewed draft')
        student.goto(harness.ORIGIN+f'/courses/{cid}/doubts');expect(student.locator('.doubt-turn')).to_have_count(5)
        for page,label in [(admin,'admin'),(student,'student')]:
            for theme in ['light','dark']:
                if theme=='dark':page.get_by_role('button',name='Switch to dark theme').click()
                for width in [320,1280]:
                    page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(label,theme,width)
                    page.screenshot(path=str(evidence/f'doubt-{label}-{theme}-{width}.png'),full_page=True)
                page.set_viewport_size({'width':640,'height':1000});page.evaluate("document.documentElement.style.zoom='2'");assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(label,theme,'zoom');page.evaluate("document.documentElement.style.zoom=''")
            harness.check(True,f'{label} light/dark 320px/1280px and 200% zoom')
        control('disabled');student.reload();expect(student.get_by_text('Doubt Dost is paused by the platform.',exact=False)).to_be_visible();expect(student.get_by_role('button',name='Ask Doubt Dost',exact=True)).to_be_disabled()
        stats=control('stats');assert stats['published']==1 and stats['documents']==1 and stats['answers']==6,stats
        harness.check(not errors,'no browser errors: '+str(errors));harness.check(not unexpected,'no external provider/media requests: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.unroute_all(behavior='ignoreErrors');ctx.close()
        if fixture.poll() is None:
            fixture.terminate()
            try:fixture.wait(timeout=20)
            except subprocess.TimeoutExpired:fixture.kill();fixture.wait()
        stderr=fixture.stderr.read()
        if stderr:print('Fixture diagnostics: '+stderr[-2000:])

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
