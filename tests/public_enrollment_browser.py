"""Public enrollment/auth/history and shared native-select regressions.
All API/payment traffic is synthetic and external requests are blocked.
"""
from copy import deepcopy
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import CARD, DETAIL, COURSE_ID, CATEGORY_ID


def run_checks(browser, media, evidence):
    contexts, errors, unexpected = [], [], []
    def fixture(theme="light", width=320, paid=False, role=None):
        context=browser.new_context(viewport={"width":width,"height":900},service_workers="block");contexts.append(context)
        context.add_init_script(f"if (!localStorage.getItem('lessonloop_theme')) localStorage.setItem('lessonloop_theme','{theme}')")
        page=context.new_page();page.on("pageerror",lambda error:errors.append(str(error)))
        state={"role":role,"enrolled":False,"paid":False,"status":"pending","enrolls":0,"checkouts":0,"held":[],"hold":False,"private":False,"history_error":False,"hold_instructors":False,"instructor_requests":[]}
        detail=deepcopy(DETAIL);detail['course']['amountMinor']=12050 if paid else 0
        course={"_id":COURSE_ID,"slug":CARD['slug'],"title":CARD['title'],"description":"Synthetic public course","price":120.5 if paid else 0,"visibility":"public","isPublished":True,"language":"Hindi","category":{"_id":CATEGORY_ID,"name":"Computer qualification"}}
        order={"id":"record-fixture","courseId":COURSE_ID,"title":CARD['title'],"amountMinor":12050,"status":"pending","currency":"inr","testMode":True,"createdAt":"2026-10-01T10:00:00Z"}
        user=lambda:{"id":harness.STUDENT_ID,"name":"Fixture learner","email":"student@fixture.invalid","role":state['role'],"status":"active"}
        def route(r):
            req,u=r.request,urlparse(r.request.url)
            if u.hostname=='checkout.stripe.com':r.fulfill(content_type='text/html',body='<h1>Synthetic Stripe checkout</h1>');return
            if u.netloc!='127.0.0.1:5186':unexpected.append(req.url);r.abort();return
            if not u.path.startswith('/api/'):r.continue_();return
            if harness.fulfill_optional_acquisition(r, u): return
            if u.path=='/api/auth/me':
                if not state['role']:r.fulfill(status=401,json={'message':'Sign in required'});return
                answer={'user':user()}
            elif u.path in ['/api/auth/login','/api/auth/register']:
                state['role']='student';answer={'user':user()}
            elif u.path=='/api/public/courses':answer={'courses':[detail['course']],'categories':[CARD['category']],'page':1,'limit':12,'total':1}
            elif u.path.startswith('/api/public/courses/'):answer=detail
            elif u.path=='/api/admin/overview':answer={'students':1,'instructors':2,'courses':1,'published':1,'videos':0,'ready':0,'suspended':0}
            elif u.path=='/api/admin/courses':answer={'courses':[dict(course,instructor={'_id':'teacher-one','name':'First teacher'})],'page':1,'limit':20,'total':1}
            elif u.path=='/api/admin/users':
                answer={'users':[{'id':'teacher-one','name':'Long instructor label for government examination preparation','email':'long-teaching-name@fixture.invalid','role':'instructor','status':'active'},{'id':'teacher-two','name':'Second teacher','email':'second@fixture.invalid','role':'instructor','status':'active'}],'page':1,'limit':100,'total':2}
                if state['hold_instructors']:state['instructor_requests'].append((r,answer));return
            elif u.path=='/api/categories':answer={'categories':[course['category']]}
            elif u.path=='/api/payments/courses/'+COURSE_ID+'/quote':
                answer={'quote':{'courseId':COURSE_ID,'title':CARD['title'],'amountMinor':12050 if paid else 0,'currency':'inr','testMode':True,'paid':state['paid'],'requiresPayment':paid and not state['paid'],'enrollmentType':'public','enrolled':state['enrolled'],'enrollmentRequired':not state['enrolled']},'readiness':{'configured':paid,'testMode':True}}
            elif u.path=='/api/courses/'+COURSE_ID+'/enroll':
                assert req.method=='POST' and req.post_data_json=={'quotedAmountMinor':12050 if paid else 0};state['enrolls']+=1
                if state['hold']:state['held'].append(r);return
                state['enrolled']=True;answer={'access':True,'courseId':COURSE_ID}
            elif u.path=='/api/payments/checkout':
                state['checkouts']+=1;assert req.post_data_json=={'courseId':COURSE_ID,'quotedAmountMinor':12050};assert req.headers['idempotency-key'];answer={'order':order,'url':'https://checkout.stripe.com/c/pay/cs_test_fixture'}
            elif u.path=='/api/payments/orders':
                if state['history_error']:r.fulfill(status=503,json={'message':'Synthetic history unavailable'});return
                answer={'orders':[dict(order,status=state['status'])],'page':1,'limit':20,'total':1,'testMode':True}
            elif u.path.startswith('/api/payments/orders/record-fixture'):
                answer={'order':dict(order,status=state['status'],canAccess=state['paid'] and state['enrolled'] and not state['private'])}
            elif u.path=='/api/courses/'+COURSE_ID:
                c=dict(course,visibility='private' if state['private'] else 'public')
                answer={'course':c,'access':{'assigned':False,'enrolled':state['enrolled'],'videos':state['enrolled'] and not state['private']},'modules':[{'_id':'module-fixture','title':'Lessons','lessons':[{'_id':'lesson-fixture','title':'Learning lesson','contentType':'text',**({'content':'Learning content after enrollment'} if state['enrolled'] and not state['private'] else {'locked':True})}]}]}
            elif harness.fulfill_learning_place(r, u): return
            elif u.path.endswith('/progress'):answer={'progress':{'completedLessons':[],'percentage':0}}
            elif u.path.endswith('/notes'):answer={'notes':[]}
            elif u.path=='/api/courses':answer={'courses':[course]}
            elif u.path=='/api/courses/mine/'+COURSE_ID:answer={'course':course,'modules':[]}
            else:unexpected.append(req.url);r.fulfill(status=500,json={'message':'Unknown fixture'});return
            r.fulfill(json={'data':answer})
        context.route('**/*',route);return page,state
    def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
    try:
        for theme in ['light','dark']:
            page,state=fixture(theme=theme)
            page.goto(harness.ORIGIN+'/catalog/'+CARD['slug']);expect(page.get_by_role('link',name='Sign in to enroll')).to_be_visible()
            page.get_by_role('link',name='Sign in to enroll').click();expect(page.get_by_role('heading',name='Welcome back')).to_be_visible()
            page.get_by_role('link',name='Create account',exact=True).click();assert parse_qs(urlparse(page.url).query)['returnTo']==['/catalog/'+CARD['slug']]
            page.reload();page.get_by_label('Name',exact=True).fill('Fixture learner');page.get_by_label('Email',exact=True).fill('student@fixture.invalid');page.get_by_label('Password',exact=True).fill('fixture-password-123');page.get_by_label('Confirm password',exact=True).fill('fixture-password-123');page.get_by_role('button',name='Create account',exact=True).click()
            expect(page.get_by_role('button',name='Enroll for free')).to_be_visible();assert state['enrolls']==0 and state['checkouts']==0
            state['hold']=True;page.get_by_role('button',name='Enroll for free').click();expect(page.get_by_role('button',name='Enrolling…')).to_be_disabled();page.get_by_role('button',name='Enrolling…').evaluate('e=>{e.click();e.click()}');assert state['enrolls']==1
            state['enrolled']=True;state['held'].pop().fulfill(json={'data':{'access':True}});page.wait_for_url('**/courses/'+COURSE_ID);expect(page.get_by_text('Learning content after enrollment')).to_be_visible();fits(page,'free enrollment lessons fit 320px '+theme)
            page.screenshot(path=str(evidence/('public-free-'+theme+'.png')),full_page=True)
            page.goto(harness.ORIGIN+'/catalog');category=page.get_by_label('Category',exact=True);expect(category).to_be_visible()
            for width in [320,1280]:
                page.set_viewport_size({'width':width,'height':900});fits(page,'catalog select fits '+str(width)+'px '+theme)
                css=category.evaluate('e=>({appearance:getComputedStyle(e).appearance,padding:getComputedStyle(e).paddingRight,image:getComputedStyle(e).backgroundImage,position:getComputedStyle(e).backgroundPosition})')
                assert css['appearance']=='none' and float(css['padding'].replace('px',''))>=40 and css['image']!='none' and '17px' in css['position'],css
                category.focus();expect(category).to_be_focused();category.press('ArrowDown');category.press('Enter');expect(category).to_have_value(CATEGORY_ID)
                page.screenshot(path=str(evidence/('select-'+str(width)+'-'+theme+'.png')),full_page=True)
            page.set_viewport_size({'width':640,'height':900});page.evaluate("document.documentElement.style.zoom='2'");fits(page,'catalog select at 200% '+theme);page.evaluate("document.documentElement.style.zoom=''")
            owner,os=fixture(theme=theme,width=320,role='instructor');owner.goto(harness.ORIGIN+'/instructor/courses/'+COURSE_ID+'/edit');selects=owner.locator('select.input-field');expect(selects).to_have_count(3)  # Category, level and public sample; language is a text input.
            for select in selects.all():assert select.evaluate("e=>getComputedStyle(e).backgroundImage!=='none' && getComputedStyle(e).appearance==='none'")
            fits(owner,'owner form selects fit 320px '+theme)
            # Verify the actual admin transfer dialog while loading, with long labels and keyboard use.
            admin,astate=fixture(theme=theme,width=320,role='admin');admin.goto(harness.ORIGIN+'/admin?tab=courses');expect(admin.get_by_role('button',name='Change instructor',exact=True)).to_be_visible()
            astate['hold_instructors']=True;admin.get_by_role('button',name='Change instructor',exact=True).click();dialog=admin.get_by_role('dialog');sel=dialog.get_by_role('combobox',name='New instructor',exact=True);expect(sel).to_be_disabled()
            admin.wait_for_function("document.querySelector('select[name=instructorId]')?.disabled === true");admin.wait_for_timeout(300)
            assert astate['instructor_requests'];astate['hold_instructors']=False
            for request,answer in astate['instructor_requests']:request.fulfill(json={'data':answer})
            expect(sel).to_be_enabled();sel.select_option('teacher-one');sel.focus();sel.press('ArrowDown');sel.press('Enter');expect(sel).to_have_value('teacher-two');expect(sel).to_be_focused()
            assert sel.evaluate("e=>getComputedStyle(e).backgroundImage!=='none' && getComputedStyle(e).appearance==='none'");fits(admin,'actual admin transfer dialog fits 320px '+theme)
            admin.screenshot(path=str(evidence/('select-admin-dialog-'+theme+'.png')),full_page=True)
            admin.emulate_media(forced_colors='active');assert sel.evaluate("e=>getComputedStyle(e).appearance==='auto' && getComputedStyle(e).backgroundImage==='none'")
            harness.check(page.locator('html').evaluate("e=>e.classList.contains('dark')")==(theme=='dark'),'active theme verified '+theme)
        login,lstate=fixture();login.goto(harness.ORIGIN+'/login?returnTo=%2Fcatalog%2F'+CARD['slug']);login.get_by_label('Email',exact=True).fill('student@fixture.invalid');login.get_by_label('Password',exact=True).fill('fixture-password-123');login.get_by_role('button',name='Sign in',exact=True).click();expect(login.get_by_role('button',name='Enroll for free')).to_be_visible();assert lstate['enrolls']==0
        harness.check(True,'login retains selected public course without automatic enrollment')
        page,state=fixture(paid=True,role='student');page.goto(harness.ORIGIN+'/catalog/'+CARD['slug']);expect(page.get_by_role('button',name='Continue to test checkout')).to_be_visible();page.get_by_role('button',name='Continue to test checkout').click();page.wait_for_url('https://checkout.stripe.com/**');assert state['enrolls']==0 and state['checkouts']==1
        page.goto(harness.ORIGIN+'/payments/record-fixture?checkout=success');expect(page.get_by_role('heading',name='Awaiting payment verification')).to_be_visible();assert page.get_by_role('link',name='Open course',exact=True).count()==0
        state.update(paid=True,enrolled=True,status='paid');page.get_by_role('button',name='Check payment status').click();expect(page.get_by_role('link',name='Open course',exact=True)).to_be_visible();expect(page.get_by_text('record-fixture',exact=True)).to_be_visible();page.get_by_role('link',name='Open course',exact=True).click();expect(page.get_by_text('Learning content after enrollment')).to_be_visible()
        page.goto(harness.ORIGIN+'/payments');expect(page.get_by_role('heading',name='Payment history')).to_be_visible();expect(page.get_by_role('link',name='View payment record')).to_be_visible();fits(page,'payment history fits 320px');page.get_by_role('link',name='View payment record').click()
        for status in ['refunded','partially_refunded','disputed','failed','expired']:
            state.update(paid=False,status=status);page.get_by_role('button',name='Check payment status').click();expect(page.get_by_role('link',name='Back to course',exact=True)).to_be_visible();assert not page.get_by_role('link',name='Open course',exact=True).count()
        state.update(paid=True,status='paid',private=True);page.get_by_role('button',name='Check payment status').click();expect(page.get_by_text('Payment is verified. Check the course for current enrollment and availability.')).to_be_visible();page.get_by_role('link',name='Back to course',exact=True).click();expect(page.get_by_text('has not given your account access',exact=False)).to_be_visible();assert not page.get_by_text('Learning content after enrollment').count()
        state['history_error']=True;page.goto(harness.ORIGIN+'/payments');expect(page.get_by_role('alert')).to_contain_text('Synthetic history unavailable');state['history_error']=False;page.get_by_role('button',name='Retry history').click();expect(page.get_by_role('link',name='View payment record')).to_be_visible()
        harness.check(not errors,'no runtime errors: '+str(errors));harness.check(not unexpected,'all requests isolated: '+str(unexpected))
    finally:
        for context in contexts:context.close()

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
