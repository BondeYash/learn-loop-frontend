"""Isolated assessment UI checks. Every API request is synthetic; external requests are blocked."""
import copy
import json
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness

CID = '507f1f77bcf86cd799439022'
MID = '507f1f77bcf86cd799439023'
QID = '507f1f77bcf86cd799439031'
TID = '507f1f77bcf86cd799439032'
QUESTIONS = [
    {'prompt':'Synthetic practice question A','options':['Synthetic A','Synthetic B'],'correctIndex':1,'explanation':'Synthetic authored explanation A. पढ़ाई जारी रखें.','topic':'Practice A'},
    {'prompt':'Synthetic practice question B','options':['Synthetic X','Synthetic Y'],'correctIndex':0,'explanation':'Synthetic authored explanation B.','topic':'Practice B'},
]
def iso(value=None):return datetime.fromtimestamp(time.time() if value is None else value,timezone.utc).isoformat()
def run_checks(browser, media, evidence):
    contexts=[];errors=[];unexpected=[]
    def fixture(role='student',theme='light'):
        ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx)
        ctx.add_init_script(f"if (!localStorage.getItem('lessonloop_theme')) localStorage.setItem('lessonloop_theme','{theme}')")
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        base={'courseId':CID,'moduleId':MID,'title':'Synthetic chapter quiz','kind':'quiz','durationMinutes':None,'status':'published','version':1,'questionCount':2,'questions':copy.deepcopy(QUESTIONS)}
        state={'assessments':{QID:{**base,'id':QID},TID:{**base,'id':TID,'title':'Synthetic timed mock','kind':'mock','moduleId':None,'durationMinutes':1}} if role=='student' else {},'attempts':{},'calls':[],'expired':False,'denied':False,'fail_answer':False,'fail_submit':False,'short_timer':False,'hold':False,'held':[]}
        user={'id':harness.STUDENT_ID,'name':'Fixture learner','email':'fixture@example.invalid','role':role,'mustChangePassword':False}
        course={'course':{'_id':CID,'title':'Synthetic generic course','description':'Authored fixture only','price':0,'isPublished':True,'visibility':'private','instructor':{'name':'Synthetic teacher'}},'modules':[{'_id':MID,'title':'Synthetic chapter','lessons':[]}],'access':{'videos':True}}
        def finish(a,explicit=False):
            if a['status']=='active' and (explicit or a['due'] and time.time()>=a['due']):
                a['status']='timed_out' if a['due'] and time.time()>=a['due'] else 'submitted';a['revision']+=1;a['submittedAt']=iso()
        def dto(a):
            out={k:copy.deepcopy(a[k]) for k in ['id','assessmentId','courseId','title','kind','version','status','revision','answers','startedAt','deadline']};out['serverNow']=iso();out['questions']=[{k:q[k] for k in ['prompt','options','topic']} for q in a['questions']]
            if a['status']!='active':
                correct=sum(a['answers'][i]==q['correctIndex'] for i,q in enumerate(a['questions']));out['result']={'correct':correct,'total':len(a['questions']),'answered':sum(v is not None for v in a['answers']),'percentage':round(correct/len(a['questions'])*100)};out['submittedAt']=a['submittedAt'];out['review']=[{'correctIndex':q['correctIndex'],'selectedIndex':a['answers'][i],'correct':a['answers'][i]==q['correctIndex'],'explanation':q['explanation']} for i,q in enumerate(a['questions'])]
            return out
        def route(r):
            req=r.request;u=urlparse(req.url)
            if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
            if not u.path.startswith('/api/'):r.continue_();return
            path=u.path[4:];method=req.method;body=req.post_data_json if req.post_data else {};state['calls'].append((method,path,body))
            answer=None
            if path=='/auth/me':
                if state['expired']:r.fulfill(status=401,json={'message':'Session ended'});return
                answer={'user':user}
            elif path=='/auth/login':state['expired']=False;answer={'user':user}
            elif state['denied']:r.fulfill(status=403,json={'message':'Synthetic course access is unavailable.'});return
            elif state['expired']:r.fulfill(status=401,json={'message':'Session ended'});return
            elif path in [f'/courses/{CID}',f'/courses/mine/{CID}']:answer=course
            elif path==f'/courses/{CID}/progress':answer={'progress':{'completedLessons':[],'percentage':0}}
            elif path==f'/courses/{CID}/notes':answer={'notes':[]}
            elif path==f'/courses/{CID}/assessments/manage':answer={'assessments':list(state['assessments'].values())}
            elif path==f'/courses/{CID}/assessments' and method=='GET':answer={'assessments':[{k:v for k,v in a.items() if k!='questions'} for a in state['assessments'].values() if a['status']=='published']}
            elif path.startswith(f'/courses/{CID}/assessments') and method in ['POST','PUT']:
                if state['hold']:state['held'].append((r,body,path));return
                if body['status']=='published' and (not body['questions'] or any(not q['prompt'].strip() or q['correctIndex'] is None or any(not o.strip() for o in q['options']) for q in body['questions'])):r.fulfill(status=400,json={'message':'Complete questions, options and correct answers before publishing.'});return
                aid=path.split('/')[-1] if method=='PUT' else f'{1000+len(state["assessments"]):024x}'
                a={**body,'id':aid,'courseId':CID,'moduleId':body['module'],'version':body.get('version',0)+1,'questionCount':len(body['questions'])};state['assessments'][aid]=a;answer={'assessment':a}
            elif path.startswith('/assessments/') and method=='POST':
                aid=path.split('/')[2];a=next((a for a in state['attempts'].values() if a['assessmentId']==aid and a['status']=='active'),None)
                if a:finish(a)
                if not a or a['status']!='active':
                    src=state['assessments'][aid];started=time.time();due=started+(10 if state['short_timer'] else 60) if src['durationMinutes'] else None
                    a={'id':f'{2000+len(state["attempts"]):024x}','assessmentId':aid,'courseId':CID,'title':src['title'],'kind':src['kind'],'version':src['version'],'status':'active','revision':0,'answers':[None]*len(src['questions']),'questions':copy.deepcopy(src['questions']),'startedAt':iso(started),'due':due,'deadline':iso(due) if due else None};state['attempts'][a['id']]=a
                answer={'attempt':dto(a)}
            elif path.startswith('/assessment-attempts/'):
                aid=path.split('/')[2];a=state['attempts'][aid]
                if path.endswith('/answers'):
                    if state['fail_answer']:state['fail_answer']=False;r.fulfill(status=503,json={'message':'Synthetic answer interruption. Retry safely.'});return
                    a['answers'][body['questionIndex']]=body['optionIndex'];a['revision']+=1
                elif path.endswith('/submit'):
                    if state['fail_submit']:state['fail_submit']=False;r.fulfill(status=503,json={'message':'Synthetic submit interruption. Retry safely.'});return
                    finish(a,True)
                else:finish(a)
                answer={'attempt':dto(a)}
            elif path==f'/courses/{CID}/assessment-attempts':
                for a in state['attempts'].values():finish(a)
                ended=[a for a in state['attempts'].values() if a['status']!='active'];weak=[]
                if ended and ended[0]['answers'][1]!=0:weak=[{'topic':'Practice B','correct':0,'total':1,'percentage':0}]
                answer={'attempts':[{k:v for k,v in dto(a).items() if k not in ['questions','review','answers']} for a in reversed(list(state['attempts'].values()))],'weakTopics':weak,'summaryWindow':len(ended),'page':1,'limit':20,'total':len(state['attempts'])}
            else:unexpected.append(req.url);r.fulfill(status=500,json={'message':'Unknown assessment fixture'});return
            r.fulfill(json={'data':answer})
        ctx.route('**/*',route);return page,state
    def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
    def shot(page,name):page.screenshot(path=str(evidence/name),full_page=True,animations='disabled')
    def begin(page,title):
        page.get_by_role('button',name='Start or resume '+('mock test' if title=='mock' else 'quiz'),exact=True).click();dialog=page.get_by_role('dialog');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Start or resume',exact=True).click();expect(page.get_by_role('button',name='Next question',exact=True)).to_be_visible()
    try:
        for theme in ['light','dark']:
            author,state=fixture('instructor',theme);author.goto(harness.ORIGIN+f'/instructor/courses/{CID}/assessments');expect(author.get_by_text('No assessments authored yet.',exact=True)).to_be_visible();author.get_by_role('button',name='Create chapter quiz',exact=True).click()
            author.get_by_label('Test title',exact=True).fill('Synthetic authored quiz');author.get_by_role('button',name='Add question',exact=True).click();author.get_by_label('Question text 1',exact=True).fill('Synthetic teacher question');author.get_by_label('Question 1, option 1',exact=True).fill('First synthetic option');author.get_by_label('Question 1, option 2',exact=True).fill('Second synthetic option');author.get_by_label('Correct answer for question 1',exact=True).select_option('1');author.get_by_label('Topic tag for question 1 (optional)',exact=True).fill('Authored tag')
            author.get_by_role('button',name='Save draft',exact=True).click();expect(author.get_by_text('Draft saved. Students cannot start new attempts on this draft.',exact=True)).to_be_visible();author.reload();expect(author.get_by_role('button',name='Edit Synthetic authored quiz',exact=True)).to_be_visible();author.get_by_role('button',name='Edit Synthetic authored quiz',exact=True).click()
            author.get_by_label('Correct answer for question 1',exact=True).select_option('');author.get_by_role('button',name='Publish quiz',exact=True).click();expect(author.get_by_role('alert')).to_contain_text('Question 1: Choose the correct option.');expect(author.get_by_label('Question text 1',exact=True)).to_have_value('Synthetic teacher question');author.get_by_label('Correct answer for question 1',exact=True).select_option('1');expect(author.get_by_label('Explanation for question 1',exact=True)).to_have_value('');author.get_by_role('button',name='Publish quiz',exact=True).click();expect(author.get_by_text('Test published. Students with course access can start it.',exact=True)).to_be_visible();fits(author,'author 320px '+theme);shot(author,'author-320-'+theme+'.png')
            author.get_by_role('button',name='Back to tests',exact=True).click();author.get_by_role('button',name='Create chapter quiz',exact=True).click();author.get_by_label('Test title',exact=True).fill('Unsaved synthetic work');author.get_by_role('button',name='Cancel',exact=True).click();dialog=author.get_by_role('dialog',name='Discard unsaved assessment changes?');expect(dialog).to_be_visible();author.keyboard.press('Escape');expect(dialog).not_to_be_visible();expect(author.get_by_label('Test title',exact=True)).to_have_value('Unsaved synthetic work');author.get_by_role('button',name='Cancel',exact=True).click();author.get_by_role('button',name='Discard changes',exact=True).click();expect(author.get_by_role('button',name='Create chapter quiz',exact=True)).to_be_visible();assert len(state['assessments'])==1
            author.get_by_role('button',name='Create mock test',exact=True).click();expect(author.get_by_label('Assessment type',exact=True)).to_have_value('mock');expect(author.get_by_label('Time limit in minutes',exact=True)).to_have_value('30');author.get_by_label('Test title',exact=True).fill('Synthetic owner mock');author.get_by_label('Time limit in minutes',exact=True).fill('1');author.get_by_role('button',name='Save draft',exact=True).click();expect(author.get_by_text('Draft saved. Students cannot start new attempts on this draft.',exact=True)).to_be_visible();assert any(a['kind']=='mock' and a['durationMinutes']==1 for a in state['assessments'].values())
            admin,_=fixture('admin',theme);admin.goto(harness.ORIGIN+f'/instructor/courses/{CID}/assessments');expect(admin.get_by_role('button',name='Create chapter quiz',exact=True)).to_be_visible();fits(admin,'admin author access '+theme)
            page,state=fixture('student',theme);page.goto(harness.ORIGIN+f'/courses/{CID}/assessments');expect(page.get_by_role('heading',name='Quizzes and mock tests',exact=True)).to_be_visible();fits(page,'student assessments 320px '+theme);shot(page,'assessments-320-'+theme+'.png');page.set_viewport_size({'width':1280,'height':1000});fits(page,'student assessments desktop '+theme);page.set_viewport_size({'width':640,'height':1000});page.evaluate("document.documentElement.style.zoom='2'");fits(page,'student assessments 200% '+theme);page.evaluate("document.documentElement.style.zoom=''");page.set_viewport_size({'width':320,'height':1000})
            page.get_by_role('button',name='Start or resume quiz',exact=True).click();dialog=page.get_by_role('dialog');expect(dialog.get_by_role('button',name='Cancel',exact=True)).to_be_focused();dialog.get_by_role('button',name='Cancel',exact=True).click();assert not state['attempts'];begin(page,'quiz');assert 'Synthetic authored explanation' not in page.locator('body').inner_text();state['fail_answer']=True;page.get_by_role('radio',name='Synthetic B',exact=True).click();expect(page.get_by_role('alert')).to_contain_text('answer interruption');page.get_by_role('button',name='Retry answer',exact=True).click();expect(page.get_by_role('radio',name='Synthetic B',exact=True)).to_be_checked();attempt_url=page.url;page.reload();expect(page.get_by_role('radio',name='Synthetic B',exact=True)).to_be_checked();fits(page,'saved attempt reload 320px '+theme);shot(page,'attempt-320-'+theme+'.png')
            page.get_by_role('button',name='Next question',exact=True).click();page.get_by_role('radio',name='Synthetic Y',exact=True).click();expect(page.get_by_role('radio',name='Synthetic Y',exact=True)).to_be_checked();page.get_by_role('button',name='Submit attempt',exact=True).click();dialog=page.get_by_role('dialog',name='Submit your attempt?');dialog.get_by_role('button',name='Cancel',exact=True).click();expect(page.get_by_role('radio',name='Synthetic Y',exact=True)).to_be_checked();state['fail_submit']=True;page.get_by_role('button',name='Submit attempt',exact=True).click();dialog.get_by_role('button',name='Submit attempt',exact=True).click();expect(dialog.get_by_role('alert')).to_contain_text('submit interruption');dialog.get_by_role('button',name='Submit attempt',exact=True).click();expect(page.get_by_text('1/2 correct · 50%',exact=True)).to_be_visible();expect(page.get_by_text('Synthetic authored explanation A. पढ़ाई जारी रखें.',exact=True)).to_be_visible();fits(page,'result explanations 320px '+theme);shot(page,'result-320-'+theme+'.png');page.get_by_role('link',name='← Course assessments',exact=True).click();expect(page.get_by_text('Practice B',exact=True)).to_be_visible();expect(page.get_by_role('link',name='View result',exact=True)).to_be_visible()
            state['short_timer']=True;state['fail_submit']=True;begin(page,'mock');deadline=list(state['attempts'].values())[-1]['deadline'];page.reload();expect(page.get_by_role('heading',name='Synthetic timed mock',exact=True)).to_be_visible();assert list(state['attempts'].values())[-1]['deadline']==deadline;expect(page.get_by_role('button',name='Retry submission',exact=True)).to_be_visible(timeout=15000);page.get_by_role('button',name='Retry submission',exact=True).click();expect(page.get_by_text('0/2 correct · 0%',exact=True)).to_be_visible();expect(page.get_by_text('Time ended. Your saved answers were scored.',exact=False)).to_be_visible();shot(page,'timeout-320-'+theme+'.png')
            page.get_by_role('link',name='← Course assessments',exact=True).click();begin(page,'quiz');page.get_by_role('radio',name='Synthetic B',exact=True).click();expect(page.get_by_role('radio',name='Synthetic B',exact=True)).to_be_checked();attempt_url=page.url;state['expired']=True;page.reload();expect(page.get_by_role('heading',name='Welcome back',exact=True)).to_be_visible();assert 'assessment-attempts' in page.url;page.get_by_label('Email',exact=True).fill('fixture@example.invalid');page.get_by_label('Password',exact=True).fill('synthetic-password-123');page.get_by_role('button',name='Sign in',exact=True).click();expect(page.get_by_role('radio',name='Synthetic B',exact=True)).to_be_checked();assert page.url==attempt_url
            state['denied']=True;page.goto(harness.ORIGIN+f'/courses/{CID}/assessments');expect(page.get_by_role('alert')).to_contain_text('course access is unavailable');assert page.get_by_role('button',name='Start or resume quiz',exact=True).count()==0
            harness.check(True,'draft/publish/cancel, authors/admin, answer retry/refresh, submit retry/results, timeout, auth return and access denial '+theme)
        harness.check(not errors,'no runtime errors: '+str(errors));harness.check(not unexpected,'all API requests isolated: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.close()
if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
