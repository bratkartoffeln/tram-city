from pathlib import Path
import os
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parents[1]
html=(P/'web/index.html').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':393,'height':851},is_mobile=True,has_touch=True,device_scale_factor=2)
 ctx.route('https://appassets.androidplatform.net/**',lambda r:r.fulfill(status=200,content_type='text/html',body=html))
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:print('CONSOLE',m.type,m.text) if m.type=='error' else None)
 page.evaluate('''Object.defineProperty(window,'localStorage',{value:{data:{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=String(v)},removeItem(k){delete this.data[k]}}})''');page.set_content(html);page.wait_for_timeout(600)
 page.screenshot(path=str(P/'tests/welcome.png'))
 page.get_by_role('button',name='Mit Beispielnetz starten').click();page.wait_for_timeout(1000)
 print('state',page.evaluate('({lines:GG.game.state.lines.length,money:GG.game.state.money,time:GG.game.state.time})'))
 page.screenshot(path=str(P/'tests/demo-393.png'))
 page.evaluate('GG.testAdvance(150);GG.renderer.focus(GGEngine.HUBS[0]);GG.renderer.render(performance.now());');page.wait_for_timeout(200)
 page.screenshot(path=str(P/'tests/growth-393.png'))
 page.evaluate('GG.begin("tram",1);');page.wait_for_timeout(250)
 page.screenshot(path=str(P/'tests/edit-393.png'))
 print('errors',errors)
 browser.close()
