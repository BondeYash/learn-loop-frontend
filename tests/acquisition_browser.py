"""Real Chrome checks, synthetic intercepted APIs only; no production writes."""
import copy
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import DETAIL, COURSE_ID as CID

def run_checks(browser, media, evidence):
    contexts, errors, unexpected = [], [], []
    def fixture(role, theme, enabled=True, gpc=False, storage_blocked=False):
        ctx=browser.new_context(viewport={'width':320,'height':1000},service_workers='block');contexts.append(ctx)
        ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}');Object.defineProperty(navigator,'globalPrivacyControl',{{value:{str(gpc).lower()}}});")
        if storage_blocked:ctx.add_init_script("Storage.prototype.setItem = () => { throw new Error('Synthetic disabled storage') }")
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        s={'config':{'measurementEnabled':enabled,'interestEnabled':enabled,'policyUrl':'https://example.invalid/privacy' if enabled else '', 'retentionDays':90,'version':1 if enabled else 0},'sources':[],'interests':[],'visits':{},'calls':[],'drop_visit':True,'drop_interest':True,'drop_source':True,'erase_fail':True,'hold_interest':False,'held':[],'enrolled':False}
        user={'id':harness.STUDENT_ID,'name':'Synthetic learner' if role=='student' else 'Synthetic owner','role':role,'mustChangePassword':False}
        detail=copy.deepcopy(DETAIL);detail['course']['amountMinor']=0;detail['course']['policies']={'privacy':'https://example.invalid/privacy'}
        def report():
            z={'visits':0,'freeEnrollments':0,'livePaidEnrollments':0,'paidOrders':0,'partialRefunds':0,'fullRefunds':0,'disputes':0,'reversals':0,'receiptsMinor':0}
            rows=[dict(src,**z) for src in s['sources']]+[dict(z,id='unknown',label='Unknown / unattributed',channel='unknown')]
            totals=dict(z,visits=len(s['visits']),freeEnrollments=int(s['enrolled']))
            return {'totals':totals,'rows':rows,'interest':{'pending':sum(i['status']=='pending' for i in s['interests']),'contacted':sum(i['status']=='contacted' for i in s['interests']),'closed':sum(i['status']=='closed' for i in s['interests'])},'generatedAt':'2026-10-05T10:00:00Z','definitions':{'visits':'Consented page views, not unique people.','receipts':'Verified live records, recorded refunds deducted; disputes and reversals excluded.','attribution':'Client labels; no verified causality; retained choices expire.'}}
        def route(r):
            req=r.request;u=urlparse(req.url)
            if f'{u.scheme}://{u.netloc}'!=harness.ORIGIN:unexpected.append(req.url);r.abort();return
            if not u.path.startswith('/api/'):r.continue_();return
            path=u.path[4:];body=req.post_data_json if req.post_data else {};s['calls'].append((req.method,path,body));out=None
            if path=='/auth/me':out={'user':user}
            elif path=='/public/courses':out={'courses':[detail['course']],'total':1,'page':1,'limit':12,'categories':[detail['course']['category']]}
            elif path.startswith('/public/courses/'):
                if path.endswith('/acquisition'):out=s['config']
                elif path.endswith('/visits'):
                    s['visits'][body['requestId']]=body
                    if s['drop_visit']:s['drop_visit']=False;r.fulfill(status=503,json={'message':'Synthetic optional view response interrupted.'});return
                    out={'accepted':True}
                elif path.endswith('/interest'):
                    if s['hold_interest']:s['held'].append(r);return
                    if not any(i['requestId']==body['requestId'] for i in s['interests']):s['interests'].insert(0,dict(body,id='interest-'+str(len(s['interests'])),status='pending',version=1,createdAt='2026-10-05T10:00:00Z',expiresAt='2027-01-03T10:00:00Z',marketingConsentAt=None))
                    if s['drop_interest']:s['drop_interest']=False;r.fulfill(status=503,json={'message':'Synthetic interest response interrupted. Retry safely.'});return
                    out={'accepted':True}
                elif path.endswith('/preview'):out={'preview':{'title':'Text sample','contentType':'text','content':'Independent sample without signup, analytics or email.'}}
                else:out=detail
            elif path.startswith(f'/courses/{CID}/acquisition/'):
                part=path.split('/acquisition/')[1]
                if part=='config':
                    if req.method=='PUT':s['config'].update(measurementEnabled=body['measurementEnabled'],interestEnabled=body['interestEnabled'],version=s['config']['version']+1)
                    out={'config':s['config'],'course':{'id':CID,'title':detail['course']['title'],'slug':detail['course']['slug']}}
                elif part=='sources':
                    if req.method=='POST':
                        if not any(i['requestId']==body['requestId'] for i in s['sources']):s['sources'].append(dict(body,id='source-fixture',code='abcdef123456',active=True,version=1))
                        if s['drop_source']:s['drop_source']=False;r.fulfill(status=503,json={'message':'Synthetic source response interrupted.'});return
                    out={'sources':s['sources']}
                elif part.startswith('sources/'):
                    src=s['sources'][0];src.update(active=body['active'],version=src['version']+1);out={'source':src}
                elif part=='report':out=report()
                elif part=='interest':
                    p=int(parse_qs(u.query).get('page',['1'])[0]);out={'requests':s['interests'][(p-1)*20:p*20],'total':len(s['interests']),'page':p,'limit':20}
                elif part.startswith('interest/'):
                    item=next(i for i in s['interests'] if i['id']==part.split('/')[1])
                    if req.method=='DELETE':s['interests'].remove(item);out={'erased':True}
                    else:item.update(status=body['status'],version=item['version']+1);out={'request':item}
                elif part=='choice':
                    if s['erase_fail']:s['erase_fail']=False;r.fulfill(status=503,json={'message':'Synthetic removal interrupted.'});return
                    out={'erased':True}
            elif path==f'/payments/courses/{CID}/quote':out={'quote':{'courseId':CID,'title':detail['course']['title'],'amountMinor':0,'currency':'inr','testMode':True,'requiresPayment':False,'enrollmentType':'public','enrollmentRequired':not s['enrolled']},'readiness':{'configured':True,'testMode':True}}
            elif path==f'/courses/{CID}/enroll':s['enrolled']=True;out={'access':True}
            elif path==f'/courses/{CID}':out={'course':{'_id':CID,'title':detail['course']['title'],'description':'Fixture','isPublished':True},'modules':[],'access':{'videos':True}}
            elif path.endswith('/notes'):out={'notes':[]}
            elif path.endswith('/progress'):out={'progress':{'completedLessons':[],'completedCount':0,'totalLessons':0,'percentage':0,'resume':None,'resumeRevision':0}}
            elif path=='/courses':out={'courses':[]}
            if out is None:unexpected.append(req.url);r.fulfill(status=500,json={'message':'Unknown acquisition fixture'});return
            r.fulfill(json={'data':out})
        ctx.route('**/*',route);return page,s
    def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
    try:
        for theme in ['light','dark']:
            page,s=fixture('student',theme);page.goto(harness.ORIGIN+'/catalog/synthetic-ccc?source=abcdef123456&ignored=raw-private-query')
            opt=page.get_by_role('checkbox',name='Optional: count this page view and save the source of my enrollment for this course.',exact=True)
            expect(opt).not_to_be_checked();assert not s['visits'];assert not s['interests']
            page.get_by_role('button',name='Open sample lesson',exact=True).click();expect(page.get_by_text('Independent sample without signup, analytics or email.',exact=True)).to_be_visible();assert not s['visits']
            opt.check();expect(page.get_by_text('Synthetic optional view response interrupted.',exact=True)).to_be_visible();page.get_by_role('button',name='Retry optional measurement',exact=True).click();expect(page.get_by_text('Optional measurement is enabled for this course in this tab for up to 24 hours.',exact=True)).to_be_visible();assert len(s['visits'])==1
            views=[b for m,p,b in s['calls'] if p.endswith('/visits')];assert len(views)==2 and views[0]['requestId']==views[1]['requestId'];assert set(views[0])=={'consent','sourceCode','requestId'};assert 'raw-private-query' not in page.evaluate('JSON.stringify(sessionStorage)')
            page.get_by_role('button',name='Request course information or a demo',exact=True).click();marketing=page.get_by_role('checkbox',name='Optional: I also agree to ongoing course marketing emails from this team.',exact=True);expect(marketing).not_to_be_checked();expect(page.get_by_label('Your email',exact=True)).to_have_value('')
            page.get_by_label('Your email',exact=True).fill('synthetic@example.invalid');page.get_by_role('button',name='Cancel',exact=True).click();dialog=page.get_by_role('dialog',name='Discard unsent interest request?');expect(dialog).to_be_visible();page.keyboard.press('Escape');expect(dialog).not_to_be_visible();expect(page.get_by_label('Your email',exact=True)).to_have_value('synthetic@example.invalid')
            page.get_by_role('checkbox',name='I allow the course team to use my email to respond to this request.',exact=True).check();page.get_by_role('button',name='Save interest request',exact=True).click();expect(page.get_by_role('alert')).to_contain_text('response interrupted');expect(page.get_by_label('Your email',exact=True)).to_have_value('synthetic@example.invalid');expect(marketing).not_to_be_checked();page.get_by_role('button',name='Save interest request',exact=True).click();expect(page.get_by_text('Your request is saved for the course team.',exact=False)).to_be_visible();assert len(s['interests'])==1 and s['interests'][0]['marketingConsent'] is False
            requests=[b for m,p,b in s['calls'] if p.endswith('/interest') and m=='POST'];assert requests[0]['requestId']==requests[1]['requestId'];assert 'synthetic@example.invalid' not in page.locator('body').inner_text();assert not s['enrolled'];fits(page,'public acquisition 320px '+theme);page.screenshot(path=str(evidence/f'acquisition-public-320-{theme}.png'),full_page=True)
            page.reload();expect(opt).to_be_checked();assert page.evaluate("JSON.parse(sessionStorage.getItem('lessonloop_source_'+"+repr(CID)+")).sourceCode")=='abcdef123456'
            opt.uncheck();expect(page.get_by_role('button',name='Retry removing saved source',exact=True)).to_be_visible();page.get_by_role('button',name='Retry removing saved source',exact=True).click();expect(page.get_by_role('button',name='Retry removing saved source',exact=True)).not_to_be_visible();assert page.evaluate('sessionStorage.length')==0
            opt.check();page.get_by_role('button',name='Enroll for free',exact=True).click();page.wait_for_url('**/courses/'+CID);enroll=[b for m,p,b in s['calls'] if p.endswith('/enroll')][0];assert enroll['attribution']=={'consent':True,'sourceCode':'abcdef123456'};assert s['enrolled']
            owner,state=fixture('instructor',theme,False);owner.goto(harness.ORIGIN+f'/instructor/courses/{CID}/acquisition');expect(owner.get_by_text('No retained interest requests.',exact=True)).to_be_visible();expect(owner.get_by_text('Unknown / unattributed',exact=True)).to_be_visible();expect(owner.get_by_role('checkbox',name='Offer optional visit and enrollment source measurement',exact=True)).to_be_disabled();assert state['config']['measurementEnabled'] is False
            state['config']['policyUrl']='https://example.invalid/privacy';owner.get_by_role('button',name='Refresh report and settings',exact=True).click();expect(owner.get_by_role('checkbox',name='Offer optional visit and enrollment source measurement',exact=True)).to_be_enabled();owner.get_by_role('checkbox',name='Offer optional visit and enrollment source measurement',exact=True).check();expect(owner.get_by_role('button',name='Save collection settings',exact=True)).to_be_disabled();owner.get_by_role('checkbox',name='I reviewed this notice for these purposes, access, retention and optional marketing consent.',exact=True).check();owner.get_by_role('button',name='Save collection settings',exact=True).click();expect(owner.get_by_text('Collection settings saved.',exact=True)).to_be_visible()
            owner.get_by_label('Generic campaign label',exact=True).fill('generic-course');owner.get_by_role('button',name='Create source link',exact=True).click();expect(owner.get_by_role('alert')).to_contain_text('source response interrupted');owner.get_by_role('button',name='Create source link',exact=True).click();expect(owner.get_by_label('Copyable source URL',exact=True)).to_have_value(harness.ORIGIN+'/catalog/synthetic-ccc?source=abcdef123456');assert len(state['sources'])==1;ids=[b['requestId'] for m,p,b in state['calls'] if p.endswith('/sources') and m=='POST'];assert len(set(ids))==1
            owner.get_by_role('button',name='Deactivate source',exact=True).click();expect(owner.get_by_role('button',name='Reactivate source',exact=True)).to_be_visible();state['interests']=[dict(s['interests'][0],id='contact-'+str(i)) for i in range(21)];owner.get_by_role('button',name='Refresh report and settings',exact=True).click();expect(owner.get_by_role('heading',name='synthetic@example.invalid',exact=True)).to_have_count(20);owner.get_by_role('button',name='Next requests',exact=True).click();expect(owner.get_by_role('heading',name='synthetic@example.invalid',exact=True)).to_have_count(1)
            owner.get_by_label('Request status',exact=True).select_option('contacted');expect(owner.get_by_text('Request status saved. No message was sent.',exact=True)).to_be_visible();assert sum(i['status']=='contacted' for i in state['interests'])==1
            owner.get_by_role('button',name='Erase request',exact=True).click();dialog=owner.get_by_role('dialog',name='Erase this contact request?');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Erase request',exact=True).click();expect(owner.get_by_text('Contact request erased.',exact=True)).to_be_visible();assert len(state['interests'])==20
            fits(owner,'private owner acquisition 320px '+theme);owner.screenshot(path=str(evidence/f'acquisition-owner-320-{theme}.png'),full_page=True);owner.set_viewport_size({'width':1280,'height':1000});fits(owner,'owner desktop '+theme);owner.set_viewport_size({'width':640,'height':1000});owner.evaluate("document.documentElement.style.zoom='2'");fits(owner,'owner 200% '+theme)
            interrupted,st=fixture('student',theme);interrupted.goto(harness.ORIGIN+'/catalog/synthetic-ccc');interrupted.get_by_role('button',name='Request course information or a demo',exact=True).click();interrupted.get_by_label('Your email',exact=True).fill('synthetic@example.invalid');interrupted.get_by_role('checkbox',name='I allow the course team to use my email to respond to this request.',exact=True).check();st['hold_interest']=True;interrupted.get_by_role('button',name='Save interest request',exact=True).click();expect(interrupted.get_by_role('button',name='Saving request…',exact=True)).to_be_disabled();interrupted.get_by_role('link',name='← Browse courses',exact=True).click();interrupted.wait_for_url('**/catalog')
            for r in st['held']:
                try:r.fulfill(json={'data':{'accepted':True}})
                except Exception:pass
            expect(interrupted.get_by_text('Your request is saved for the course team.',exact=False)).not_to_be_visible();assert not st['interests']
        gpc,st=fixture('student','light',gpc=True);gpc.goto(harness.ORIGIN+'/catalog/synthetic-ccc');expect(gpc.get_by_role('button',name='Request course information or a demo',exact=True)).to_be_visible();assert gpc.get_by_role('checkbox',name='Optional: count this page view',exact=False).count()==0;assert not st['visits']
        blocked,st=fixture('student','light',storage_blocked=True);blocked.goto(harness.ORIGIN+'/catalog/synthetic-ccc');blocked.get_by_role('checkbox',name='Optional: count this page view',exact=False).click();expect(blocked.get_by_text('Optional measurement could not be enabled because tab storage is unavailable.',exact=True)).to_be_visible();assert not st['visits']
        off,st=fixture('student','dark',enabled=False);off.goto(harness.ORIGIN+'/catalog/synthetic-ccc');expect(off.get_by_role('heading',name='About this course',exact=True)).to_be_visible();assert off.get_by_role('region',name='Optional course choices',exact=True).count()==0;assert not st['visits'] and not st['interests']
        harness.check(not unexpected,f'All requests isolated; unexpected: {unexpected}');harness.check(not errors,f'No browser runtime errors: {errors}')
    finally:
        for ctx in contexts:ctx.close()

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
