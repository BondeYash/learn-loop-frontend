"""Real local file extraction/OCR + synthetic cookie-authenticated author/student
flow. No production accounts or APIs; all outbound hosts are blocked.
MOCK_TEST_BACKEND_DIR=/path/to/backend python3 tests/question_import_browser.py
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
    contexts=[];errors=[];unexpected=[];requests=[];writes=[]
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
            ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx);ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
            ctx.on('request',lambda req:requests.append(req.url));page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
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
            page.goto(harness.ORIGIN+'/login');page.get_by_label('Email',exact=True).fill(meta['users'][role]['email']);page.get_by_label('Password',exact=True).fill(meta['users'][role]['password']);page.get_by_role('button',name='Sign in',exact=True).click();page.wait_for_url('**/'+('instructor' if role=='owner' else 'student'));return page
        with tempfile.TemporaryDirectory(prefix='question-import-fixtures-') as folder:
            files=Path(folder);subprocess.run(['node','tests/importFixtures.mjs'],cwd=harness.ROOT,env={**env,'MOCK_TEST_BACKEND_DIR':str(backend),'IMPORT_FIXTURE_DIR':folder},check=True)
            def open_import(page,name,language='eng'):
                page.get_by_role('button',name='Import PDF, Excel or CSV',exact=True).click();page.get_by_label('Question file',exact=True).set_input_files(files/name);page.get_by_label('OCR language',exact=True).select_option(language);page.get_by_role('button',name='Read selected file',exact=True).click()
            def close_import(page):
                page.get_by_role('button',name='Close import',exact=True).click()
                if page.get_by_role('dialog').count():page.get_by_role('dialog').get_by_role('button',name='Discard import',exact=True).click()
            def confirm(page):page.get_by_role('dialog').get_by_role('button',name='Confirm import',exact=True).click()
            def no_workers(page):
                deadline=time.monotonic()+5
                while page.workers and time.monotonic()<deadline:page.wait_for_timeout(100)
                assert not page.workers,[w.url for w in page.workers]
            for theme in ['light','dark']:
                owner=user_page('owner',theme);owner.goto(harness.ORIGIN+f'/instructor/courses/{cid}/assessments');owner.get_by_role('button',name='Create mock test',exact=True).click();title='Synthetic imported '+theme;owner.get_by_label('Test title',exact=True).fill(title)
                open_import(owner,'invalid.csv');expect(owner.get_by_role('alert')).to_contain_text('unterminated');owner.get_by_label('Question file',exact=True).set_input_files(files/'questions.csv');owner.get_by_role('button',name='Read selected file',exact=True).dblclick();expect(owner.get_by_label('Map question',exact=True)).to_be_visible();owner.get_by_role('button',name='Review mapped questions',exact=True).click();expect(owner.get_by_label('Import Question text 1',exact=True)).to_have_value('Synthetic import question 1');assert owner.get_by_label('Import Question text 6',exact=True).count()==0
                owner.get_by_label('Import Question text 1',exact=True).fill('Corrected imported question 1');owner.get_by_label('Import Reviewed imported question 1',exact=True).check();owner.get_by_role('button',name='Next 5 questions',exact=True).click();expect(owner.get_by_label('Import Question text 7',exact=True)).to_be_visible();owner.get_by_role('button',name='Previous 5 questions',exact=True).click();expect(owner.get_by_label('Import Question text 1',exact=True)).to_have_value('Corrected imported question 1');expect(owner.get_by_label('Import Reviewed imported question 1',exact=True)).to_be_checked()
                harness.check(owner.evaluate('document.documentElement.scrollWidth<=innerWidth'),'chunked import fits 320px '+theme);owner.screenshot(path=str(evidence/f'import-review-{theme}.png'),full_page=True)
                owner.get_by_role('button',name='Add to assessment draft',exact=True).dblclick();expect(owner.get_by_role('dialog')).to_contain_text('7 imported questions');owner.get_by_role('dialog').get_by_role('button',name='Cancel',exact=True).click();assert owner.get_by_label('Question text 1',exact=True).count()==0
                owner.get_by_role('button',name='Add to assessment draft',exact=True).click();confirm(owner);expect(owner.get_by_label('Question text 7',exact=True)).to_be_visible();owner.get_by_role('button',name='Publish mock test',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('mark it reviewed');owner.get_by_role('button',name='Save draft',exact=True).click();expect(owner.get_by_text('Draft saved. Students cannot start new attempts on this draft.',exact=True)).to_be_visible();owner.reload();owner.get_by_role('button',name='Edit '+title,exact=True).click();expect(owner.get_by_label('Reviewed imported question 1',exact=True)).to_be_checked();expect(owner.get_by_label('Reviewed imported question 7',exact=True)).not_to_be_checked();expect(owner.get_by_text('Source: CSV row 8',exact=True)).to_be_visible()
                owner.get_by_label('Question text 1',exact=True).fill('Final imported question 1');expect(owner.get_by_label('Reviewed imported question 1',exact=True)).not_to_be_checked()
                owner.get_by_label('Explanation for question 7',exact=True).fill('');expect(owner.get_by_label('Reviewed imported question 7',exact=True)).to_be_enabled()
                for n in range(1,8):owner.get_by_label(f'Reviewed imported question {n}',exact=True).check()
                owner.get_by_role('button',name='Publish mock test',exact=True).click();expect(owner.get_by_text('Test published. Students with course access can start it.',exact=True)).to_be_visible()
                student=user_page('student',theme);student.goto(harness.ORIGIN+f'/courses/{cid}/assessments');card=student.get_by_role('article').filter(has=student.get_by_role('heading',name=title,exact=True));card.get_by_role('button',name='Start or resume mock test',exact=True).click();student.get_by_role('dialog').get_by_role('button',name='Start or resume',exact=True).click();student.wait_for_url('**/assessment-attempts/*')
                for n in range(1,8):
                    if n>1:student.get_by_role('button',name=f'Question {n}, unanswered',exact=True).click()
                    student.get_by_role('radio',name='Second',exact=True).click();expect(student.get_by_role('button',name=f'Question {n}, answered',exact=True)).to_be_visible()
                student.get_by_role('button',name='Submit attempt',exact=True).click();student.get_by_role('dialog').get_by_role('button',name='Submit attempt',exact=True).click();expect(student.get_by_text('7/7 correct · 100%',exact=True)).to_be_visible();expect(student.get_by_text('Supplied explanation 1. पढ़ाई जारी रखें.',exact=True)).to_be_visible()
                harness.check(True,'CSV → chunk review/edit → draft/reload → publish → real student scoring '+theme)
                if theme=='light':
                    for filename,expected in [('formula.xlsx','contains formulas'),('extra-columns.xlsx','beyond the header')]:
                        open_import(owner,filename);expect(owner.get_by_role('alert')).to_contain_text(expected);close_import(owner)
                    open_import(owner,'questions.xlsx');expect(owner.get_by_label('Worksheet',exact=True)).to_have_value('xl/worksheets/sheet1.xml');owner.get_by_role('button',name='Review mapped questions',exact=True).click();expect(owner.get_by_text('Source: Sheet Questions row 2',exact=True)).to_be_visible();owner.get_by_label('Apply import',exact=True).select_option('replace');owner.get_by_role('button',name='Add to assessment draft',exact=True).click();expect(owner.get_by_role('dialog')).to_contain_text('7 existing questions will be replaced');owner.get_by_role('dialog').get_by_role('button',name='Cancel',exact=True).click();close_import(owner);expect(owner.get_by_label('Question text 1',exact=True)).to_have_value('Final imported question 1')
                    harness.check(True,'actual bounded XLSX values + formula/extra-cell rejection + replace cancellation')
                    for filename,expected in [('corrupt.pdf','corrupt'),('locked.pdf','Password-protected'),('too-many-pages.pdf','more than 20')]:
                        open_import(owner,filename);expect(owner.get_by_role('alert')).to_contain_text(expected,timeout=30000);close_import(owner)
                    harness.check(True,'actual corrupt/encrypted/21-page PDF rejection without partial application')
                    open_import(owner,'digital.pdf');expect(owner.get_by_label('Import Question text 1',exact=True)).to_have_value('Digital question',timeout=30000);expect(owner.get_by_label('Import Correct answer for question 1',exact=True)).to_have_value('1');expect(owner.get_by_label('Import Correct answer for question 2',exact=True)).to_have_value('0');expect(owner.get_by_text('Source: PDF pages 1, 2 · question 1',exact=True)).to_be_visible();owner.get_by_role('button',name='Add to assessment draft',exact=True).click();confirm(owner);expect(owner.get_by_label('Question text 9',exact=True)).to_have_value('Second page question');owner.get_by_role('button',name='Publish mock test',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('mark it reviewed');harness.check(True,'actual PDF.js multipage + separate answer key + append without auto-publish')
                    open_import(owner,'scan.pdf');expect(owner.get_by_label('Import Question text 1',exact=True)).to_contain_text('Scanned question',timeout=120000);expect(owner.get_by_text('OCR can misread letters, numbers and Hindi glyphs. Verify against the PDF.',exact=True)).to_be_visible();expect(owner.get_by_label('Import Reviewed imported question 1',exact=True)).not_to_be_checked();owner.screenshot(path=str(evidence/'import-actual-ocr.png'),full_page=True);close_import(owner);harness.check(True,'actual same-origin English OCR engine/model, no guessed review')
                    open_import(owner,'hindi-scan.pdf','eng+hin');expect(owner.get_by_label('Import Question text 1',exact=True)).to_be_visible(timeout=120000);assert any('\u0900'<=c<='\u097f' for c in owner.get_by_label('Import Question text 1',exact=True).input_value());owner.screenshot(path=str(evidence/'import-hindi-ocr.png'),full_page=True);close_import(owner);harness.check(True,'actual Hindi + English OCR preserves Devanagari with review warnings')
                    # Abort inside the actual engine initialization callback, then retry
                    # using the same serialized extractor. No timing-dependent button race.
                    result=owner.evaluate(r"""async ({scan,book}) => {
                      const {extractQuestionFile}=await import('/src/services/extractQuestionFile.js');
                      const {boundedWorkbookArchive}=await import('/src/services/importArchive.js');
                      const {readWorkbookSheet,workbookSheets}=await import('/src/services/importWorkbook.js');
                      const stages=[];
                      for (const target of ['loading tesseract core','recognizing text']) {
                      const ctrl=new AbortController(); let stage='';
                      try {await extractQuestionFile(new File([new Uint8Array(scan)],'scan.pdf'),{signal:ctrl.signal,language:'eng',progress:s=>{if(s.includes(target)) {stage=s;ctrl.abort();}}}); throw Error('Expected initialization cancellation');}
                      catch(e){if(e.name!=='AbortError'||!stage)throw e;}
                      stages.push(stage); }
                      const retried=await extractQuestionFile(new File(['question,option_a,option_b\nQ,A,B'],'retry.csv'),{signal:new AbortController().signal,progress:()=>{}});
                      const files=boundedWorkbookArchive(new Uint8Array(book)), sheet=workbookSheets(files)[0]; let rejects=0;
                      for(const text of [files[sheet.path].replace('<sheetData>','<mergeCells><mergeCell ref="A2:B2"/></mergeCells><sheetData>'),files[sheet.path].replace('r="2"','r="1"'),files[sheet.path].replace('<sheetData>','<!DOCTYPE x><sheetData>')]) {
                        try{readWorkbookSheet({...files,[sheet.path]:text},sheet);throw Error('Expected XML rejection');}catch(e){if(e.message==='Expected XML rejection')throw e;rejects++;}
                      }
                      return {cancelled:stages,retried:retried.rows.length,rejects};
                    }""",{'scan':list((files/'scan.pdf').read_bytes()),'book':list((files/'questions.xlsx').read_bytes())})
                    no_workers(owner)
                    assert len(result['cancelled'])==2 and result['retried']==1 and result['rejects']==3,result
                    harness.check(True,'actual OCR initialization/recognition cancellation releases workers; retry + DOM XML entity/merged/duplicate-row rejection')
                    open_import(owner,'missing.csv');owner.get_by_role('button',name='Review mapped questions',exact=True).click();expect(owner.get_by_label('Import Correct answer for question 1',exact=True)).to_have_value('');expect(owner.get_by_label('Import Explanation for question 1',exact=True)).to_have_value('');expect(owner.get_by_label('Import Reviewed imported question 1',exact=True)).to_be_disabled();close_import(owner)
                    open_import(owner,'scan.pdf');owner.get_by_role('button',name='Cancel extraction',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('cancelled',timeout=10000);close_import(owner);expect(owner.get_by_label('Question text 9',exact=True)).to_have_value('Second page question')
                    open_import(owner,'scan.pdf');owner.evaluate("path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }",f'/instructor/courses/{meta["otherCourseId"]}/assessments');expect(owner.get_by_role('alert')).to_contain_text('do not own');assert owner.get_by_label('Question file',exact=True).count()==0;assert owner.get_by_label('Test title',exact=True).count()==0;no_workers(owner);harness.check(True,'cancel/retry and foreign-course navigation abort import and clear owner fields')
                if theme=='dark':
                    open_import(owner,'scan.pdf');assert control('expireOwnerSession')['expired']
                    owner.evaluate("""async cid => { const {default:axios}=await import('/src/services/axiosInstance.js');try{await axios.get('/courses/'+cid+'/assessments/manage');}catch{} }""",cid)
                    owner.wait_for_url('**/login?**',timeout=15000);assert owner.get_by_label('Question file',exact=True).count()==0;assert owner.get_by_label('Test title',exact=True).count()==0
                    no_workers(owner)
                    harness.check(True,'real expired session redirects and aborts/removes pending importer')
            stats=control('stats');assert stats=={'assessments':2,'attempts':2,'active':0},stats
            assert not errors,errors;assert not unexpected,unexpected
            # Browser/worker requests are all local. Actual engine + both models were loaded.
            assert any('/eng.traineddata.gz' in u for u in requests);assert any('/hin.traineddata.gz' in u for u in requests)
            assert all(urlparse(u).hostname in ['127.0.0.1',None] or u.startswith('blob:') for u in requests),requests
            harness.check(True,'no external document/OCR requests or runtime errors; 2 mocks/2 scored attempts, no duplicates')
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
