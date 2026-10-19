"""Browser-only tests. about:blank with an explicit in-memory localStorage test double.
No navigation, browser-policy changes or claims of Android/WebView validation.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
import json,time
P=Path(__file__).resolve().parents[1];html=(P/'web/index.html').read_text();results=[]
STORE="""data=>Object.defineProperty(window,'localStorage',{value:{data:data||{},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=String(v)},removeItem(k){delete this.data[k]}}})"""
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,568),(393,851),(851,393),(800,1280)]:
  ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,device_scale_factor=1)
  page=ctx.new_page();errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  page.evaluate(STORE,{});page.set_content(html);page.wait_for_timeout(200)
  page.locator('[data-act="welcome-build"]').tap();page.locator('#stopListToggle').tap()
  for stop in [0,4,1,3,2]:page.locator(f'[data-stop="{stop}"]').tap()
  assert page.locator('#commit').is_enabled()
  page.locator('#commit').tap();assert page.evaluate('GG.game.state.lines.length')==1
  page.locator('[data-mode="lines"]').tap();page.locator('[data-act="extend"]').tap()
  page.locator('#stopListToggle').tap();page.locator('[data-stop="7"]').tap();page.locator('#commit').tap()
  assert page.evaluate('GG.game.state.lines.length===1 && GG.game.state.lines[0].stops.length===6')
  # One continuous bus line rather than new lines for each pair of stops.
  page.locator('[data-mode="bus"]').tap();page.locator('#suggest').tap();page.locator('#commit').tap()
  assert page.evaluate('GG.game.state.lines.length')==2
  page.locator('#pause').tap()
  before=page.evaluate('GG.game.state.time');page.wait_for_timeout(200);assert page.evaluate('GG.game.state.time')==before
  # Menus fit viewport; scrolling is inside the sheet, not the document.
  page.locator('[data-mode="city"]').tap();page.wait_for_timeout(100)
  bounds=page.locator('#sheet').bounding_box();assert bounds['x']>=-1 and bounds['y']>=-1
  assert bounds['x']+bounds['width']<=w+1 and bounds['y']+bounds['height']<=h+1
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.screenshot(path=str(P/f'tests/city-{w}x{h}.png'))
  page.locator('#closeSheet').tap()
  # Drag and pinch feed the actual pointer handlers on the canvas.
  pos=page.evaluate('({x:GG.renderer.ox,y:GG.renderer.oy,zoom:GG.renderer.zoom})')
  page.evaluate("""()=>{const c=document.getElementById('world');for(const[type,x,y]of[['pointerdown',150,220],['pointermove',170,250],['pointerup',170,250]])c.dispatchEvent(new PointerEvent(type,{pointerId:8,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));}""")
  page.evaluate("""()=>{const c=document.getElementById('world'),send=(type,id,x,y)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));send('pointerdown',1,100,210);send('pointerdown',2,160,210);send('pointermove',1,95,210);send('pointermove',2,180,210);send('pointerup',1,95,210);send('pointerup',2,180,210);}""")
  page.evaluate('GG.save()');stored=page.evaluate('window.localStorage.data')
  clone=ctx.new_page();clone.evaluate(STORE,stored);clone.set_content(html);clone.wait_for_timeout(100)
  assert clone.evaluate('GG.game.state.lines.length===2 && GG.game.state.lines[0].stops.length===6');clone.close()
  page.evaluate('GG.suspend()');t=page.evaluate('GG.game.state.time');page.wait_for_timeout(100);assert page.evaluate('GG.game.state.time')==t
  assert not errors,errors;assert not requests,requests
  results.append({'viewport':f'{w}x{h}','passed':True,'javascript_errors':errors,'network_requests':requests,'checks':['touch build 5-stop tram','append 6th stop keeps single line','build multi-stop bus','pause','sheet bounds / document width','pointer drag / pinch handlers','JSON state reload with storage test double','suspend']})
  print('PASS',w,h);ctx.close()
 # Actual rendered game screenshots, same viewpoint before and after simulation.
 ctx=browser.new_context(viewport={'width':393,'height':851},is_mobile=True,has_touch=True,device_scale_factor=2)
 page=ctx.new_page();page.evaluate(STORE,{});page.set_content(html);page.locator('[data-act="demo-now"]').tap();page.locator('#pause').tap()
 page.evaluate('GG.renderer.focus(GGEngine.HUBS[0]);GG.renderer.render(performance.now())');page.wait_for_timeout(5800)
 page.screenshot(path=str(P/'tests/neighborhood-before.png'))
 page.evaluate('GG.testAdvance(360)');page.wait_for_timeout(5800)
 page.screenshot(path=str(P/'tests/neighborhood-after.png'))
 page.locator('#fit').tap();page.wait_for_timeout(200);page.screenshot(path=str(P/'tests/city-grown.png'))
 ctx.close();browser.close()
(P/'tests/browser-results.json').write_text(json.dumps({'environment':'Chromium, not Android WebView','storage':'explicit in-memory test double; actual device storage not tested','tests':results},indent=2))
