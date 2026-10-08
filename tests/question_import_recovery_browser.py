"""Shared admin/instructor PDF recovery with real browser, cookie API and disposable
MongoDB. Optional IMPORT_SOURCE_PDF / IMPORT_OCR_SOURCE_PDF are local user copies;
they are never checked in or sent to an outside service. Otherwise uses synthetic
fixtures. Run with MOCK_TEST_BACKEND_DIR and loopback test MongoDB on 27018.
"""
import json
import os
from pathlib import Path
import selectors
import subprocess
import tempfile
import time
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness
from assessment_feedback_assertions import check_active_feedback_privacy

def run_checks(browser, media, evidence):
    backend=Path(os.environ['MOCK_TEST_BACKEND_DIR']).resolve()
    env={k:v for k,v in os.environ.items() if k not in ['MONGO_URI','MONGO_DB_NAME','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']}
    env.update(NODE_ENV='test',CLIENT_URL=harness.ORIGIN,STRIPE_MODE='test',AUTH_RATE_LIMIT_MAX='100')
    fixture=subprocess.Popen(['node','tests/mockBrowserFixture.js'],cwd=backend,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
    contexts=[];errors=[];unexpected=[];writes=[]
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
        def user_page(role,theme):
            ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx)
            ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
            page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            def route(r):
                u=urlparse(r.request.url)
                if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(r.request.url);r.abort();return
                if not u.path.startswith('/api/'):r.continue_();return
                if r.request.method in ['POST','PUT'] and '/assessments' in u.path:writes.append(r.request.post_data_json)
                response=r.fetch(url=api+u.path+('?' + u.query if u.query else ''))
                attempt=response.json().get('data',{}).get('attempt')
                if attempt and attempt.get('status')=='active':check_active_feedback_privacy(attempt)
                r.fulfill(response=response)
            ctx.route('**/*',route)
            page.goto(harness.ORIGIN+'/login');page.get_by_label('Email',exact=True).fill(meta['users'][role]['email']);page.get_by_label('Password',exact=True).fill(meta['users'][role]['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url('**/'+{'owner':'instructor','student':'student','admin':'admin'}[role]);return page
        def no_workers(page):
            deadline=time.monotonic()+5
            while page.workers and time.monotonic()<deadline:page.wait_for_timeout(100)
            assert not page.workers,[w.url for w in page.workers]
        def confirm(page,label):page.get_by_role('dialog').get_by_role('button',name=label,exact=True).click()
        def close_import(page):
            page.get_by_role('button',name='Close import',exact=True).click()
            if page.get_by_role('dialog').count():confirm(page,'Discard import')
        with tempfile.TemporaryDirectory(prefix='question-recovery-fixtures-') as folder:
            files=Path(folder);subprocess.run(['node','tests/importFixtures.mjs'],cwd=harness.ROOT,env={**env,'MOCK_TEST_BACKEND_DIR':str(backend),'IMPORT_FIXTURE_DIR':folder},check=True)
            original=Path(os.environ.get('IMPORT_SOURCE_PDF',files/'bank.pdf')).resolve()
            supplied='IMPORT_SOURCE_PDF' in os.environ
            assert original.is_file() and original.read_bytes().startswith(b'%PDF-')
            def open_import(page,path,force=False):
                page.get_by_role('button',name='Import PDF, Excel or CSV',exact=True).click();page.get_by_label('Question file',exact=True).set_input_files(path)
                if force:page.get_by_role('checkbox',name='Use OCR for every PDF page',exact=False).check()
                page.get_by_role('button',name='Read selected file',exact=True).click()
            for role,theme in [('owner','light'),('admin','dark')]:
                page=user_page(role,theme);page.goto(harness.ORIGIN+f'/instructor/courses/{cid}/assessments');page.get_by_role('button',name='Create mock test',exact=True).click();title=f'Synthetic recovery {role}';page.get_by_label('Test title',exact=True).fill(title)
                page.get_by_role('button',name='Add question',exact=True).click();page.get_by_label('Question text 1',exact=True).fill('Existing manual question');page.get_by_label('Question 1, option 1',exact=True).fill('Existing correct');page.get_by_label('Question 1, option 2',exact=True).fill('Existing wrong');page.get_by_label('Correct answer for question 1',exact=True).select_option('0');page.get_by_label('Explanation for question 1',exact=True).fill('Synthetic authored explanation for existing question.')
                before=len(writes);open_import(page,files/'merged.pdf')
                expect(page.get_by_label('Import Question 2, option 8',exact=True)).to_have_value('Eight',timeout=30000);expect(page.get_by_label('Import Question text 3',exact=True)).to_have_value('Unaffected last question');expect(page.get_by_label('Import Correct answer for question 2',exact=True)).to_have_value('');expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_disabled();expect(page.get_by_role('alert').filter(has_text='8 option lines')).to_be_visible()
                page.get_by_role('alert').filter(has_text='8 option lines').scroll_into_view_if_needed();page.screenshot(path=str(evidence/f'recovery-merged-viewport-{role}-{theme}.png'))
                page.get_by_text('Correct extracted PDF text and detect again',exact=True).click();raw=page.get_by_label('Extracted page text',exact=True);corrected=raw.input_value().replace('Unnumbered second prompt','3. Recovered second question')
                raw.fill(corrected);expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_disabled();page.get_by_role('button',name='Detect again',exact=True).click();confirm(page,'Cancel');expect(page.get_by_label('Import Question 2, option 8',exact=True)).to_have_value('Eight')
                page.get_by_role('button',name='Detect again',exact=True).click();confirm(page,'Detect again');expect(page.get_by_label('Import Question text 3',exact=True)).to_have_value('Recovered second question');expect(page.get_by_label('Import Question text 4',exact=True)).to_have_value('Unaffected last question');expect(page.get_by_label('Import Question 3, option 4',exact=True)).to_have_value('Eight');expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_enabled()
                # A hard bound failure still exposes the full editable source; old
                # review must not remain applicable after failed re-detection.
                if not raw.is_visible():page.get_by_text('Correct extracted PDF text and detect again',exact=True).click()
                pathological='1. Oversized merged block\n'+'\n'.join(f'{chr(65+i%4)}. Preserved option {i}' for i in range(81))
                raw.fill(pathological);page.get_by_role('button',name='Detect again',exact=True).click();confirm(page,'Detect again');expect(page.get_by_role('alert').filter(has_text='more than 80')).to_be_visible();expect(raw).to_have_value(pathological);assert page.get_by_role('button',name='Add to assessment draft',exact=True).count()==0
                raw.fill(corrected.replace('A. One','A. '+'x'*401));page.get_by_role('button',name='Detect again',exact=True).click();expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_disabled();page.get_by_label('Import Question 2, option 1',exact=True).fill('One');expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_enabled()
                close_import(page);expect(page.get_by_label('Question text 1',exact=True)).to_have_value('Existing manual question');assert len(writes)==before
                harness.check(True,f'{role}: all merged options retained, manual split, cancelled/repeated detection, hard-error recovery, draft field bounds and no premature writes')
                open_import(page,original);expect(page.get_by_label('First detected question',exact=True)).to_be_visible(timeout=30000);expect(page.get_by_role('status').filter(has_text='Detected 100 questions')).to_be_visible();assert page.get_by_label('Import Question text 1',exact=True).count()==0
                page.get_by_label('Last detected question',exact=True).fill('41');expect(page.get_by_role('button',name='Review selected range',exact=True)).to_be_disabled();page.get_by_label('Last detected question',exact=True).fill('40');page.get_by_role('button',name='Review selected range',exact=True).click();expect(page.get_by_label('Import Question text 1',exact=True)).to_have_value('What is the full form of CPU?' if supplied else 'Synthetic bank question 1');expect(page.get_by_label('Import Correct answer for question 1',exact=True)).to_have_value('0' if supplied else '1');expect(page.get_by_label('Import Explanation for question 1',exact=True)).to_have_value('');expect(page.get_by_label('Import Reviewed imported question 1',exact=True)).to_be_enabled();expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_disabled() # existing 1 + 40 exceeds assessment bound
                page.get_by_label('Apply import',exact=True).select_option('replace');expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_enabled();page.get_by_role('button',name='Add to assessment draft',exact=True).click();confirm(page,'Cancel');expect(page.get_by_label('Question text 1',exact=True)).to_have_value('Existing manual question')
                for first,last,expected_first in [(41,80,'Which function is used to count'),(81,100,'Which of these is an example')]:
                    page.get_by_label('First detected question',exact=True).fill(str(first));page.get_by_label('Last detected question',exact=True).fill(str(last));expect(page.get_by_role('button',name='Add to assessment draft',exact=True)).to_be_disabled();page.get_by_role('button',name='Review selected range',exact=True).click();confirm(page,'Review selected range');expect(page.get_by_label('Import Question text 1',exact=True)).to_contain_text(expected_first if supplied else f'Synthetic bank question {first}')
                for _ in range(3):page.get_by_role('button',name='Next 5 questions',exact=True).click()
                expect(page.get_by_label('Import Question text 20',exact=True)).to_contain_text("The 'A' in Aadhaar" if supplied else 'Synthetic bank question 100');expect(page.get_by_label('Import Correct answer for question 20',exact=True)).to_have_value('3' if supplied else '1')
                harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{role}: 100-question range review fits 320px');page.screenshot(path=str(evidence/f'recovery-range-{role}-{theme}.png'),full_page=True)
                page.get_by_label('First detected question',exact=True).scroll_into_view_if_needed();page.screenshot(path=str(evidence/f'recovery-range-viewport-{role}-{theme}.png'))
                page.set_viewport_size({'width':1280,'height':1000});harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{role}: recovery desktop');page.set_viewport_size({'width':640,'height':1000});page.evaluate("document.documentElement.style.zoom='2'");harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{role}: recovery 200% zoom');page.evaluate("document.documentElement.style.zoom='1'");page.set_viewport_size({'width':320,'height':1000})
                page.get_by_label('First detected question',exact=True).fill('1');page.get_by_label('Last detected question',exact=True).fill('2');page.get_by_role('button',name='Review selected range',exact=True).click();confirm(page,'Review selected range');page.get_by_label('Apply import',exact=True).select_option('append');page.get_by_role('button',name='Add to assessment draft',exact=True).dblclick();confirm(page,'Confirm import');expect(page.get_by_label('Question text 3',exact=True)).to_be_visible();page.get_by_role('button',name='Publish mock test',exact=True).click();expect(page.get_by_role('alert')).to_contain_text('mark it reviewed');page.get_by_role('button',name='Save draft',exact=True).click();expect(page.get_by_text('Draft saved. Students cannot start new attempts on this draft.',exact=True)).to_be_visible();page.reload();page.get_by_role('button',name='Edit '+title,exact=True).click();expect(page.get_by_label('Explanation for question 2',exact=True)).to_have_value('');expect(page.get_by_label('Correct answer for question 3',exact=True)).to_have_value('1');expect(page.get_by_label('Reviewed imported question 2',exact=True)).not_to_be_checked()
                for n in [2,3]:expect(page.get_by_label(f'Explanation for question {n}',exact=True)).to_have_value('');expect(page.get_by_label(f'Reviewed imported question {n}',exact=True)).to_be_enabled();page.get_by_label(f'Reviewed imported question {n}',exact=True).check()
                page.get_by_role('button',name='Publish mock test',exact=True).click();expect(page.get_by_text('Test published. Students with course access can start it.',exact=True)).to_be_visible()
                student=user_page('student',theme);student.goto(harness.ORIGIN+f'/courses/{cid}/assessments');card=student.get_by_role('article').filter(has=student.get_by_role('heading',name=title,exact=True));card.get_by_role('button',name='Start or resume mock test',exact=True).click();confirm(student,'Start or resume');student.wait_for_url('**/assessment-attempts/*')
                for n,answer in enumerate(['Existing correct','Central Processing Unit' if supplied else 'Second','RAM' if supplied else 'Second'],1):
                    if n>1:student.get_by_role('button',name=f'Question {n}, unanswered',exact=True).click()
                    student.get_by_role('radio',name=answer,exact=True).click();expect(student.get_by_role('button',name=f'Question {n}, answered',exact=True)).to_be_visible()
                student.get_by_role('button',name='Submit attempt',exact=True).click();confirm(student,'Submit attempt');expect(student.get_by_text('3/3 correct · 100%',exact=True)).to_be_visible()
                harness.check(True,f'{role}: original/synthetic 100-question bank → explicit ranges without truncation → append draft/reload → reviewed publish → private student scoring')
                if supplied:
                    open_import(page,original,force=True);expect(page.get_by_role('alert')).to_contain_text('Turn off',timeout=30000);close_import(page);no_workers(page)
                ocr_path=os.environ.get('IMPORT_OCR_SOURCE_PDF')
                if ocr_path:
                    open_import(page,Path(ocr_path),force=True);expect(page.get_by_label('Import Question text 1',exact=True)).to_contain_text('full form of CPU',timeout=180000);expect(page.get_by_role('status').filter(has_text='29 pending questions')).to_be_visible();assert page.get_by_role('alert').filter(has_text='more than 6 options').count()==0
                    page.get_by_role('button',name='Next 5 questions',exact=True).click();page.get_by_role('button',name='Next 5 questions',exact=True).click();expect(page.get_by_label('Import Question text 11',exact=True)).to_contain_text('My Computer');expect(page.get_by_label('Import Correct answer for question 11',exact=True)).to_have_value('');page.screenshot(path=str(evidence/f'recovery-actual-ocr-{role}.png'),full_page=True);close_import(page);no_workers(page);harness.check(True,f'{role}: real forced OCR of original first four pages no longer merges 11./20./23./24./27. boundaries')
            assert control('stats')=={'assessments':2,'attempts':2,'active':0}
            assert not errors,errors;assert not unexpected,unexpected
            assert len([w for w in writes if w.get('status')=='draft'])==2 and len([w for w in writes if w.get('status')=='published'])==2
            harness.check(True,'both roles share recovery; 2 saved assessments/2 scored attempts; no outside requests or runtime errors')
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
