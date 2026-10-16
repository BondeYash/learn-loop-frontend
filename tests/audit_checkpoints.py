"""Run any fixture suite with axe scans at its screenshot checkpoints.
Usage: python3 tests/audit_browser.py tests/payments_browser.py
Reports are written beside screenshots; no production accounts are used.
"""
import json, os, runpy, sys
from pathlib import Path
from playwright.sync_api import Page
root=Path(__file__).resolve().parents[1]
output=Path(os.environ['PLAYER_EVIDENCE_DIR']);output.mkdir(parents=True,exist_ok=True)
reports=[];seen=set();original=Page.screenshot

def screenshot(page,*args,**kwargs):
    key=(page.url,str(page.viewport_size),page.locator('html').get_attribute('class'),str(kwargs.get('path')))
    if key not in seen:
        seen.add(key)
        if not page.evaluate('Boolean(window.axe)'):page.add_script_tag(path=str(root/'node_modules/axe-core/axe.min.js'))
        page.evaluate('document.getAnimations().filter(a=>a instanceof CSSTransition).forEach(a=>a.finish())')
        report=page.evaluate("""async()=>{const a=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return {violations:a.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:a.incomplete.map(v=>v.id),smallFields:[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')].filter(e=>e.checkVisibility()&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>({tag:e.tagName,cls:e.className,size:getComputedStyle(e).fontSize}))}}""")
        reports.append({'url':page.url,'viewport':page.viewport_size,'screen':str(kwargs.get('path')),**report})
        (output/'axe-checkpoints.json').write_text(json.dumps(reports,indent=2))
    return original(page,*args,**kwargs)
Page.screenshot=screenshot
runpy.run_path(sys.argv[1],run_name='__main__')
