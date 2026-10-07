"""Real local admin/instructor authoring and student feedback with cookie API +
disposable MongoDB. All external requests are blocked. Delayed/stale/accepted-
but-interrupted responses simulate transport failures using actual server DTOs.
MOCK_TEST_BACKEND_DIR=/path/to/backend python3 tests/mock_feedback_browser.py
"""
import copy
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness
from assessment_feedback_assertions import check_active_feedback_privacy

def run_checks(browser, media, evidence):
    backend=Path(os.environ['MOCK_TEST_BACKEND_DIR']).resolve()
    env={k:v for k,v in os.environ.items() if k not in ['MONGO_URI','MONGO_DB_NAME','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']}
    env.update(NODE_ENV='test',CLIENT_URL=harness.ORIGIN,STRIPE_MODE='test',AUTH_RATE_LIMIT_MAX='100')
    fixture=subprocess.Popen(['node','tests/mockBrowserFixture.js'],cwd=backend,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    contexts=[];errors=[];unexpected=[];payloads=[]
    def read():
        with selectors.DefaultSelector() as s:
            s.register(fixture.stdout,selectors.EVENT_READ)
            if not s.select(25):raise RuntimeError('Disposable backend timed out')
        line=fixture.stdout.readline()
        if not line:raise RuntimeError(fixture.stderr.read()[-2000:])
        return json.loads(line)
    def control(action):fixture.stdin.write(json.dumps({'action':action})+'\n');fixture.stdin.flush();return read()
    try:
        meta=read();cid=meta['courseId'];api=meta['apiOrigin']
        def page_for(role,theme):
            ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx)
            ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            state={'drop_answer':False,'hold_get':False,'held':None,'initial':None}
            def route(r):
                req=r.request;u=urlparse(req.url)
                if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
                if not u.path.startswith('/api/'):r.continue_();return
                if state['hold_get'] and req.method=='GET' and '/assessment-attempts/' in u.path:
                    state['hold_get']=False;state['held']=r;return
                response=r.fetch(url=api+u.path+('?' + u.query if u.query else ''))
                a=response.json().get('data',{}).get('attempt')
                if a and a['status']=='active':
                    check_active_feedback_privacy(a);payloads.append(copy.deepcopy(a))
                    if state['initial'] is None:state['initial']=copy.deepcopy(a)
                if state['drop_answer'] and u.path.endswith('/answers') and response.status==200:
                    state['drop_answer']=False;r.fulfill(status=503,json={'message':'Synthetic accepted answer response interrupted. Retry safely.'});return
                r.fulfill(response=response)
            ctx.route('**/*',route)
            page.goto(harness.ORIGIN+'/login');page.get_by_label('Email',exact=True).fill(meta['users'][role]['email']);page.get_by_label('Password',exact=True).fill(meta['users'][role]['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url('**/'+{'owner':'instructor','admin':'admin','student':'student','second':'student'}[role]);return page,state
        def confirm(page,label):page.get_by_role('dialog').get_by_role('button',name=label,exact=True).click()
        def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
        def color_of(page,option):return page.get_by_role('radio',name=option,exact=True).evaluate("e=>getComputedStyle(e.closest('label')).backgroundColor")
        def green(page,option):
            color=list(map(float,re.findall(r'[\d.]+',color_of(page,option))));assert color[1]>color[0],color
        def red(page,option):
            color=list(map(float,re.findall(r'[\d.]+',color_of(page,option))));assert color[0]>color[1],color
        for role,theme in [('owner','light'),('admin','dark')]:
            author,_=page_for(role,theme);author.goto(harness.ORIGIN+f'/instructor/courses/{cid}/assessments');author.get_by_role('button',name='Create mock test',exact=True).click();title='Synthetic feedback '+role;author.get_by_label('Test title',exact=True).fill(title)
            for n in range(1,4):
                author.get_by_role('button',name='Add question',exact=True).click();author.get_by_label(f'Question text {n}',exact=True).fill(f'Synthetic feedback question {n}');author.get_by_label(f'Question {n}, option 1',exact=True).fill(f'Wrong {n}');author.get_by_label(f'Question {n}, option 2',exact=True).fill(f'Correct {n}');author.get_by_label(f'Correct answer for question {n}',exact=True).select_option('1');author.get_by_label(f'Explanation for question {n}',exact=True).fill(f'Synthetic explanation {n}. पढ़ाई जारी रखें.')
            author.get_by_role('button',name='Publish mock test',exact=True).click();expect(author.get_by_text('Test published. Students with course access can start it.',exact=True)).to_be_visible()
            student,state=page_for('student',theme);student.goto(harness.ORIGIN+f'/courses/{cid}/assessments');card=student.get_by_role('article').filter(has=student.get_by_role('heading',name=title,exact=True));card.get_by_role('button',name='Start or resume mock test',exact=True).click();expect(student.get_by_role('dialog')).to_contain_text('first saved choice is final');confirm(student,'Start or resume');student.wait_for_url('**/assessment-attempts/*');attempt_url=student.url
            expect(student.get_by_role('radio',name='Wrong 1',exact=True)).to_be_enabled();assert student.get_by_text('Correct answer',exact=True).count()==0;assert student.get_by_role('button',name='Clear answer',exact=True).count()==0
            student.get_by_role('button',name='Question 3, unanswered',exact=True).click();expect(student.get_by_role('radio',name='Correct 3',exact=True)).to_be_enabled();student.get_by_role('button',name='Question 1, unanswered',exact=True).click()
            state['drop_answer']=True;student.get_by_role('radio',name='Wrong 1',exact=True).focus();student.keyboard.press('Space');expect(student.get_by_role('alert')).to_contain_text('accepted answer response interrupted');assert student.get_by_text('Correct answer',exact=True).count()==0
            if role=='owner':
                state['hold_get']=True;student.get_by_role('button',name='Reload attempt',exact=True).click();student.get_by_role('button',name='Retry answer',exact=True).click();expect(student.get_by_role('status').filter(has_text='Incorrect — 0 points')).to_be_visible();assert state['held'] is not None;state['held'].fulfill(json={'data':{'attempt':state['initial']}});state['held']=None
            else:
                # The first write succeeded even though its response was lost.
                # Trying another choice must load that first choice, not inflate it.
                student.get_by_role('radio',name='Correct 1',exact=True).click()
            expect(student.get_by_role('status').filter(has_text='Incorrect — 0 points')).to_be_visible();expect(student.get_by_role('radio',name='Wrong 1',exact=True)).to_be_checked();expect(student.get_by_role('radio',name='Correct 1',exact=True)).to_be_disabled();green(student,'Correct 1');red(student,'Wrong 1');expect(student.get_by_text('✓ Correct answer',exact=True)).to_be_visible();expect(student.get_by_text('✕ Your answer · Incorrect',exact=True)).to_be_visible()
            student.get_by_role('radio',name='Correct 1',exact=True).scroll_into_view_if_needed();fits(student,'wrong/correct feedback fits 320px '+theme);student.screenshot(path=str(evidence/f'feedback-incorrect-{theme}.png'))
            student.set_viewport_size({'width':1280,'height':1000});fits(student,'feedback desktop '+theme);student.set_viewport_size({'width':640,'height':1000});student.evaluate("document.documentElement.style.zoom='2'");fits(student,'feedback 200% '+theme);student.evaluate("document.documentElement.style.zoom='1'");student.set_viewport_size({'width':320,'height':1000})
            student.get_by_role('button',name='Next question',exact=True).focus();student.keyboard.press('Enter');expect(student.get_by_role('radio',name='Correct 2',exact=True)).to_be_enabled();assert student.get_by_text('Correct answer',exact=True).count()==0
            if role=='admin':state['drop_answer']=True
            student.get_by_role('radio',name='Correct 2',exact=True).focus();student.keyboard.press('Space')
            if role=='admin':expect(student.get_by_role('alert')).to_contain_text('accepted answer response interrupted');student.get_by_role('button',name='Retry answer',exact=True).click()
            feedback=student.get_by_role('status').filter(has_text='Correct — 1 point');expect(feedback).to_be_visible();expect(feedback).to_be_focused();expect(student.get_by_role('radio',name='Correct 2',exact=True)).to_be_disabled();green(student,'Correct 2');expect(student.get_by_text('✓ Your answer · Correct',exact=True)).to_be_visible();student.screenshot(path=str(evidence/f'feedback-correct-{theme}.png'))
            student.get_by_role('button',name='Previous question',exact=True).click();expect(student.get_by_role('status').filter(has_text='Incorrect — 0 points')).to_be_visible();student.reload();expect(student.get_by_role('status').filter(has_text='Incorrect — 0 points')).to_be_visible();green(student,'Correct 1');red(student,'Wrong 1')
            student.get_by_role('link',name='← Course assessments',exact=True).click();student.go_back();expect(student).to_have_url(attempt_url);expect(student.get_by_role('radio',name='Wrong 1',exact=True)).to_be_checked();expect(student.get_by_role('radio',name='Wrong 1',exact=True)).to_be_disabled()
            replay=student.evaluate("""async ()=>{const {default:axios}=await import('/src/services/axiosInstance.js');const id=location.pathname.split('/').pop();const out=[];for(const choice of [0,1,null]){try{const r=await axios.put('/assessment-attempts/'+id+'/answers',{questionIndex:0,optionIndex:choice});out.push({status:r.status,answers:r.data.data.attempt.answers,revision:r.data.data.attempt.revision});}catch(e){out.push({status:e.response.status});}}return out;}""")
            assert [r['status'] for r in replay]==[200,409,400],replay;assert replay[0]['answers']==[0,1,None] and replay[0]['revision']==2,replay
            student.get_by_role('button',name='Question 3, unanswered',exact=True).click();expect(student.get_by_role('radio',name='Correct 3',exact=True)).to_be_enabled();assert student.get_by_text('Correct answer',exact=True).count()==0
            student.get_by_role('button',name='Submit attempt',exact=True).click();expect(student.get_by_role('dialog')).to_contain_text('1 unanswered question');confirm(student,'Cancel');expect(student.get_by_role('radio',name='Correct 3',exact=True)).to_be_enabled();student.get_by_role('button',name='Submit attempt',exact=True).click();confirm(student,'Submit attempt');expect(student.get_by_text('1/3 correct · 33%',exact=True)).to_be_visible();expect(student.get_by_text('Your answer: Unanswered',exact=True)).to_be_visible();student.reload();expect(student.get_by_text('1/3 correct · 33%',exact=True)).to_be_visible();expect(student.get_by_role('region',name='Result explanations',exact=True)).to_contain_text('Synthetic explanation 1. पढ़ाई जारी रखें.')
            other,_=page_for('second',theme);other.goto(attempt_url);expect(other.get_by_role('alert')).to_contain_text('not found');assert other.get_by_role('radio').count()==0
            harness.check(True,f'{role}/{theme}: keyboard feedback, actual green/red styles and labels, first choice lock, interruption/retry/stale response, reload/back, unanswered + final first-choice scoring, own-attempt privacy')
        assert control('stats')=={'assessments':2,'attempts':2,'active':0}
        # Session expiry removes already revealed active feedback.
        student.get_by_role('link',name='← Course assessments',exact=True).click();card=student.get_by_role('article').filter(has=student.get_by_role('heading',name=title,exact=True));card.get_by_role('button',name='Start or resume mock test',exact=True).click();confirm(student,'Start or resume');student.wait_for_url('**/assessment-attempts/*');student.get_by_role('radio',name='Correct 1',exact=True).click();expect(student.get_by_role('status').filter(has_text='Correct — 1 point')).to_be_visible();assert control('expireStudentSession')['expired'];student.reload();student.wait_for_url('**/login?**');assert student.get_by_role('radio').count()==0;assert student.get_by_text('✓ Your answer · Correct',exact=True).count()==0
        assert not errors,errors;assert not unexpected,unexpected;assert payloads and any(a['feedback'][0] for a in payloads if a.get('feedback'))
        harness.check(True,'expired student session clears feedback; no outside requests/runtime errors; accepted mock answers never expose unanswered keys or explanations')
    finally:
        for ctx in contexts:ctx.unroute_all(behavior='ignoreErrors');ctx.close()
        if fixture.poll() is None:
            fixture.terminate()
            try:fixture.wait(timeout=15)
            except subprocess.TimeoutExpired:fixture.kill();fixture.wait()
        stderr=fixture.stderr.read()
        if stderr:print(stderr[-2000:])

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
