"""Autoplay, pause, keyboard controls and reduced motion with local assets only."""
from urllib.parse import urlparse
from playwright.sync_api import expect
import student_player_browser as harness
from public_catalog_browser import CARD

def run_checks(browser,media,evidence):
    contexts=[];errors=[];unexpected=[]
    def fixture(reduced=False):
        ctx=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block',reduced_motion='reduce' if reduced else 'no-preference');contexts.append(ctx)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        def route(r):
            u=urlparse(r.request.url)
            if u.netloc!='127.0.0.1:5186':unexpected.append(r.request.url);r.abort();return
            if not u.path.startswith('/api/'):r.continue_();return
            if u.path=='/api/auth/me':r.fulfill(status=401,json={'message':'Sign in required'});return
            if harness.fulfill_optional_exam_notifications(r,u):return
            if u.path=='/api/public/courses':r.fulfill(json={'data':{'courses':[CARD],'categories':[CARD['category']],'page':1,'limit':12,'total':1}});return
            unexpected.append(r.request.url);r.fulfill(status=500,json={'message':'Unexpected slider fixture'})
        ctx.route('**/*',route);page.goto(harness.ORIGIN);page.mouse.move(0,0)
        expect(page.locator('.hero-slide')).to_have_count(2)
        page.wait_for_function('Array.from(document.querySelectorAll(".hero-slide")).every(e=>e.complete&&e.naturalWidth>0)')
        return page
    try:
        page=fixture();stage=page.locator('.hero-photo-stage')
        expect(stage).to_have_attribute('data-slide','1');expect(stage).to_have_attribute('data-slide','2',timeout=8000)
        stage.hover();current=stage.get_attribute('data-slide');page.wait_for_timeout(5300);expect(stage).to_have_attribute('data-slide',current)
        page.get_by_role('button',name='Pause student photos').click();page.mouse.move(0,0);page.wait_for_timeout(5300);expect(stage).to_have_attribute('data-slide',current)
        page.get_by_role('button',name='Show student photo 1').click();expect(stage).to_have_attribute('data-slide','1')
        choice=page.get_by_role('button',name='Show student photo 2');choice.focus();choice.press('Enter');expect(stage).to_have_attribute('data-slide','2');expect(choice).to_have_attribute('aria-pressed','true')
        for theme in ['light','dark']:
            if theme=='dark':page.get_by_role('button',name='Switch to dark theme').click()
            for width in [320,390,768,1440]:
                page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                for control in page.locator('.hero-slider-controls button').all():
                    box=control.bounding_box();assert box['width']>=44 and box['height']>=44
                    assert box['x']>=0 and box['x']+box['width']<=width
                stage.screenshot(path=str(evidence/f'slider-{theme}-{width}.png'),animations='disabled')
        reduced=fixture(True);expect(reduced.get_by_role('button',name='Play student photos')).to_be_visible();reduced.wait_for_timeout(5300);expect(reduced.locator('.hero-photo-stage')).to_have_attribute('data-slide','1')
        reduced.get_by_role('button',name='Show student photo 2').click();expect(reduced.locator('.hero-photo-stage')).to_have_attribute('data-slide','2')
        harness.check(True,'photos advance automatically; hover/pause hold; keyboard/dot controls work; reduced motion starts paused; both themes fit mobile/tablet/desktop')
        harness.check(not errors,'no browser errors: '+str(errors));harness.check(not unexpected,'all slider requests stay local: '+str(unexpected))
    finally:
        for ctx in contexts:ctx.close()
if __name__=='__main__':harness.run_checks=run_checks;harness.main()
