import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const catalog=JSON.parse(await readFile('dist/assets/catalog.json','utf8'));
const all=catalog.flatMap(s=>s.entries),errors=[];
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',error=>errors.push(String(error)));
const go=async p=>{const r=await page.goto(base+p,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,p);};
try{
 await mkdir('.artifacts',{recursive:true});
 await go('/');await page.waitForSelector('.motion-canvas');assert.match(await page.title(),/Klobfactor/);
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 18, 22)');
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 247, 242)');
 await go('/lab/');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();await go('/');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.locator('.stage').getAttribute('data-staff-count'),'2');
 assert.equal(await page.locator('[aria-label="Camera view"]').inputValue(),'isometric');
 console.log('PASS dark default, live diagram colors, theme toggle, and preference persistence across pages and reloads');
 await page.screenshot({path:'.artifacts/home-desktop.png',fullPage:true});
 // Every move on every generated lesson must have synchronized headings, cues,
 // correct source timestamps, and either a finite diagram or a source-study view.
 for(const l of all){
  await go(l.href);await page.waitForSelector('#lesson-player canvas',{state:'attached'});
  for(let i=0;i<l.moves.length;i++){
   await page.locator('#move-select').selectOption(String(i));
   assert.equal(await page.locator('#current-move-title').textContent(),l.moves[i].name);
   assert.equal(await page.locator('#move-counter').textContent(),`${i+1} / ${l.moves.length}`);
   assert.ok((await page.locator('#source-external').getAttribute('href')).includes(`t=${Math.floor(l.moves[i].start)}s`));
   assert.ok(!/NaN|undefined/.test(await page.locator('#lesson-player .stage').getAttribute('data-camera')));
   assert.equal(await page.locator('#source-only-note').isVisible(),!l.moves[i].motion);
  }
  assert.ok(await page.locator('#next-move').isDisabled());
 }
 console.log(`PASS ${all.length} lessons and ${all.reduce((n,l)=>n+l.moves.length,0)} source-ordered sections`);
 const first=all[0];await go(first.href);await page.waitForSelector('#lesson-player canvas',{state:'attached'});
 const slider=page.locator('#lesson-player input[type=range]');
 await slider.fill('400');await slider.dispatchEvent('input');assert.equal(await slider.inputValue(),'400');
 await page.getByRole('button',{name:'Step forward one eighth of a cycle',exact:true}).click();assert.equal(await slider.inputValue(),'525');
 await page.getByRole('button',{name:'Step backward one eighth of a cycle',exact:true}).click();assert.equal(await slider.inputValue(),'400');
 await page.locator('#lesson-player select[aria-label="Playback speed"]').selectOption('0.25');
 await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700);
 const slow=Number(await slider.inputValue());assert.ok(slow>410&&slow<470,`Unexpected 0.25x progress ${slow}`);
 await page.getByRole('button',{name:'Pause animation',exact:true}).click();const paused=await slider.inputValue();await page.waitForTimeout(200);assert.equal(await slider.inputValue(),paused);
 await page.locator('#lesson-player select[aria-label="Playback speed"]').selectOption('1');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700);const fast=Number(await slider.inputValue());assert.ok(fast-slow>75,`Unexpected 1x progress ${fast-slow}`);await page.getByRole('button',{name:'Pause animation',exact:true}).click();
 await page.getByLabel('Camera view',{exact:true}).selectOption('side');assert.match(await page.locator('.view-note').textContent(),/Side/);
 await page.getByLabel('Camera view',{exact:true}).selectOption('top');assert.match(await page.locator('.view-note').textContent(),/Top/);
 await page.getByLabel('Camera view',{exact:true}).selectOption('front');
 await page.locator('.view-options summary').click();
 await page.getByRole('checkbox',{name:'Mirror view',exact:true}).check();assert.match(await page.locator('.view-note').textContent(),/Mirror/);
 await page.getByRole('checkbox',{name:'Tip paths',exact:true}).check();await page.getByRole('checkbox',{name:'Tip paths',exact:true}).uncheck();
 await page.locator('#lesson-player').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await slider.inputValue(),String(fast));
 await page.locator('[data-practice]').click();await page.reload();assert.equal(await page.locator('[data-practice]').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:'.artifacts/lesson-desktop.png',fullPage:true});
 await page.locator('#auto-advance').check();await page.locator('#lesson-player select[aria-label="Playback speed"]').selectOption('2');await slider.fill('980');await slider.dispatchEvent('input');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(450);assert.equal(await page.locator('#move-counter').textContent(),`2 / ${first.moves.length}`);assert.equal(await page.locator('#lesson-player').getAttribute('data-playing'),'true');await page.locator('#move-select').selectOption('0');await page.locator('#auto-advance').uncheck();
 console.log('PASS seeking, stepping, speed, pause, views, keyboard controls, auto-advance, and persistent practice state');
 // Native source playback can be tested without depending on YouTube's bot checks.
 const localSource=await page.request.head(base+`/_local-media/${first.videoId}.mp4`);
 if(localSource.ok()){
 await page.locator('[data-mode=source]').click();await page.locator('#load-source').click();await page.waitForSelector('#source-player video');
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
 assert.ok(Math.abs(await page.locator('video').evaluate(v=>v.currentTime)-first.moves[0].start)<1);
 await page.locator('#source-speed').selectOption('0.25');assert.equal(await page.locator('video').evaluate(v=>v.playbackRate),.25);
 await page.locator('[data-video-step="2"]').click();assert.ok((await page.locator('video').evaluate(v=>v.currentTime))>=first.moves[0].start+1.9);
 await page.locator('video').evaluate(v=>v.play());await page.waitForTimeout(500);assert.equal(await page.locator('video').evaluate(v=>v.paused),false);
 await page.locator('#source-speed').selectOption('2');await page.locator('video').evaluate((v,end)=>{v.currentTime=end-.1;},first.moves[0].end);await page.waitForTimeout(450);assert.ok(await page.locator('video').evaluate((v,start)=>v.currentTime<start+2,first.moves[0].start),'Source segment did not loop');
 await page.locator('[data-mode=diagram]').click();assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
 console.log('PASS actual downloaded source video loads, seeks, plays, and changes speed');
 }else console.log('SKIP optional downloaded-media test: source media not installed');
 await go('/learn/');await page.waitForTimeout(200);await page.locator('#lesson-search').fill('pinky isolation');await page.waitForTimeout(100);assert.ok(await page.locator('.search-result').count()>0);await page.locator('#lesson-search').fill('no-match-xyzzy');assert.match(await page.locator('.search-results').textContent(),/No matching/);await page.locator('#lesson-search').fill('');assert.equal(await page.locator('#curriculum').isVisible(),true);
 await go('/lab/?timing=split-opposite');assert.equal(await page.locator('#lab-timing').inputValue(),'split-opposite');for(const kind of ['extension','antispin','inspin','rtype','hybrid','antibrid']){await page.locator('#lab-pattern').selectOption(kind);assert.equal(await page.locator('.stage').getAttribute('data-staff-count'),'2');}
 const spatial=all.find(l=>l.videoId==='Awp9Jr5XuMg');await go(spatial.href+'?move=1');await page.waitForSelector('.study-caption');const caption=await page.locator('.study-caption strong').textContent();await page.locator('[data-action=forward]').click();assert.notEqual(await page.locator('.study-caption strong').textContent(),caption);await page.screenshot({path:'.artifacts/spatial-desktop.png',fullPage:true});
 const archer=all.find(l=>l.videoId==='2WMkronsmfo');await go(archer.href+'?move=1');await page.screenshot({path:'.artifacts/archer-desktop.png',fullPage:true});

 // Camera movement, enlargement, hand inset, and continuous archer motion.
 await page.waitForSelector('.motion-canvas');
 assert.equal(await page.getByLabel('Camera view',{exact:true}).inputValue(),'isometric');
 assert.equal(await page.locator('.section-picker').getAttribute('open'),null);
 assert.equal(await page.locator('.view-options').getAttribute('open'),null);
 await page.getByRole('button',{name:'Grip inset',exact:true}).click();
 assert.equal(await page.locator('.grip-picture').isVisible(),true);
 await page.getByLabel('Inset hand',{exact:true}).selectOption('1');
 const inset=page.locator('.grip-window'),insetBounds=await inset.boundingBox(),insetStage=page.locator('#lesson-player .stage');
 const insetBefore=await insetStage.getAttribute('data-inset-camera'),mainBefore=await insetStage.getAttribute('data-camera');
 await page.mouse.move(insetBounds.x+insetBounds.width*.4,insetBounds.y+insetBounds.height*.4);await page.mouse.down();await page.mouse.move(insetBounds.x+insetBounds.width*.65,insetBounds.y+insetBounds.height*.55,{steps:6});await page.mouse.up();
 assert.notEqual(await insetStage.getAttribute('data-inset-camera'),insetBefore);assert.equal(await insetStage.getAttribute('data-camera'),mainBefore);
 const stage=page.locator('#lesson-player .stage'),canvas=page.locator('#lesson-player canvas');
 const bounds=await canvas.boundingBox(),camera=await stage.getAttribute('data-camera');
 await page.mouse.move(bounds.x+bounds.width*.4,bounds.y+bounds.height*.4);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.55,bounds.y+bounds.height*.5,{steps:6});await page.mouse.up();
 assert.notEqual(await stage.getAttribute('data-camera'),camera);assert.equal(await page.getByLabel('Camera view',{exact:true}).inputValue(),'free');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.ok(Number(await stage.getAttribute('data-zoom'))>1);
 await page.getByRole('button',{name:'Reset camera',exact:true}).click();assert.equal(await stage.getAttribute('data-zoom'),'1.000');
 await page.getByLabel('Cycle position',{exact:true}).fill('250');await page.getByLabel('Cycle position',{exact:true}).dispatchEvent('input');assert.match(await page.locator('.study-caption strong').textContent(),/shoulder/);
 await page.getByLabel('Cycle position',{exact:true}).fill('750');await page.getByLabel('Cycle position',{exact:true}).dispatchEvent('input');assert.match(await page.locator('.study-caption strong').textContent(),/Under/);
 await page.getByRole('button',{name:'Expand',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),1);
 await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(400);assert.ok(Number(await page.getByLabel('Cycle position',{exact:true}).inputValue())>750);await page.getByRole('button',{name:'Pause animation',exact:true}).click();
 await page.screenshot({path:'.artifacts/archer-theater.png'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#lesson-player').isVisible(),true);
 await page.locator('.view-options summary').click();await page.getByRole('button',{name:'Full screen',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'lesson-player');
 await page.screenshot({path:'.artifacts/archer-fullscreen.png'});
 await page.getByRole('button',{name:'Exit full screen',exact:true}).click();assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
 await go('/lab/');await page.waitForSelector('canvas');await page.getByLabel('Camera view',{exact:true}).selectOption('front');
 for(const kind of ['isolation','antispin']){await page.locator('#lab-pattern').selectOption(kind);assert.equal(await page.locator('.stage').getAttribute('data-staff-count'),'2');assert.match(await page.locator('.scene-status').textContent(),/overlap/);}
 console.log('PASS camera orbit/zoom/reset, grip inset, archer animation, overlap labels, theater, full screen, and collapsed secondary UI');
 console.log('PASS library search, deep links, motion lab, and spatial checkpoint stepping');
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});for(const href of ['/',first.href,'/learn/','/lab/','/vtg/','/reference/']){
   await go(href);await page.waitForTimeout(60);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}: ${href}`);
  }
 }
 await page.setViewportSize({width:390,height:844});await go('/');await page.getByRole('button',{name:'Menu',exact:true}).click();assert.equal(await page.locator('#main-nav').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#main-nav').isVisible(),false);await page.screenshot({path:'.artifacts/home-mobile.png',fullPage:true});
 await go(first.href);await page.screenshot({path:'.artifacts/lesson-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS mobile/tablet/desktop layout, mobile navigation, and no browser runtime errors');
}finally{await browser.close();}
