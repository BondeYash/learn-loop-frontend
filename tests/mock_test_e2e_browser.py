"""Actual instructor/student UI + cookie auth + Express/MongoDB. Synthetic local
fixtures only. APIs are forwarded to the disposable backend, never mocked.
MOCK_TEST_BACKEND_DIR=/path/to/backend python3 tests/mock_test_e2e_browser.py
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
    backend_dir=Path(os.environ['MOCK_TEST_BACKEND_DIR']).resolve()
    env={k:v for k,v in os.environ.items() if k not in ['MONGO_URI','MONGO_DB_NAME','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']}
    env.update(NODE_ENV='test',CLIENT_URL=harness.ORIGIN,STRIPE_MODE='test',AUTH_RATE_LIMIT_MAX='100')
    fixture=subprocess.Popen(['node','tests/mockBrowserFixture.js'],cwd=backend_dir,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    contexts=[];errors=[];unexpected=[];calls=[];active_payloads=[]
    def read():
        with selectors.DefaultSelector() as selector:
            selector.register(fixture.stdout,selectors.EVENT_READ)
            if not selector.select(25):raise RuntimeError('Disposable backend response timed out')
        line=fixture.stdout.readline()
        if not line:raise RuntimeError('Disposable backend ended: '+fixture.stderr.read()[-2000:])
        return json.loads(line)
    def control(action,**values):fixture.stdin.write(json.dumps(dict(action=action,**values))+'\n');fixture.stdin.flush();return read()
    try:
        meta=read();cid=meta['courseId'];api=meta['apiOrigin'];assert api.startswith('http://127.0.0.1:')
        def page_for(role,theme):
            ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx)
            ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));state={'drop_create':False,'drop_answer':False,'drop_submit':False}
            def route(r):
                req=r.request;u=urlparse(req.url)
                if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
                if not u.path.startswith('/api/'):r.continue_();return
                body=req.post_data_json if req.post_data else {};calls.append((role,req.method,u.path,body))
                response=r.fetch(url=api+u.path+('?' + u.query if u.query else ''),max_retries=1 if req.method=='GET' else 0)
                data=response.json();attempt=data.get('data',{}).get('attempt')
                if attempt and attempt.get('status')=='active':
                    active_payloads.append(attempt)
                    assert not any(key in json.dumps(attempt) for key in ['correctIndex','explanation','snapshot'])
                key='drop_create' if req.method=='POST' and u.path.endswith('/assessments') else 'drop_answer' if u.path.endswith('/answers') else 'drop_submit' if u.path.endswith('/submit') else None
                if key and state[key] and response.status<400:
                    state[key]=False;r.fulfill(status=503,json={'message':'Synthetic accepted response interrupted. Retry the same action.'});return
                r.fulfill(response=response)
            ctx.route('**/*',route)
            def login():
                page.goto(harness.ORIGIN+'/login');page.get_by_label('Email',exact=True).fill(meta['users'][role]['email']);page.get_by_label('Password',exact=True).fill(meta['users'][role]['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url('**/'+{'owner':'instructor','student':'student','second':'student','other':'instructor','admin':'admin'}[role])
            login();return page,state
        def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
        def fill_question(page,index,prompt,first,second,correct,explanation):
            page.get_by_role('button',name='Add question',exact=True).click();page.get_by_label(f'Question text {index}',exact=True).fill(prompt);page.get_by_label(f'Question {index}, option 1',exact=True).fill(first);page.get_by_label(f'Question {index}, option 2',exact=True).fill(second);page.get_by_label(f'Correct answer for question {index}',exact=True).select_option(str(correct));page.get_by_label(f'Explanation for question {index}',exact=True).fill(explanation)
        for theme in ['light','dark']:
            title='Synthetic '+theme+' course mock'
            owner,state=page_for('owner',theme);owner.goto(harness.ORIGIN+'/instructor');owner.get_by_role('link',name='Mock tests and quizzes',exact=True).click();expect(owner.get_by_role('button',name='Create mock test',exact=True)).to_be_visible()
            owner.get_by_role('button',name='Create mock test',exact=True).click();expect(owner.get_by_label('Assessment type',exact=True)).to_have_value('mock');expect(owner.get_by_label('Time limit in minutes',exact=True)).to_have_value('30');assert owner.get_by_label('Chapter',exact=True).count()==0
            owner.get_by_label('Test title',exact=True).fill(title);owner.get_by_label('Time limit in minutes',exact=True).fill('1');owner.get_by_role('button',name='Publish mock test',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('at least one complete question')
            owner.get_by_label('Time limit in minutes',exact=True).fill('0');owner.get_by_role('button',name='Save draft',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('whole number from 1 to 180');owner.get_by_label('Time limit in minutes',exact=True).fill('1');state['drop_create']=True;owner.get_by_role('button',name='Save draft',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('accepted response interrupted');expect(owner.get_by_label('Test title',exact=True)).to_have_value(title);owner.get_by_role('button',name='Save draft',exact=True).dblclick();expect(owner.get_by_text('Draft saved. Students cannot start new attempts on this draft.',exact=True)).to_be_visible()
            student,student_state=page_for('student',theme);student.goto(harness.ORIGIN+f'/courses/{cid}');student.get_by_role('link',name='Mock tests',exact=True).click();assert student.get_by_role('heading',name=title,exact=True).count()==0
            fill_question(owner,1,'Synthetic question A','Synthetic wrong A','Synthetic right A',1,'Synthetic original explanation A. पढ़ाई जारी रखें.');fill_question(owner,2,'Synthetic question B','Synthetic right B','Synthetic wrong B',0,'Synthetic original explanation B.');owner.get_by_role('button',name='Publish mock test',exact=True).click();expect(owner.get_by_text('Test published. Students with course access can start it.',exact=True)).to_be_visible();owner.get_by_role('button',name='Back to tests',exact=True).click();expect(owner.get_by_role('button',name='Edit '+title,exact=True)).to_have_count(1);fits(owner,'actual instructor mock list 320px '+theme)
            student.reload();card=student.get_by_role('article').filter(has=student.get_by_role('heading',name=title,exact=True));expect(card).to_contain_text('2 questions');expect(card).to_contain_text('1 minutes');card.get_by_role('button',name='Start or resume mock test',exact=True).click();dialog=student.get_by_role('dialog');expect(dialog).to_contain_text('timer');dialog.get_by_role('button',name='Start or resume',exact=True).dblclick();student.wait_for_url('**/assessment-attempts/*');attempt_id=student.url.split('/')[-1];expect(student.get_by_role('radio',name='Synthetic right A',exact=True)).to_be_visible()
            student_state['drop_answer']=True;student.get_by_role('radio',name='Synthetic right A',exact=True).click();expect(student.get_by_role('alert')).to_contain_text('accepted response interrupted');student.get_by_role('button',name='Retry answer',exact=True).click();expect(student.get_by_role('radio',name='Synthetic right A',exact=True)).to_be_checked();student.reload();expect(student.get_by_role('radio',name='Synthetic right A',exact=True)).to_be_checked()
            owner.get_by_role('button',name='Edit '+title,exact=True).click();owner.get_by_label('Explanation for question 1',exact=True).fill('Synthetic changed explanation for future attempts.');owner.get_by_role('button',name='Publish mock test',exact=True).click();expect(owner.get_by_text('Test published. Students with course access can start it.',exact=True)).to_be_visible()
            student.get_by_role('button',name='Question 2, unanswered',exact=True).click();student.get_by_role('radio',name='Synthetic wrong B',exact=True).click();expect(student.get_by_role('button',name='Question 2, answered',exact=True)).to_have_attribute('aria-current','step');fits(student,'actual saved mock attempt 320px '+theme);student.screenshot(path=str(evidence/f'mock-attempt-{theme}.png'),full_page=True)
            student.get_by_role('button',name='Submit attempt',exact=True).click();dialog=student.get_by_role('dialog',name='Submit your attempt?');student_state['drop_submit']=True;dialog.get_by_role('button',name='Submit attempt',exact=True).click();expect(dialog.get_by_role('alert')).to_contain_text('accepted response interrupted');dialog.get_by_role('button',name='Submit attempt',exact=True).dblclick();expect(student.get_by_text('1/2 correct · 50%',exact=True)).to_be_visible();expect(student.get_by_text('Synthetic original explanation A. पढ़ाई जारी रखें.',exact=True)).to_be_visible();assert 'Synthetic changed explanation for future attempts.' not in student.locator('body').inner_text();student.reload();expect(student.get_by_text('1/2 correct · 50%',exact=True)).to_be_visible();fits(student,'actual immutable result 320px '+theme);student.screenshot(path=str(evidence/f'mock-result-{theme}.png'),full_page=True)
            student.get_by_role('link',name='← Course assessments',exact=True).click();expect(student.get_by_role('link',name='View result',exact=True)).to_have_count(1 if theme=='light' else 3);card=student.get_by_role('article').filter(has=student.get_by_role('heading',name=title,exact=True));card.get_by_role('button',name='Start or resume mock test',exact=True).click();student.get_by_role('dialog').get_by_role('button',name='Start or resume',exact=True).click();student.wait_for_url('**/assessment-attempts/*');timed_id=student.url.split('/')[-1];assert timed_id!=attempt_id
            assert control('expire',attemptId=timed_id)['updated']==1;student.reload();expect(student.get_by_text('Time ended. Your saved answers were scored.',exact=False)).to_be_visible(timeout=10000);expect(student.get_by_text('0/2 correct · 0%',exact=True)).to_be_visible();expect(student.get_by_text('Synthetic changed explanation for future attempts.',exact=True)).to_be_visible();student.screenshot(path=str(evidence/f'mock-timeout-{theme}.png'),full_page=True)
            owner.set_viewport_size({'width':1280,'height':1000});fits(owner,'actual author desktop '+theme);owner.set_viewport_size({'width':640,'height':1000});owner.evaluate("document.documentElement.style.zoom='2'");fits(owner,'actual author 200% '+theme);owner.screenshot(path=str(evidence/f'mock-author-{theme}.png'),full_page=True)
            admin,_=page_for('admin',theme);admin.goto(harness.ORIGIN+f'/instructor/courses/{cid}/assessments');expect(admin.get_by_role('button',name='Create mock test',exact=True)).to_be_visible();admin.goto(harness.ORIGIN+f'/instructor/courses/{meta["otherCourseId"]}/assessments');expect(admin.get_by_role('button',name='Create mock test',exact=True)).to_be_visible()
            owner.evaluate("path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }",f'/instructor/courses/{meta["otherCourseId"]}/assessments');expect(owner.get_by_role('alert')).to_contain_text('do not own');assert owner.get_by_role('button',name='Create mock test',exact=True).count()==0;assert owner.get_by_label('Test title',exact=True).count()==0;assert title not in owner.locator('body').inner_text()
            second,_=page_for('second',theme);second.goto(harness.ORIGIN+f'/assessment-attempts/{attempt_id}');expect(second.get_by_role('alert')).to_contain_text('not found');assert second.get_by_role('region',name='Result explanations',exact=True).count()==0
            harness.check(True,'real author draft/publish/edit → student resume/submit/history/timeout; retry, keys and scopes '+theme)
        stats=control('stats');assert stats=={'assessments':2,'attempts':4,'active':0},stats;assert active_payloads
        creation=[b['requestId'] for role,m,p,b in calls if role=='owner' and m=='POST' and p.endswith('/assessments') and b.get('status')=='draft' and b.get('durationMinutes')==1];assert len(creation)==4 and creation[0]==creation[1] and creation[2]==creation[3]
        assert control('revoke')['revoked'];student.goto(harness.ORIGIN+f'/courses/{cid}/assessments');expect(student.get_by_role('alert')).to_contain_text('not assigned');assert student.get_by_role('button',name='Start or resume mock test',exact=True).count()==0
        harness.check(not errors,'no runtime errors: '+str(errors));harness.check(not unexpected,'no external requests: '+str(unexpected));harness.check(True,'actual MongoDB: 2 authored mocks, 4 ended attempts, no duplicates or active remnants')
    finally:
        try:
            for ctx in contexts:
                ctx.unroute_all(behavior='ignoreErrors');ctx.close()
        finally:
            if fixture.poll() is None:
                fixture.terminate()
                try:fixture.wait(timeout=15)
                except subprocess.TimeoutExpired:fixture.kill();fixture.wait()
            fixture_errors=fixture.stderr.read()
            if fixture_errors:print('Disposable backend stderr: '+fixture_errors[-2000:])

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
