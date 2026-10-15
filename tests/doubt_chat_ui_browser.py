"""Student chat navigation, rich answers, keyboard/scroll behavior and mobile layout.
All accounts, history, PDFs and AI replies are isolated local fixtures.
"""
from copy import deepcopy
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness

CID='507f1f77bcf86cd799439024'
SECOND='507f1f77bcf86cd799439025'
MARKDOWN='''## RAM aur ROM

**RAM** stores temporary information. ROM retains its contents.

| Memory | Volatile? | Purpose |
| --- | --- | --- |
| RAM | Yes | Current work |
| ROM | No | Startup instructions |

- First, identify the memory type.
- Then compare its purpose.

```text
A very long example code line that should scroll inside its own block: '''+'x'*180+'''
```

[Untrusted generated link](https://untrusted.invalid/visit)
![Untrusted image](https://untrusted.invalid/image.png)
<script>window.UNSAFE_EXECUTED=true</script>
'''

def run_checks(browser,media,evidence):
    contexts=[];errors=[];unexpected=[]
    def fixture(theme='light'):
        ctx=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block',permissions=['clipboard-read','clipboard-write']);contexts.append(ctx)
        ctx.add_init_script(f"localStorage.setItem('lessonloop_theme','{theme}')")
        page=ctx.new_page();page.clock.install();page.on('pageerror',lambda e:errors.append(str(e)))
        courses=[{'_id':CID,'title':'CCC · Computer fundamentals','description':'Synthetic course','price':199,'isPublished':True,'access':{'videos':True,'enrolled':True},'payment':{'required':False,'waived':True},'category':{'name':'Computer exams'}},{'_id':SECOND,'title':'General studies','description':'Second synthetic course','price':0,'access':{'videos':True,'enrolled':True}},{'_id':'locked-course','title':'Locked course should not be a study chat','price':999,'access':{'videos':False,'enrolled':False}}]
        turns=[{'id':f'old-{i}','question':f'Explain memory example {i}','answer':MARKDOWN,'status':'answered','sources':[{'documentId':'doc-fixture','filename':'Course memory notes.pdf','page':6,'excerpt':'RAM stores temporary information.'}]} for i in range(3)]
        state={'turns':{CID:turns,SECOND:[]},'posts':0,'hold':True,'held':[],'daily':20,'available':True,'courses':courses,'gets':0}
        def route(r):
            req=r.request;u=urlparse(req.url)
            if u.netloc!='127.0.0.1:5186':unexpected.append(req.url);r.abort();return
            if not u.path.startswith('/api/'):r.continue_();return
            if u.path=='/api/auth/me':data={'user':{'id':harness.STUDENT_ID,'name':'Fixture learner','email':'fixture@example.invalid','role':'student','status':'active'}}
            elif u.path=='/api/courses':data={'courses':state['courses']}
            elif u.path.endswith('/doubt-dost'):
                course=u.path.split('/')[3]
                if course not in [CID,SECOND]:r.fulfill(status=403,json={'message':'Course access required'});return
                if req.method=='POST':
                    state['posts']+=1;assert len(req.post_data_json['requestId'])==36
                    turn={'id':f'new-{state["posts"]}','requestId':req.post_data_json['requestId'],'question':req.post_data_json['question'],'answer':'A clear answer from the approved notes.','status':'answered','sources':[]}
                    state['turns'][course].append(turn);state['daily']-=1
                    if state['hold']:state['held'].append((r,turn));return
                    data={'turn':turn}
                else:
                    state['gets']+=1
                    data={'course':{'id':course,'title':courses[0 if course==CID else 1]['title']},'available':state['available'],'readiness':state.get('readiness'),'dailyRemaining':state['daily'],'documents':1,'turns':deepcopy(state['turns'][course])}
            elif u.path.endswith('/feedback'):data={}
            else:unexpected.append(req.url);r.fulfill(status=500,json={'message':'Unexpected fixture request'});return
            r.fulfill(json={'data':data})
        ctx.route('**/*',route);return page,state
    def fits(page,label):
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),label+' horizontal fit'
        for field in [page.get_by_label('Your doubt',exact=True),page.get_by_role('button',name='Ask Doubt Dost',exact=True)]:
            box=field.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=page.viewport_size['height']+1,(label,box)
        assert page.locator('.doubt-conversation').evaluate('e=>e.clientHeight>30'),label+' leaves room for messages'
    try:
        for theme in ['light','dark']:
            page,state=fixture(theme);page.goto(harness.ORIGIN+'/student')
            page.get_by_role('link',name='Open Doubt Dost',exact=True).click();expect(page.get_by_role('heading',name='Your course conversations')).to_be_visible()
            expect(page.get_by_text('Locked course should not be a study chat',exact=True)).to_have_count(0)
            page.screenshot(path=str(evidence/f'doubt-hub-{theme}.png'),animations='disabled')
            page.get_by_role('link',name='CCC · Computer fundamentals',exact=False).click();expect(page.locator('.doubt-turn')).to_have_count(3)
            expect(page.locator('.doubt-answer-text table')).to_have_count(3);expect(page.locator('.doubt-answer-text strong')).to_have_count(3)
            assert page.locator('.doubt-answer-text img,.doubt-answer-text script,.doubt-answer-text a').count()==0
            assert page.evaluate('window.UNSAFE_EXECUTED!==true')
            for width,height in [(1440,1000),(1024,768),(768,1024),(390,844),(320,568),(844,390)]:
                page.set_viewport_size({'width':width,'height':height});fits(page,f'{theme} {width}x{height}')
                page.screenshot(path=str(evidence/f'chat-{theme}-{width}x{height}.png'),animations='disabled')
            page.set_viewport_size({'width':390,'height':844});page.get_by_label('Your doubt',exact=True).focus()
            page.evaluate('Object.defineProperty(visualViewport,"height",{configurable:true,get:()=>350});visualViewport.dispatchEvent(new Event("resize"))')
            assert page.get_by_role('button',name='Ask Doubt Dost',exact=True).evaluate('e=>e.getBoundingClientRect().bottom<=350'), 'composer survives a mobile keyboard reducing the visible height'
            expect(page.get_by_role('link',name='Back to course',exact=True)).to_be_visible()
            page.evaluate('delete visualViewport.height;visualViewport.dispatchEvent(new Event("resize"))')
            page.set_viewport_size({'width':1440,'height':1000})
            region=page.locator('.doubt-conversation');region.evaluate('e=>e.scrollTop=0');expect(page.get_by_role('button',name='Jump to latest message')).to_be_visible();page.get_by_role('button',name='Jump to latest message').click()
            assert region.evaluate('e=>e.scrollHeight-e.scrollTop-e.clientHeight<5')
            page.get_by_role('button',name='Copy answer',exact=True).last.click();expect(page.get_by_role('button',name='Answer copied')).to_be_visible()
            assert page.evaluate('navigator.clipboard.readText()')==MARKDOWN
            field=page.get_by_label('Your doubt',exact=True);field.fill('Explain RAM');field.dispatch_event('keydown',{'key':'Enter','code':'Enter','isComposing':True,'keyCode':229});assert state['posts']==0;field.press('Shift+Enter');field.type('with an example');assert state['posts']==0
            field.press('Enter');expect(page.locator('.doubt-turn--pending')).to_be_visible();assert state['posts']==1
            expect(page.get_by_role('button',name='Ask Doubt Dost',exact=True)).to_be_disabled()
            held,turn=state['held'].pop();held.fulfill(json={'data':{'turn':turn}});expect(field).to_have_value('');expect(page.locator('.doubt-turn')).to_have_count(4)
            page.reload();expect(page.locator('.doubt-turn')).to_have_count(4)
            page.set_viewport_size({'width':390,'height':844});page.get_by_role('combobox',name='Chat course').select_option(SECOND)
            expect(page.get_by_role('heading',name='Kahan atak gaye?')).to_be_visible();expect(page.locator('.doubt-turn')).to_have_count(0)
            assert page.get_by_role('heading',name='Kahan atak gaye?').bounding_box()['y']>=page.locator('.doubt-conversation').bounding_box()['y'], 'empty chat opens at its greeting rather than scrolling it away'
            page.screenshot(path=str(evidence/f'doubt-welcome-{theme}.png'),animations='disabled')
            before=state['posts'];page.get_by_role('button',name='Concept clear karo',exact=False).click();assert '[topic from my course]' in field.input_value();assert state['posts']==before
            state['daily']=0;page.reload();expect(page.get_by_text('You’ve used today’s answer allowance.',exact=False)).to_be_visible();expect(page.get_by_role('button',name='Ask Doubt Dost',exact=True)).to_be_disabled()
            state['daily']=20;state['available']=False;page.reload();expect(page.get_by_text('Your course’s doubt assistant is being prepared.',exact=False)).to_be_visible()
            state['readiness']={'code':'awaiting_publication','message':'The course PDFs are indexed and waiting to be published.'}
            page.get_by_role('button',name='Check again',exact=True).click();expect(page.get_by_text(state['readiness']['message'],exact=True)).to_be_visible()
            state['available']=True;page.clock.fast_forward(16000)
            expect(field).to_be_enabled();assert state['posts']==before, 'publication revalidation never posts an AI request'
            field.fill('Recover this saved answer without sending twice');field.press('Enter')
            expect(page.locator('.doubt-turn--pending')).to_be_visible();posts=state['posts']
            # The provider finished and stored the answer, but the original HTTP
            # response was lost. Status reads must recover that exact request.
            page.clock.fast_forward(9000);expect(field).to_have_value('');expect(field).to_be_enabled()
            expect(page.locator('.doubt-turn--pending')).to_have_count(0);assert state['posts']==posts
            route,turn=state['held'].pop();route.abort()
            page.clock.resume()
            # A genuine pending response must show honest elapsed feedback,
            # then the independent browser deadline must leave the spinner.
            field.fill('A slow provider should not freeze this chat');field.press('Enter');expect(page.locator('.doubt-turn--pending')).to_be_visible()
            pending=state['turns'][SECOND][-1];pending['status']='pending';pending['answer']=''
            page.clock.fast_forward(16000);expect(page.get_by_role('button',name='Check saved answer',exact=True)).to_be_visible()
            fits(page,'slow answer on mobile')
            pending['status']='failed';pending['answer']='The AI service took too long to answer.'
            page.clock.fast_forward(45000)
            expect(page.locator('.doubt-turn--pending')).to_have_count(0);expect(field).to_have_value('A slow provider should not freeze this chat')
            route,turn=state['held'].pop();route.abort()
            page.clock.resume()
            page.goto(harness.ORIGIN+'/courses/locked-course/doubts');expect(page.get_by_role('alert')).to_contain_text('Course access required');expect(page.locator('.doubt-turn')).to_have_count(0)
            state['courses']=[];page.goto(harness.ORIGIN+'/doubts');expect(page.get_by_role('heading',name='Your study chat starts with a course')).to_be_visible()
            harness.check(True,f'{theme}: student entry, course isolation, rich safe answers, saved history, keyboard send, copy, scroll, mobile composer, quota and empty/denied states')
        harness.check(not errors,'no JavaScript errors: '+str(errors));harness.check(not unexpected,'no untrusted or external requests: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.close()

if __name__=='__main__':harness.run_checks=run_checks;harness.main()
