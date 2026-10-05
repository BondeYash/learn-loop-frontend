"""Visual/theme/accessibility regressions using synthetic API fixtures only.
No account or provider operations leave the local fixture server.
"""
from copy import deepcopy
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import CARD, DETAIL, COURSE_ID, CATEGORY_ID


def run_checks(browser, media, evidence):
    contexts,errors,unexpected=[],[],[]
    body='Owner-authored lesson: पढ़ाई जारी रखें. Course text stays unchanged.'
    def fixture(role=None,theme='light'):
        ctx=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block');contexts.append(ctx)
        ctx.add_init_script(f"if (!localStorage.getItem('lessonloop_theme')) localStorage.setItem('lessonloop_theme','{theme}')")
        page=ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        state={'calls':[],'list_error':False,'pending':False,'held':[],'course':{'_id':COURSE_ID,'title':CARD['title'],'slug':CARD['slug'],'description':'Owner-authored course description. No reference poster copy.','category':{'_id':CATEGORY_ID,'name':'Computer qualification'},'visibility':'private','price':0,'isPublished':True,'language':'Hindi','level':'beginner','requirements':[],'learningOutcomes':[],'instructor':{'_id':'teacher-fixture','name':'Fixture teacher'}},'progress':{'completedLessons':[],'percentage':0}}
        module={'_id':'module-fixture','title':'Learning module','lessons':[{'_id':'lesson-fixture','title':'Owner-authored lesson','contentType':'text','content':body}]}
        def route(r):
            req,u=r.request,urlparse(r.request.url)
            if u.netloc!='127.0.0.1:5186':unexpected.append(req.url);r.abort();return
            if not u.path.startswith('/api/'):r.continue_();return
            state['calls'].append((req.method,u.path))
            if harness.fulfill_optional_acquisition(r, u): return
            if u.path=='/api/auth/me':
                if role is None:r.fulfill(status=401,json={'message':'Sign in required'});return
                answer={'user':{'id':harness.STUDENT_ID,'name':'Fixture learner' if role=='student' else 'Fixture teacher' if role=='instructor' else 'Fixture admin','role':role,'email':'fixture@example.invalid','status':'active','mustChangePassword':False}}
            elif u.path=='/api/public/courses':answer={'courses':[CARD],'total':1,'page':1,'limit':12,'categories':[CARD['category']]}
            elif u.path.startswith('/api/public/courses/'):
                if u.path.endswith('/preview'):answer={'preview':{'title':'Text sample','contentType':'text','content':'Owner-authored public sample. पढ़ाई जारी रखें.'}}
                else:answer=deepcopy(DETAIL)
            elif u.path in ['/api/auth/login','/api/auth/forgot-password']:r.fulfill(status=503,json={'message':'Synthetic request interrupted. Retry safely.'});return
            elif u.path=='/api/categories':answer={'categories':[state['course']['category']]}
            elif u.path in ['/api/courses','/api/courses/mine']:
                if state['list_error']:r.fulfill(status=503,json={'message':'Synthetic catalog interruption'});return
                answer={'courses':[dict(state['course'],access={'assigned':True,'enrolled':True,'videos':True,'status':'active'},payment={'status':'free','required':False,'amountMinor':0})]}
            elif u.path in ['/api/courses/'+COURSE_ID,'/api/courses/mine/'+COURSE_ID]:answer={'course':state['course'],'modules':[module],'access':{'assigned':True,'enrolled':True,'videos':True}}
            elif harness.fulfill_learning_place(r, u): return
            elif u.path.endswith('/progress'):answer={'progress':state['progress']}
            elif u.path.endswith('/complete'):state['progress']={'completedLessons':['lesson-fixture'],'percentage':100};answer={'progress':state['progress']}
            elif u.path.endswith('/notes'):answer={'notes':[]}
            elif u.path.endswith('/assignments'):answer={'assignments':[]}
            elif u.path=='/api/admin/overview':answer={'students':1,'instructors':1,'courses':1,'published':1,'videos':0,'ready':0,'suspended':0}
            elif u.path=='/api/admin/users':answer={'users':[{'id':'teacher-fixture','name':'Fixture teacher','email':'teacher@example.invalid','role':'instructor','status':'active','createdAt':'2026-10-01T10:00:00Z'}],'page':1,'limit':20,'total':1}
            elif u.path=='/api/admin/courses':answer={'courses':[state['course']],'page':1,'limit':20,'total':1}
            elif u.path=='/api/admin/instructors':
                if state['pending']:state['held'].append(r);return
                r.fulfill(status=503,json={'message':'Synthetic provisioning interruption. Retry safely.'});return
            else:unexpected.append(req.url);r.fulfill(status=500,json={'message':'Unknown visual fixture'});return
            r.fulfill(json={'data':answer})
        ctx.route('**/*',route);return page,state
    def fits(page,label):harness.check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label)
    def screen(page,filename):page.screenshot(path=str(evidence/filename),full_page=True,animations='disabled')
    def zoom(page,label):
        page.set_viewport_size({'width':640,'height':1000});page.evaluate("document.documentElement.style.zoom='2'");fits(page,label+' at 200%');page.evaluate("document.documentElement.style.zoom=''")
    try:
        for theme in ['light','dark']:
            page,state=fixture(theme=theme);page.goto(harness.ORIGIN);expect(page.get_by_role('heading',name='Padhai, apne pace pe.')).to_be_visible();page.evaluate('document.fonts.ready')
            heading=page.locator('.study-hero h1');font=heading.evaluate('e=>getComputedStyle(e).fontFamily');harness.check('Baloo 2' in font,'display family is loaded: '+font)
            assert page.evaluate("document.fonts.check('800 40px \"Baloo 2\"','Padhai') && document.fonts.check('500 17px \"Plus Jakarta Sans\"','Course')")
            assert page.locator('.hero-cta').evaluate("e=>getComputedStyle(e).backgroundColor==='rgb(255, 227, 106)'"), 'Hero CTA must retain its accessible yellow fill in both themes'
            harness.check(page.locator('html').evaluate("e=>e.classList.contains('dark')")==(theme=='dark'),'theme verified '+theme)
            for width in [320,1440]:
                page.set_viewport_size({'width':width,'height':1000});fits(page,'home '+str(width)+'px '+theme);screen(page,'home-'+str(width)+'-'+theme+'.png')
            zoom(page,'home '+theme);page.set_viewport_size({'width':320,'height':1000})
            page.goto(harness.ORIGIN+'/login');expect(page.get_by_role('heading',name='Welcome back')).to_be_visible();fits(page,'login 320px '+theme);screen(page,'login-320-'+theme+'.png')
            page.get_by_label('Email',exact=True).fill('fixture@example.invalid');page.get_by_label('Password',exact=True).fill('fixture-password-123');page.get_by_role('button',name='Sign in',exact=True).click();expect(page.get_by_role('alert')).to_contain_text('Retry safely')
            page.set_viewport_size({'width':1440,'height':1000});screen(page,'login-1440-'+theme+'.png');zoom(page,'login '+theme)
            page.goto(harness.ORIGIN+'/register');page.set_viewport_size({'width':320,'height':1000});fits(page,'signup 320px '+theme);screen(page,'signup-320-'+theme+'.png')
            page.goto(harness.ORIGIN+'/catalog/'+CARD['slug']);expect(page.get_by_role('heading',name='About this course')).to_be_visible();page.get_by_role('button',name='Open sample lesson').click();expect(page.get_by_text('Owner-authored public sample. पढ़ाई जारी रखें.',exact=True)).to_be_visible();fits(page,'public details/sample 320px '+theme)
            assert page.evaluate("document.fonts.check('500 17px \"Noto Sans Devanagari\"','पढ़ाई')")
            for role,path in [('student','/student'),('instructor','/instructor/courses'),('admin','/admin')]:
                rolepage,rstate=fixture(role,theme);rolepage.goto(harness.ORIGIN+path)
                expect(rolepage.get_by_role('heading',name='Aaj kya padhein, Fixture?' if role=='student' else 'My courses' if role=='instructor' else 'Har lesson ke peechhe, aap.')).to_be_visible()
                for width in [320,1440]:
                    rolepage.set_viewport_size({'width':width,'height':1000});fits(rolepage,role+' '+str(width)+'px '+theme);screen(rolepage,role+'-'+str(width)+'-'+theme+'.png')
                zoom(rolepage,role+' '+theme)
                if role=='student':
                    rolepage.goto(harness.ORIGIN+'/courses/'+COURSE_ID);rolepage.set_viewport_size({'width':320,'height':1000});expect(rolepage.get_by_text(body,exact=True)).to_be_visible();fits(rolepage,'calm lesson 320px '+theme);screen(rolepage,'lesson-320-'+theme+'.png')
                    assert rolepage.locator('.course-content-panel h2').evaluate("e=>getComputedStyle(e).fontFamily.includes('Plus Jakarta Sans')")
                    rolepage.get_by_role('button',name='Mark lesson complete',exact=True).click();expect(rolepage.get_by_role('button',name='Lesson completed',exact=True)).to_be_disabled();expect(rolepage.get_by_role('progressbar',name='Course completion')).to_have_attribute('value','100')
                    rolepage.emulate_media(reduced_motion='reduce');assert rolepage.evaluate("getComputedStyle(document.documentElement).scrollBehavior==='auto'");rolepage.get_by_role('button',name='Review course',exact=True).click();expect(rolepage.locator('.course-content-panel')).to_be_focused()
                elif role=='instructor':
                    rolepage.goto(harness.ORIGIN+'/instructor/courses/'+COURSE_ID+'/edit');rolepage.set_viewport_size({'width':320,'height':1000});fits(rolepage,'owner form 320px '+theme);screen(rolepage,'owner-form-320-'+theme+'.png')
                    rolepage.get_by_label('Course title',exact=True).fill('Unsaved fixture title');rolepage.get_by_role('link',name='Cancel',exact=True).click();dialog=rolepage.get_by_role('dialog',name='Discard unsaved changes?');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Cancel',exact=True).click();expect(rolepage.get_by_label('Course title',exact=True)).to_have_value('Unsaved fixture title');rolepage.get_by_role('link',name='Cancel',exact=True).click();rolepage.go_back();expect(dialog).not_to_be_visible()
                else:
                    rolepage.set_viewport_size({'width':320,'height':1000});rolepage.get_by_role('button',name='Create instructor',exact=True).click();dialog=rolepage.get_by_role('dialog',name='Create an instructor');expect(dialog).to_be_visible()
                    for _ in range(7):rolepage.keyboard.press('Tab');assert rolepage.evaluate("Boolean(document.activeElement.closest('dialog'))")
                    rolepage.keyboard.press('Escape');expect(dialog).not_to_be_visible();rolepage.get_by_role('button',name='Create instructor',exact=True).click()
                    dialog.get_by_label('Full name',exact=True).fill('Synthetic teacher');dialog.get_by_label('Email address',exact=True).fill('teacher@example.invalid');dialog.get_by_label('Temporary password',exact=True).fill('temporary-password-123');rstate['pending']=True;dialog.get_by_role('button',name='Create instructor',exact=True).click();expect(dialog.get_by_role('button',name='Saving…',exact=True)).to_be_disabled();rolepage.keyboard.press('Escape');expect(dialog).to_be_visible();assert len(rstate['held'])==1
                    rstate['held'].pop().fulfill(status=503,json={'message':'Synthetic provisioning interruption. Retry safely.'});rstate['pending']=False;expect(dialog.get_by_role('alert')).to_contain_text('Retry safely');fits(rolepage,'interrupted admin dialog '+theme);screen(rolepage,'admin-dialog-320-'+theme+'.png');dialog.get_by_role('button',name='Cancel',exact=True).click()
                    rolepage.emulate_media(forced_colors='active');select=rolepage.get_by_role('combobox',name='Filter role',exact=True);expect(select).to_be_visible();assert select.evaluate("e=>getComputedStyle(e).appearance==='auto' && getComputedStyle(e).backgroundImage==='none'")
            # Logo remains a clear vector mark at small sizes in both themes.
            for size in [16,24,32]:
                page.locator('.brand-mark').first.evaluate('(e,n)=>{e.style.width=n+"px";e.style.height=n+"px"}',size);assert page.locator('.brand-mark').first.locator('path').count()==2
            page.emulate_media(reduced_motion='reduce');page.goto(harness.ORIGIN);assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior==='auto'")
        harness.check(not errors,'no JavaScript errors: '+str(errors));harness.check(not unexpected,'all requests stay local: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.close()

if __name__=='__main__':
    harness.run_checks=run_checks
    harness.main()
