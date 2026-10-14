import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const catalog=JSON.parse(await readFile('dist/assets/catalog.json','utf8'));
const all=catalog.flatMap(s=>s.entries),errors=[];
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',error=>errors.push(String(error)));
const go=async p=>{const r=await page.goto(base+p,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,p);};
try{
 await mkdir('.artifacts',{recursive:true});
 await go('/');await page.waitForSelector('.motion-svg');assert.match(await page.title(),/Klobfactor/);
 await page.screenshot({path:'.artifacts/home-desktop.png',fullPage:true});
 // Every move on every generated lesson must have synchronized headings, cues,
 // correct source timestamps, and either a finite diagram or a source-study view.
 for(const l of all){
  await go(l.href);await page.waitForSelector('#lesson-player svg',{state:'attached'});
  for(let i=0;i<l.moves.length;i++){
   await page.locator(`[data-move="${i}"]`).click();
   assert.equal(await page.locator('#current-move-title').textContent(),l.moves[i].name);
   assert.equal(await page.locator('#move-counter').textContent(),`${i+1} / ${l.moves.length}`);
   assert.ok((await page.locator('#source-external').getAttribute('href')).includes(`t=${Math.floor(l.moves[i].start)}s`));
   const svg=await page.locator('#lesson-player svg').innerHTML();assert.ok(!/NaN|undefined/.test(svg));
   assert.equal(await page.locator('#source-only-note').isVisible(),!l.moves[i].motion);
  }
  assert.ok(await page.locator('#next-move').isDisabled());
 }
 console.log(`PASS ${all.length} lessons and ${all.reduce((n,l)=>n+l.moves.length,0)} source-ordered sections`);
 const first=all[0];await go(first.href);await page.waitForSelector('#lesson-player svg',{state:'attached'});
 const slider=page.locator('#lesson-player input[type=range]');
 await slider.fill('400');await slider.dispatchEvent('input');assert.equal(await slider.inputValue(),'400');
 await page.getByRole('button',{name:'Step forward one eighth of a cycle',exact:true}).click();assert.equal(await slider.inputValue(),'525');
 await page.getByRole('button',{name:'Step backward one eighth of a cycle',exact:true}).click();assert.equal(await slider.inputValue(),'400');
 await page.locator('#lesson-player select').selectOption('0.25');
 await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700);
 const slow=Number(await slider.inputValue());assert.ok(slow>410&&slow<470,`Unexpected 0.25x progress ${slow}`);
 await page.getByRole('button',{name:'Pause animation',exact:true}).click();const paused=await slider.inputValue();await page.waitForTimeout(200);assert.equal(await slider.inputValue(),paused);
 await page.locator('#lesson-player select').selectOption('1');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700);const fast=Number(await slider.inputValue());assert.ok(fast-slow>75,`Unexpected 1x progress ${fast-slow}`);await page.getByRole('button',{name:'Pause animation',exact:true}).click();
 await page.getByRole('button',{name:'Side',exact:true}).click();assert.match(await page.locator('.view-note').textContent(),/Side/);
 await page.getByRole('button',{name:'Top',exact:true}).click();assert.match(await page.locator('.view-note').textContent(),/Top/);
 await page.getByRole('button',{name:'Front',exact:true}).click();
 await page.getByRole('checkbox',{name:'Mirror view',exact:true}).check();assert.match(await page.locator('.view-note').textContent(),/Mirror/);
 await page.getByRole('checkbox',{name:'Tip paths',exact:true}).uncheck();assert.equal(await page.locator('.trail-layer polyline').count(),0);
 await page.locator('#lesson-player').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await slider.inputValue(),String(fast));
 await page.locator('[data-practice]').click();await page.reload();assert.equal(await page.locator('[data-practice]').getAttribute('aria-pressed'),'true');
 await page.screenshot({path:'.artifacts/lesson-desktop.png',fullPage:true});
 await page.locator('#auto-advance').check();await page.locator('#lesson-player select').selectOption('2');await slider.fill('980');await slider.dispatchEvent('input');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(450);assert.equal(await page.locator('#move-counter').textContent(),`2 / ${first.moves.length}`);assert.equal(await page.locator('#lesson-player').getAttribute('data-playing'),'true');await page.locator('[data-move="0"]').click();await page.locator('#auto-advance').uncheck();
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
 await go('/lab/?timing=split-opposite');assert.equal(await page.locator('#lab-timing').inputValue(),'split-opposite');for(const kind of ['extension','antispin','inspin','rtype','hybrid','antibrid']){await page.locator('#lab-pattern').selectOption(kind);assert.ok(!/NaN/.test(await page.locator('svg.motion-svg').innerHTML()));}
 const spatial=all.find(l=>l.videoId==='Awp9Jr5XuMg');await go(spatial.href+'?move=1');await page.waitForSelector('.study-caption');const caption=await page.locator('.study-caption strong').textContent();await page.locator('[data-action=forward]').click();assert.notEqual(await page.locator('.study-caption strong').textContent(),caption);await page.screenshot({path:'.artifacts/spatial-desktop.png',fullPage:true});
 const archer=all.find(l=>l.videoId==='2WMkronsmfo');await go(archer.href+'?move=1');await page.screenshot({path:'.artifacts/archer-desktop.png',fullPage:true});
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
