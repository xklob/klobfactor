import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const all=JSON.parse(await readFile('dist/assets/catalog.json','utf8')).flatMap(s=>s.entries),errors=[];
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(String(e)));
const go=async p=>{const r=await page.goto(base+p,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,p);};
const diagram=async()=>page.locator('[data-mode=diagram]').click();
try{
 await mkdir('.artifacts',{recursive:true});await go('/');await page.waitForSelector('.motion-canvas');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 18, 22)');
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();await go('/lab/');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 assert.equal(await page.getByLabel('Camera view',{exact:true}).inputValue(),'isometric');
 console.log('PASS charcoal default, theme persistence, and isometric camera');
 for(const l of all){
  await go(l.href);assert.equal(await page.locator('#diagram-panel').isVisible(),true);assert.equal(await page.locator('#source-panel').isVisible(),false);assert.equal(await page.locator('[data-mode=diagram]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('iframe').count(),0);
  for(let i=0;i<l.moves.length;i++){
   const m=l.moves[i];await page.locator('#move-select').selectOption(String(i));
   assert.equal(await page.locator('#current-move-title').textContent(),m.name);assert.equal(await page.locator('#move-counter').textContent(),`${i+1} / ${l.moves.length}`);
   assert.ok((await page.locator('#source-external').getAttribute('href')).includes(`t=${Math.floor(m.start)}s`));assert.equal(await page.locator('#source-only-note').isVisible(),!m.motion);
   if(m.motion){assert.ok(!/NaN|undefined/.test(await page.locator('#lesson-player .stage').getAttribute('data-camera')));assert.equal(await page.locator('#lesson-player .stage').getAttribute('data-body-animated'),'false');assert.equal(await page.locator('#lesson-player .playback').isVisible(),!(m.motion.kind==='study'||m.motion.still));}
  }
  assert.ok(await page.locator('#next-move').isDisabled());
 }
 console.log('PASS all 21 lessons and 150 ordered sections; 3D first, explicit diagram scope, no playback on static references');
 const basic=all[0];await go(basic.href+'?move=3');await diagram();const slider=page.getByLabel('Cycle position',{exact:true});
 await slider.fill('400');await slider.dispatchEvent('input');await page.getByRole('button',{name:'Step forward one eighth of a cycle',exact:true}).click();assert.equal(await slider.inputValue(),'525');await page.getByRole('button',{name:'Step backward one eighth of a cycle',exact:true}).click();assert.equal(await slider.inputValue(),'400');
 await page.getByLabel('Playback speed',{exact:true}).selectOption('0.25');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700);const slow=Number(await slider.inputValue());assert.ok(slow>410&&slow<470);await page.getByRole('button',{name:'Pause animation',exact:true}).click();const paused=await slider.inputValue();await page.waitForTimeout(150);assert.equal(await slider.inputValue(),paused);
 await page.getByLabel('Playback speed',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(700);assert.ok(Number(await slider.inputValue())-slow>70);await page.getByRole('button',{name:'Pause animation',exact:true}).click();
 const stage=page.locator('#lesson-player .stage'),canvas=page.locator('#lesson-player canvas'),r=await canvas.boundingBox(),camera=await stage.getAttribute('data-camera');await page.mouse.move(r.x+r.width*.4,r.y+r.height*.4);await page.mouse.down();await page.mouse.move(r.x+r.width*.55,r.y+r.height*.5,{steps:6});await page.mouse.up();assert.notEqual(await stage.getAttribute('data-camera'),camera);
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.ok(Number(await stage.getAttribute('data-zoom'))>1);await page.getByRole('button',{name:'Reset camera',exact:true}).click();assert.equal(await stage.getAttribute('data-zoom'),'1.000');
 await page.locator('.view-options summary').click();await page.getByRole('checkbox',{name:'Mirror view',exact:true}).check();assert.match(await page.locator('.view-note').textContent(),/Mirror/);
 for(const name of ['Left staff','Right staff'])await page.getByRole('checkbox',{name,exact:true}).uncheck();assert.equal(await stage.getAttribute('data-visible-staff-count'),'0');for(const name of ['Left staff','Right staff'])await page.getByRole('checkbox',{name,exact:true}).check();assert.equal(await stage.getAttribute('data-visible-staff-count'),'2');
 await page.locator('#lesson-player [data-action=expand]').click();assert.equal(await page.locator('dialog[open]').count(),1);await page.screenshot({path:'.artifacts/pattern-theater.png'});await page.keyboard.press('Escape');
 await page.locator('#lesson-player').evaluate(el=>{el.requestFullscreen=()=>Promise.reject(new Error('Unsupported'));});await page.locator('#lesson-player [data-action=fullscreen]').click();await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');
 await page.locator('[data-practice]').click();await page.reload();assert.equal(await page.locator('[data-practice]').getAttribute('aria-pressed'),'true');await diagram();
 await page.locator('#auto-advance').check();await slider.fill('990');await slider.dispatchEvent('input');await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(450);assert.equal(await page.locator('#move-counter').textContent(),`5 / ${basic.moves.length}`);
 console.log('PASS diagram speeds, seeking, stepping, orbit, zoom, mirroring, independent visibility, theater, fullscreen fallback, progress and auto-advance');
 await go(basic.href);await page.locator('[data-mode=source]').click();const media=await page.request.head(base+`/_local-media/${basic.videoId}.mp4`);
 if(media.ok()){
  await page.locator('#load-source').click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);const video=page.locator('video');assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-basic.moves[0].start)<1);
  await page.locator('#source-speed').selectOption('0.25');assert.equal(await video.evaluate(v=>v.playbackRate),.25);await page.locator('[data-video-step="2"]').click();assert.ok(await video.evaluate((v,start)=>v.currentTime>=start+1.9,basic.moves[0].start));
  const before=await video.evaluate(v=>v.currentTime);await page.locator('[data-video-step="0.1"]').click();assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-before-.1)<.03);
  await page.locator('#move-select').selectOption('1');await video.evaluate(v=>{v.currentTime=82;});await page.waitForFunction(()=>!document.querySelector('video').seeking);
  await page.locator('[data-source-focus]').click();await page.locator('[data-source-expand]').click();await page.waitForFunction(()=>!!document.querySelector('.source-focus canvas')?.dataset.crop);
  const focus=page.locator('.source-focus canvas'),crop=await focus.getAttribute('data-crop');assert.ok(Number(crop.split(',')[2])<await focus.evaluate(c=>{const v=document.querySelector('video'),r=v.getBoundingClientRect(),display=Math.min(r.width,r.height*v.videoWidth/v.videoHeight);return c.getBoundingClientRect().width*v.videoWidth/display;}),'Close-up must magnify relative to the main video');await focus.focus();await page.keyboard.press('ArrowRight');assert.notEqual(await focus.getAttribute('data-crop'),crop);await page.screenshot({path:'.artifacts/source-closeup-desktop.png'});
  await page.locator('#source-play').click();await page.waitForTimeout(350);assert.equal(await video.evaluate(v=>v.paused),false);assert.ok(Math.abs(Number(await focus.getAttribute('data-video-time'))-await video.evaluate(v=>v.currentTime))<.2);
  await page.locator('#source-play').click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  await page.locator('[data-source-fullscreen]').click();await page.waitForFunction(()=>document.fullscreenElement?.id==='source-panel'||Boolean(document.querySelector('dialog[open]')));if(await page.evaluate(()=>document.fullscreenElement?.id==='source-panel')){await page.locator('[data-source-fullscreen]').click();await page.waitForFunction(()=>!document.fullscreenElement);}else await page.keyboard.press('Escape');
  await page.locator('#source-seek').fill('500');await page.locator('#source-seek').dispatchEvent('input');assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-(basic.moves[1].start+basic.moves[1].end)/2)<.2);assert.equal(await video.evaluate(v=>v.paused),true);
  await page.locator('#source-speed').selectOption('2');await video.evaluate((v,end)=>{v.currentTime=end-.1;v.play();},basic.moves[1].end);await page.waitForTimeout(600);assert.ok(await video.evaluate((v,start)=>v.currentTime<start+3,basic.moves[1].start));
  await page.locator('#auto-advance').check();await video.evaluate((v,end)=>{v.currentTime=end-.1;v.play();},basic.moves[1].end);await page.waitForFunction(expected=>document.querySelector('#move-counter').textContent===expected,`3 / ${basic.moves.length}`,{timeout:5000});assert.equal(await page.locator('#move-counter').textContent(),`3 / ${basic.moves.length}`);await diagram();assert.equal(await video.evaluate(v=>v.paused),true);
  console.log('PASS actual source decoding, timestamps, 0.1s stepping, speed, segment seek, looping, auto-advance, close-up pan and live frame updates');
 }else{
  await page.route('https://www.youtube.com/iframe_api',route=>route.abort());await page.locator('#load-source').click();await page.waitForFunction(()=>document.querySelector('#source-status').textContent.includes('could not be reached'));assert.equal(await page.locator('[data-source-focus]').isDisabled(),true);
  console.log('PASS unavailable YouTube fallback; optional local-media tests skipped');
 }
 await go('/learn/');await page.waitForTimeout(150);await page.locator('#lesson-search').fill('pinky isolation');await page.waitForTimeout(100);assert.ok(await page.locator('.search-result').count()>0);await page.locator('#lesson-search').fill('xyzzy-no-match');assert.match(await page.locator('.search-results').textContent(),/No matching/);
 await go('/lab/?timing=split-opposite');for(const kind of ['extension','antispin','inspin','rtype','hybrid','antibrid']){await page.locator('#lab-pattern').selectOption(kind);assert.equal(await page.locator('.stage').getAttribute('data-staff-count'),'2');}
 const spatial=all.find(l=>l.videoId==='Awp9Jr5XuMg');await go(spatial.href+'?move=1');await diagram();const caption=await page.locator('.study-caption strong').textContent();assert.equal(await page.locator('.playback').isVisible(),false);await page.getByRole('button',{name:'Next position',exact:true}).click();assert.notEqual(await page.locator('.study-caption strong').textContent(),caption);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});for(const href of ['/',basic.href,'/learn/','/lab/','/vtg/','/reference/']){await go(href);await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}: ${href}`);}}
 await page.setViewportSize({width:390,height:844});await go('/');await page.getByRole('button',{name:'Menu',exact:true}).click();assert.equal(await page.locator('#main-nav').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#main-nav').isVisible(),false);await page.screenshot({path:'.artifacts/home-mobile.png',fullPage:true});await go(basic.href);await page.screenshot({path:'.artifacts/lesson-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS search, lab, static checkpoint navigation, responsive layouts and no runtime errors');
}finally{await browser.close();}
