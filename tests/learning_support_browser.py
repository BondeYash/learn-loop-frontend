"""Actual learning-support UI with synthetic intercepted APIs and no external calls."""
import copy
import json
import time
from datetime import datetime,timezone
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness
CID='507f1f77bcf86cd799439022';LID='507f1f77bcf86cd799439023';VID='507f1f77bcf86cd799439024';TID='507f1f77bcf86cd799439025';QID='507f1f77bcf86cd799439026'
def now():return datetime.now(timezone.utc).isoformat()
def run_checks(browser,media,evidence):
    contexts=[];errors=[];unexpected=[]
    def state():return {'tasks':[],'record':None,'question':None,'progress':{'completedLessons':[],'completedCount':0,'totalLessons':2,'percentage':0,'resumeRevision':1,'resume':{'lesson':VID,'position':12,'visitedAt':now()}},'calls':[],'record_drop':True,'question_drop':True,'reply_drop':True,'denied':False,'expired':False}
    def fixture(role,theme,s):
        ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx);ctx.add_init_script(f"if (!localStorage.getItem('lessonloop_theme')) localStorage.setItem('lessonloop_theme','{theme}')");page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        user={'id':harness.STUDENT_ID,'name':'Synthetic learner' if role=='student' else 'Synthetic teacher','role':role,'mustChangePassword':False}
        course={'_id':CID,'title':'Synthetic general course','description':'Owner-authored test fixture','price':0,'instructor':{'name':'Synthetic teacher'},'isPublished':True}
        modules=[{'_id':'module-fixture','title':'Synthetic chapter','lessons':[{'_id':LID,'title':'Synthetic text lesson','contentType':'text','content':'Synthetic authored text.'},{'_id':VID,'title':'Synthetic video lesson','contentType':'video','video':{'status':'ready'}}]}]
        def progress():
            p=copy.deepcopy(s['progress'])
            if p['resume'] and p['resume']['lesson'] not in [LID,VID]:p['resume']=None
            return p
        def question():
            q=copy.deepcopy(s['question']);q.pop('requestId',None);q['status']='resolved' if q['resolved'] else 'answered' if q['replies'] else 'pending'
            if role!='student':q['studentName']='Synthetic learner'
            return q
        def route(r):
            req=r.request;u=urlparse(req.url)
            if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
            if u.path=='/__fixture__/video.mp4':
                headers={'Accept-Ranges':'bytes','Cache-Control':'no-store'}
                byte_range=req.headers.get('range')
                if byte_range:
                    start,end=byte_range.removeprefix('bytes=').split('-');start=int(start or 0);end=int(end) if end else len(media)-1
                    headers['Content-Range']=f'bytes {start}-{end}/{len(media)}'
                    r.fulfill(status=206,content_type='video/mp4',headers=headers,body=media[start:end+1])
                else:r.fulfill(content_type='video/mp4',headers=headers,body=media)
                return
            if not u.path.startswith('/api/'):r.continue_();return
            path=u.path[4:];method=req.method;body=req.post_data_json if req.post_data else {};s['calls'].append((role,method,path,body));out=None
            if path=='/auth/me':
                if s['expired'] and role=='student':r.fulfill(status=401,json={'message':'Session ended'});return
                out={'user':user}
            elif path=='/auth/login':s['expired']=False;out={'user':user}
            elif s['denied'] and role=='student':r.fulfill(status=403,json={'message':'Synthetic course access was revoked.'});return
            elif path=='/courses':out={'courses':[{**course,'access':{'videos':True,'status':'active'},'progress':progress()}]}
            elif path in [f'/courses/{CID}',f'/courses/mine/{CID}']:out={'course':course,'modules':modules,'access':{'videos':True}}
            elif path==f'/courses/{CID}/progress':out={'progress':progress()}
            elif path==f'/courses/{CID}/notes':out={'notes':[]}
            elif path.endswith('/playback'):out={'url':harness.ORIGIN+'/__fixture__/video.mp4','expiresAt':int(time.time()*1000)+300000}
            elif path.startswith('/lessons/') and path.endswith('/visit'):
                lesson=path.split('/')[2];s['progress']['resume']={'lesson':lesson,'position':body['position'],'visitedAt':now()};s['progress']['resumeRevision']+=1;out={'progress':progress()}
            elif path.startswith('/lessons/') and path.endswith('/complete'):
                lesson=path.split('/')[2]
                if lesson not in s['progress']['completedLessons']:s['progress']['completedLessons'].append(lesson)
                s['progress']['completedCount']=len(s['progress']['completedLessons']);s['progress']['percentage']=s['progress']['completedCount']*50;out={'progress':progress()}
            elif path.startswith(f'/courses/{CID}/practicals'):
                if method=='GET':out={'tasks':[{**t,'record':copy.deepcopy(s['record']) if role=='student' else None} for t in s['tasks'] if role!='student' or t['active']]}
                else:
                    t={'id':TID,'title':body['title'],'instructions':body['instructions'],'checklist':body['checklist'],'active':body['active'],'lessonId':body['lesson'],'version':body.get('version',0)+1};s['tasks']=[t];out={'task':t}
            elif path==f'/practicals/{TID}/record':
                if not s['record'] or s['record']['requestId']!=body['requestId']:s['record']={**body,'id':'record-fixture','taskId':TID,'taskTitle':s['tasks'][0]['title'],'revision':(s['record']['revision'] if s['record'] else 0)+1,'completedAt':now(),'updatedAt':now()}
                if s['record_drop']:s['record_drop']=False;r.fulfill(status=503,json={'message':'Synthetic record response interrupted. Retry safely.'});return
                out={'record':s['record']}
            elif path==f'/courses/{CID}/practical-records':out={'records':[{**s['record'],'studentName':'Synthetic learner'}] if s['record'] else [],'total':1 if s['record'] else 0,'page':1,'limit':20}
            elif path==f'/courses/{CID}/questions':
                if method=='POST':
                    if not s['question']:s['question']={'id':QID,'text':body['text'],'lessonId':body['lesson'],'requestId':body['requestId'],'replies':[],'resolved':False,'version':1,'createdAt':now()}
                    if s['question_drop']:s['question_drop']=False;r.fulfill(status=503,json={'message':'Synthetic question response interrupted. Retry safely.'});return
                    out={'question':question()}
                else:out={'questions':[question()] if s['question'] else [],'page':1,'limit':20,'total':1 if s['question'] else 0}
            elif path==f'/course-questions/{QID}/replies':
                if not any(reply.get('requestId')==body['requestId'] for reply in s['question']['replies']):s['question']['replies'].append({'text':body['text'],'name':'Synthetic teacher','createdAt':now(),'requestId':body['requestId']});s['question']['version']+=1
                if s['reply_drop']:s['reply_drop']=False;r.fulfill(status=503,json={'message':'Synthetic reply response interrupted. Retry safely.'});return
                out={'question':question()}
            elif path==f'/course-questions/{QID}/status':s['question']['resolved']=body['resolved'];s['question']['version']+=1;out={'question':question()}
            else:unexpected.append(req.url);r.fulfill(status=500,json={'message':'Unknown support fixture'});return
            r.fulfill(json={'data':out})
        ctx.route('**/*',route);return page
    def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
    def shot(page,name):page.screenshot(path=str(evidence/name),full_page=True,animations='disabled')
    def wait(page,predicate):
        for _ in range(100):
            if predicate():return
            page.wait_for_timeout(50)
        assert predicate()
    try:
        for theme in ['light','dark']:
            s=state();owner=fixture('instructor',theme,s);owner.goto(harness.ORIGIN+f'/instructor/courses/{CID}/support');expect(owner.get_by_text('No practical tasks have been authored yet.',exact=True)).to_be_visible();owner.get_by_role('button',name='Create practical task',exact=True).click();owner.get_by_label('Task title',exact=True).fill('Synthetic practical task');owner.get_by_label('Task instructions',exact=True).fill('Synthetic authored instructions. पढ़ाई जारी रखें.');owner.get_by_label('Checklist (one item per line)',exact=True).fill('Finish the synthetic step');owner.get_by_label('Related lesson (optional)',exact=True).select_option(LID);owner.get_by_role('button',name='Save task',exact=True).click();expect(owner.get_by_text('Practical task saved.',exact=True)).to_be_visible();assert s['tasks'][0]['instructions']=='Synthetic authored instructions. पढ़ाई जारी रखें.';fits(owner,'owner support 320px '+theme)
            owner.get_by_role('button',name='Edit task',exact=True).click();owner.get_by_label('Task instructions',exact=True).fill('Unsaved changes');owner.get_by_role('button',name='Cancel',exact=True).click();dialog=owner.get_by_role('dialog',name='Discard unsaved task changes?');owner.keyboard.press('Escape');expect(dialog).not_to_be_visible();expect(owner.get_by_label('Task instructions',exact=True)).to_have_value('Unsaved changes');owner.get_by_role('button',name='Cancel',exact=True).click();owner.get_by_role('button',name='Discard changes',exact=True).click();assert s['tasks'][0]['instructions'].startswith('Synthetic authored')
            learner=fixture('student',theme,s);learner.goto(harness.ORIGIN+f'/courses/{CID}/support');expect(learner.get_by_role('heading',name='Synthetic practical task',exact=True)).to_be_visible();learner.get_by_role('checkbox',name='Finish the synthetic step',exact=True).check();learner.get_by_label('Your text response (optional)',exact=True).fill('Synthetic student response.');learner.get_by_role('checkbox',name='I completed this task myself (self-reported)',exact=True).check();learner.get_by_role('button',name='Save practical record',exact=True).click();expect(learner.get_by_role('alert')).to_contain_text('record response interrupted');expect(learner.get_by_label('Your text response (optional)',exact=True)).to_have_value('Synthetic student response.');learner.get_by_role('button',name='Save practical record',exact=True).click();expect(learner.get_by_text('Self-reported complete',exact=True)).to_be_visible();records=[b for role,m,p,b in s['calls'] if p.endswith('/record')];assert len(records)==2 and records[0]['requestId']==records[1]['requestId'];assert s['record']['revision']==1;assert s['progress']['completedLessons']==[];learner.reload();expect(learner.get_by_text('Self-reported complete',exact=True)).to_be_visible()
            learner.get_by_role('button',name='Ask a course question',exact=True).click();learner.get_by_label('Your question',exact=True).fill('Unsent fixture question');learner.get_by_role('button',name='Cancel',exact=True).click();dialog=learner.get_by_role('dialog',name='Discard this unsent question?');dialog.get_by_role('button',name='Cancel',exact=True).click();expect(learner.get_by_label('Your question',exact=True)).to_have_value('Unsent fixture question');learner.get_by_role('button',name='Cancel',exact=True).click();learner.get_by_role('button',name='Discard question',exact=True).click();assert s['question'] is None
            learner.get_by_role('button',name='Ask a course question',exact=True).click();learner.get_by_label('Your question',exact=True).fill('Synthetic private learner question');learner.get_by_role('button',name='Send question',exact=True).click();expect(learner.get_by_role('alert')).to_contain_text('question response interrupted');learner.get_by_role('button',name='Send question',exact=True).click();expect(learner.get_by_text('pending',exact=True)).to_be_visible();writes=[b for role,m,p,b in s['calls'] if m=='POST' and p.endswith('/questions')];assert len(writes)==2 and writes[0]['requestId']==writes[1]['requestId']
            owner.reload();expect(owner.get_by_text('Synthetic student response.',exact=True)).to_be_visible();owner.get_by_label('Reply to this question',exact=True).fill('Synthetic authored teacher reply');owner.get_by_role('button',name='Send reply',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('reply response interrupted');owner.get_by_role('button',name='Send reply',exact=True).click();expect(owner.get_by_text('answered · Synthetic learner',exact=True)).to_be_visible();assert len(s['question']['replies'])==1;learner.reload();expect(learner.get_by_text('Synthetic authored teacher reply',exact=True)).to_be_visible();learner.get_by_role('button',name='Mark resolved',exact=True).click();dialog=learner.get_by_role('dialog');dialog.get_by_role('button',name='Cancel',exact=True).click();assert not s['question']['resolved'];learner.get_by_role('button',name='Mark resolved',exact=True).click();learner.get_by_role('dialog').get_by_role('button',name='Mark resolved',exact=True).click();expect(learner.get_by_text('resolved',exact=True)).to_be_visible();owner.reload();assert owner.get_by_role('button',name='Send reply',exact=True).count()==0;learner.get_by_role('button',name='Reopen question',exact=True).click();learner.get_by_role('dialog').get_by_role('button',name='Reopen question',exact=True).click();expect(learner.get_by_text('answered',exact=True)).to_be_visible();fits(learner,'student practical/question 320px '+theme);shot(learner,'support-320-'+theme+'.png');shot(owner,'owner-support-320-'+theme+'.png')
            learner.set_viewport_size({'width':1280,'height':1000});fits(learner,'support desktop '+theme);learner.set_viewport_size({'width':640,'height':1000});learner.evaluate("document.documentElement.style.zoom='2'");fits(learner,'support 200% '+theme);learner.evaluate("document.documentElement.style.zoom=''");learner.set_viewport_size({'width':320,'height':1000})
            learner.goto(harness.ORIGIN+'/student')
            learner.get_by_role('link',name='Continue learning',exact=True).first.click()
            expect(learner.get_by_role('heading',name='Synthetic video lesson',exact=True)).to_be_visible()
            learner.wait_for_function('document.querySelector("video")?.readyState>=2')
            position=learner.locator('video').evaluate('v=>v.currentTime')
            assert 11.8<=position<=12.3, f'Initial resume expected 12 seconds, got {position}; progress={s["progress"]}'
            harness.check(True,'saved video initially restores 12 seconds '+theme)
            learner.locator('video').evaluate('v=>v.currentTime=18')
            wait(learner,lambda:s['progress']['resume']['position']==18)
            harness.check(True,'seeking saves 18 seconds '+theme)
            learner.reload()
            learner.wait_for_function('document.querySelector("video")?.readyState>=2')
            position=learner.locator('video').evaluate('v=>v.currentTime')
            assert 17.8<=position<=18.3, f'Reload resume expected 18 seconds, got {position}; progress={s["progress"]}'
            assert s['progress']['completedLessons']==[], 'Resume must not award lesson completion'
            harness.check(True,'reload restores 18 seconds without completing the lesson '+theme)
            learner.get_by_role('button',name='Mark lesson complete',exact=True).click()
            expect(learner.get_by_text('1/2 lessons marked complete',exact=True)).to_be_visible()
            assert len(s['progress']['completedLessons'])==1
            fits(learner,'resumed private lesson 320px '+theme)
            shot(learner,'resume-320-'+theme+'.png')
            s['progress']['resume']['lesson']='deleted-fixture';learner.goto(harness.ORIGIN+'/student');expect(learner.get_by_role('heading',name='All courses',exact=True)).to_be_visible();assert learner.get_by_role('link',name='Continue learning',exact=True).count()==0;learner.goto(harness.ORIGIN+f'/courses/{CID}?lesson=deleted-fixture');expect(learner.get_by_role('heading',name='Synthetic text lesson',exact=True)).to_be_visible();assert len(s['progress']['completedLessons'])==1
            learner.goto(harness.ORIGIN+f'/courses/{CID}/support');s['expired']=True;learner.reload();expect(learner.get_by_role('heading',name='Welcome back',exact=True)).to_be_visible();assert 'support' in learner.url;learner.get_by_label('Email',exact=True).fill('fixture@example.invalid');learner.get_by_label('Password',exact=True).fill('synthetic-password-123');learner.get_by_role('button',name='Sign in',exact=True).click();expect(learner.get_by_text('Synthetic authored teacher reply',exact=True)).to_be_visible();s['denied']=True;learner.reload();expect(learner.get_by_role('alert')).to_contain_text('access was revoked');assert learner.get_by_text('Synthetic authored teacher reply',exact=True).count()==0
            admin=fixture('admin',theme,s);admin.goto(harness.ORIGIN+f'/instructor/courses/{CID}/support');expect(admin.get_by_role('button',name='Create practical task',exact=True)).to_be_visible();harness.check(True,'practical/request/reply retries, cancel/resolve/reopen, private owner/admin screens, saved video and honest progress, stale destinations/session/access '+theme)
        harness.check(not errors,'no runtime errors: '+str(errors));harness.check(not unexpected,'all requests isolated: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.close()
if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
