import {MotionPlayer} from './player.mjs';
import {SourceFocus} from './source-focus.mjs';
import {timingAngles,TAU} from './motion.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const loadSaved=()=>{try{return JSON.parse(localStorage.getItem('klobfactor-practice')||'{}')||{};}catch{return {};}};
let practiced=loadSaved();
function showPractice(){
 $$('[data-lesson]').forEach(row=>row.classList.toggle('practiced',Boolean(practiced[row.dataset.lesson])));
 $$('[data-practice]').forEach(b=>{const done=Boolean(practiced[b.dataset.practice]);b.setAttribute('aria-pressed',String(done));b.textContent=done?'✓ Practiced':'○ Mark practiced';});
}
showPractice();
$$('[data-practice]').forEach(b=>b.addEventListener('click',()=>{practiced[b.dataset.practice]=!practiced[b.dataset.practice];try{localStorage.setItem('klobfactor-practice',JSON.stringify(practiced));}catch{}showPractice();}));
$('.mobile-menu')?.addEventListener('click',e=>{const expanded=e.currentTarget.getAttribute('aria-expanded')==='true';e.currentTarget.setAttribute('aria-expanded',String(!expanded));$('#main-nav').classList.toggle('open',!expanded);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#main-nav')?.classList.remove('open');$('.mobile-menu')?.setAttribute('aria-expanded','false');}});
if($('[data-home-player]')){const p=new MotionPlayer($('[data-home-player]'),{kind:'hybrid',timing:'together-opposite'},{mini:true,id:'home'});p.seek(.16);}

const catalogPromise=()=>fetch('/assets/catalog.json').then(r=>{if(!r.ok)throw new Error('Catalog unavailable');return r.json();});
if($('#lesson-search')){
 let catalog;
 catalogPromise().then(s=>{catalog=s.flatMap(x=>x.entries);}).catch(()=>{$('#search-count').textContent='Search is unavailable. Browse the lessons below.';});
 $('#lesson-search').addEventListener('input',e=>{
  if(!catalog)return;const q=e.target.value.toLowerCase().trim(),words=q.split(/\s+/);const box=$('.search-results');$('#curriculum').hidden=Boolean(q);box.hidden=!q;
  if(!q){$('#search-count').textContent=`21 lessons · ${catalog.reduce((n,l)=>n+l.moves.length,0)} sections`;return;}
  const matches=catalog.map(l=>{const lessonMatch=words.every(w=>`${l.title} ${l.summary}`.toLowerCase().includes(w));const moves=l.moves.map((m,i)=>({m,i})).filter(({m})=>words.every(w=>`${l.title} ${m.name} ${m.description}`.toLowerCase().includes(w)));return {l,moves,lessonMatch};}).filter(x=>x.lessonMatch||x.moves.length);
  $('#search-count').textContent=`${matches.length} matching lessons`;
  box.innerHTML=matches.length?matches.map(({l,moves})=>`<article class="search-result"><span class="eyebrow">${l.series==='beginner'?'BASICS':'ANTIBRIDS'} · ${String(l.order).padStart(2,'0')}</span><h2><a href="${l.href}">${escape(l.title)}</a></h2><p>${escape(l.summary)}</p>${moves.slice(0,5).map(({m,i})=>`<a class="search-move" href="${l.href}?move=${i}">${escape(m.name)} <span>${time(m.start)} →</span></a>`).join('')}</article>`).join(''):'<div class="empty-state"><h2>No matching moves.</h2><p>Try “reel” or “pinky”.</p></div>';
 });
}

function ytApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('YouTube did not load. Try opening the source on YouTube or using a downloaded video.')),12000);window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve(window.YT);};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timeout);reject(new Error('YouTube could not be reached. Use the source link or a downloaded video.'));};document.head.append(script);});
}
if($('#lesson-data')){
 const lesson=JSON.parse($('#lesson-data').textContent);let index=0,video=null,yt=null,sourceReady=false,loading=false,objectUrl=null,mode='diagram',focus=null,sourceDialog=null,sourcePlaceholder=null;
 const p=new MotionPlayer($('#lesson-player'),lesson.moves[0].motion||{kind:'static'},{id:lesson.id,onComplete:()=>advance('diagram'),onMoveStep:direction=>updateMove(index+direction),canMove:direction=>index+direction>=0&&index+direction<lesson.moves.length});
 const sourceUrl=()=>`https://www.youtube.com/watch?v=${lesson.videoId}&t=${Math.floor(lesson.moves[index].start)}s`;
 function modeChange(next){mode=next;$('#diagram-panel').hidden=next!=='diagram';$('#source-panel').hidden=next!=='source';$$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===next)));if(next==='source'){p.playing=false;p.updateButton();}else{video?.pause();yt?.pauseVideo?.();}}
 $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>modeChange(b.dataset.mode)));
 $('[data-open-source]')?.addEventListener('click',()=>modeChange('source'));
 function advance(from){
  if(!$('#auto-advance').checked||index>=lesson.moves.length-1)return false;
  updateMove(index+1);
  if(from==='diagram'&&lesson.moves[index].motion&&!p.referenceOnly){p.playing=true;p.updateButton();}
  if(from==='source'){if(video)video.play().catch(()=>{});if(yt&&sourceReady)yt.loadVideoById({videoId:lesson.videoId,startSeconds:lesson.moves[index].start});}
  return true;
 }
 function segment(){const m=lesson.moves[index];$('#source-seek').value='0';$('#source-time').value=`${time(m.start)} / ${time(m.end)}`;if(video){video.currentTime=m.start;video.pause();}if(yt&&sourceReady){yt.cueVideoById({videoId:lesson.videoId,startSeconds:m.start,endSeconds:m.end});}}
 function updateMove(n,updateUrl=true){
  index=Math.max(0,Math.min(lesson.moves.length-1,n));const m=lesson.moves[index];p.playing=false;p.updateButton();
  if(!m.motion){p.closeTheater();if(document.fullscreenElement===p.root)document.exitFullscreen().catch(()=>{});}
  $('#lesson-player').hidden=!m.motion;$('#source-only-note').hidden=Boolean(m.motion);
  if(m.motion)p.setSpec({...m.motion,title:m.name});
  $('#current-move-label').textContent=`${m.demonstrationOnly?'SOURCE STUDY':'MOVE'} ${String(index+1).padStart(2,'0')}`;
  $('#current-move-title').textContent=m.name;$('#current-move-description').textContent=m.description;
  $('#cue-grip').textContent=m.grip;$('#cue-stance').textContent=m.stance;$('#cue-focus').textContent=m.focus;
  $('#move-source-link').href=sourceUrl();$('#move-source-link').textContent=`Source · ${time(m.start)}–${time(m.end)} ↗`;
  $('#source-external').href=sourceUrl();
  $('#practice-steps').innerHTML=m.steps.map(step=>`<li><strong>${escape(step.title)}</strong><p>${escape(step.body)}</p></li>`).join('');
  $('#steps-title').textContent=m.demonstrationOnly?'Observations':'Steps';
  $('#move-counter').textContent=`${index+1} / ${lesson.moves.length}`;
  $('#move-select').value=String(index);
  $('#previous-move').disabled=index===0;$('#next-move').disabled=index===lesson.moves.length-1;
  $$('[data-move]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.move)===index?'step':'false'));
  segment();if(sourceReady)enableSource();if(updateUrl){const url=new URL(location.href);url.searchParams.set('move',String(index));history.replaceState(null,'',url);}
 }
 $$('[data-move]').forEach(b=>b.addEventListener('click',()=>updateMove(Number(b.dataset.move))));
 $('#move-select').addEventListener('change',e=>updateMove(Number(e.target.value)));
 $('#previous-move').addEventListener('click',()=>updateMove(index-1));$('#next-move').addEventListener('click',()=>updateMove(index+1));
 $('#move-source-link').addEventListener('click',e=>{e.preventDefault();modeChange('source');});
 function enableSource(){sourceReady=true;$('#source-play').disabled=false;$('#source-seek').disabled=false;$$('[data-video-step]').forEach(b=>b.disabled=false);$('#source-speed').disabled=false;$('#source-status').textContent=`Source segment ${time(lesson.moves[index].start)}–${time(lesson.moves[index].end)}. Speed and loop apply to the source video.`;}
 function checkLocalSegment(player,naturalEnd=false){
  if(player!==video||player.seeking||(!naturalEnd&&player.paused))return;
  const m=lesson.moves[index];if(player.currentTime<m.end-(naturalEnd ? .3 : 0))return;
  if(advance('source'))return;
  if($('#source-loop').checked){player.currentTime=m.start;if(naturalEnd)player.play().catch(()=>{});}
  else{player.pause();player.currentTime=m.end;}
 }
 function videoLoaded(src){
  video?.pause();if(video){video.removeAttribute('src');video.load();}focus?.dispose();focus=null;yt?.destroy?.();yt=null;sourceReady=false;
  $('#source-player').innerHTML='<video controls playsinline preload="metadata" aria-label="DrexFactor source video"></video>';
  video=$('#source-player video');video.src=src;focus=new SourceFocus($('#source-player'),video,()=>{$('[data-source-focus]').setAttribute('aria-pressed','false');});$('[data-source-focus]').disabled=false;$('[data-source-focus]').title='Show a crop of the same video frame';$('[data-source-focus]').setAttribute('aria-pressed','false');[...$('#source-speed').options].forEach(o=>o.disabled=false);
  video.addEventListener('loadedmetadata',()=>{video.currentTime=lesson.moves[index].start;video.playbackRate=Number($('#source-speed').value);enableSource();},{once:true});
  video.addEventListener('error',()=>{$('#source-status').textContent='This video could not be opened. Choose the matching downloaded video or open the YouTube source.';});
  const player=video;
  player.addEventListener('timeupdate',()=>checkLocalSegment(player));
  player.addEventListener('ended',()=>checkLocalSegment(player,true));
 }
 $('#load-source').addEventListener('click',async()=>{
  if(loading)return;loading=true;$('#source-status').textContent='Loading video…';
  try{
   if(['localhost','127.0.0.1'].includes(location.hostname)){
    const local=`/_local-media/${lesson.videoId}.mp4`;const response=await fetch(local,{method:'HEAD'});if(response.ok){videoLoaded(local);return;}
   }
   const YT=await ytApi();$('#source-player').innerHTML='<div id="youtube-embed"></div>';
   yt=new YT.Player('youtube-embed',{host:'https://www.youtube-nocookie.com',videoId:lesson.videoId,playerVars:{playsinline:1,origin:location.origin,start:Math.floor(lesson.moves[index].start),rel:0},events:{onReady:()=>{enableSource();const rates=yt.getAvailablePlaybackRates();[...$('#source-speed').options].forEach(o=>o.disabled=!rates.includes(Number(o.value)));const requested=Number($('#source-speed').value);yt.setPlaybackRate(rates.includes(requested)?requested:1);if(!rates.includes(requested))$('#source-speed').value='1';},onError:()=>{$('#source-status').textContent='YouTube could not play this embed. Open it on YouTube or use a downloaded video.';}}});
  }catch(error){$('#source-status').textContent=error.message;}finally{loading=false;}
 });
 $('#local-video').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);videoLoaded(objectUrl);modeChange('source');});
 $$('[data-video-step]').forEach(b=>b.addEventListener('click',()=>{const m=lesson.moves[index],delta=Number(b.dataset.videoStep);if(video){video.pause();video.currentTime=Math.max(m.start,Math.min(m.end,video.currentTime+delta));}if(yt&&sourceReady){yt.pauseVideo();yt.seekTo(Math.max(m.start,Math.min(m.end,yt.getCurrentTime()+delta)),true);}}));
 $('#source-speed').addEventListener('change',e=>{if(video)video.playbackRate=Number(e.target.value);if(yt&&sourceReady)yt.setPlaybackRate(Number(e.target.value));});
 $('#source-play').addEventListener('click',()=>{if(video){if(video.paused)video.play().catch(()=>{});else video.pause();}else if(yt&&sourceReady){if(yt.getPlayerState()===1)yt.pauseVideo();else yt.playVideo();}});
 $('#source-seek').addEventListener('input',e=>{const m=lesson.moves[index],position=m.start+(m.end-m.start)*Number(e.target.value)/1000;if(video){video.pause();video.currentTime=position;}if(yt&&sourceReady){yt.pauseVideo();yt.seekTo(position,true);}});
 $('[data-source-focus]').addEventListener('click',()=>{if(!focus)return;focus.setEnabled(!focus.enabled);$('[data-source-focus]').setAttribute('aria-pressed',String(focus.enabled));});
 function closeSourceTheater(){if(!sourceDialog)return;if(document.fullscreenElement===$('#source-panel'))document.exitFullscreen().catch(()=>{});sourcePlaceholder.replaceWith($('#source-panel'));sourceDialog.close();sourceDialog.remove();sourceDialog=null;$('#source-panel').classList.remove('source-expanded');$('[data-source-expand]').textContent='Expand';$('[data-source-expand]').focus();}
 $('[data-source-expand]').addEventListener('click',()=>{if(sourceDialog){closeSourceTheater();return;}sourcePlaceholder=document.createComment('source player');$('#source-panel').before(sourcePlaceholder);sourceDialog=document.createElement('dialog');sourceDialog.className='player-theater source-theater';sourceDialog.setAttribute('aria-label','Expanded source video');document.body.append(sourceDialog);sourceDialog.append($('#source-panel'));$('#source-panel').classList.add('source-expanded');$('[data-source-expand]').textContent='Close';sourceDialog.addEventListener('cancel',e=>{e.preventDefault();closeSourceTheater();});sourceDialog.showModal();});
 $('[data-source-fullscreen]').addEventListener('click',async()=>{try{if(document.fullscreenElement=== $('#source-panel'))await document.exitFullscreen();else await $('#source-panel').requestFullscreen();}catch{if(!sourceDialog)$('[data-source-expand]').click();}});
 document.addEventListener('fullscreenchange',()=>{$('[data-source-fullscreen]').textContent=document.fullscreenElement===$('#source-panel')?'Exit full screen':'Full screen';});

 const sourceTick=()=>{if(sourceReady&&video)checkLocalSegment(video);if(sourceReady){const m=lesson.moves[index],position=video?video.currentTime:yt?.getCurrentTime?.()||m.start;$('#source-seek').value=String(Math.round(Math.max(0,Math.min(1,(position-m.start)/(m.end-m.start)))*1000));$('#source-time').value=`${time(position)} / ${time(m.end)}`;const playing=video?!video.paused:yt?.getPlayerState?.()===1;$('#source-play').textContent=playing?'Ⅱ':'▶';$('#source-play').setAttribute('aria-label',playing?'Pause source':'Play source');}if(!yt||!sourceReady)return;const m=lesson.moves[index],state=yt.getPlayerState();if((state===1&&yt.getCurrentTime()>=m.end)||(state===0&&yt.getCurrentTime()>=m.end-.3)){if(advance('source'))return;if($('#source-loop').checked){yt.seekTo(m.start,true);yt.playVideo();}else yt.pauseVideo();}};
 let loopTimer=setInterval(sourceTick,200);
 addEventListener('pageshow',event=>{if(event.persisted){clearInterval(loopTimer);loopTimer=setInterval(sourceTick,200);}});
 addEventListener('pagehide',event=>{clearInterval(loopTimer);video?.pause();yt?.pauseVideo?.();if(!event.persisted)focus?.dispose();if(objectUrl&&!event.persisted)URL.revokeObjectURL(objectUrl);});
 const initial=Number(new URLSearchParams(location.search).get('move')||0);updateMove(Number.isFinite(initial)?Math.floor(initial):0,false);
 modeChange('diagram');
}

if($('#lab-player')){
 const params=new URLSearchParams(location.search),timing=params.get('timing');if([...$('#lab-timing').options].some(o=>o.value===timing))$('#lab-timing').value=timing;
 const p=new MotionPlayer($('#lab-player'),{kind:'isolation',timing:$('#lab-timing').value},{id:'lab'});
 const texts={isolation:['Isolation','The hand travels around the anchored end. Its orbit radius is the distance from the grip to that end.','sGrt1Uj8Ud4'],extension:['Extension','A larger hand circle carries the staff around. There is no added wrist rotation relative to the arm.','L9DO8BIlXrs'],antispin:['Antispin','The hands circle one way while the shafts rotate the other. In the equal-radius model, the two ends trace perpendicular lines. Count both ends.','pRoRKPIewhE'],inspin:['Inspin','The hands and shafts turn in the same direction. The inward end alternates at the quarter points.','fb3CTGPTGyw'],rtype:['R-type','The hand travels around its circle while the shaft keeps its absolute angle. Notice how both tip paths translate.','MtpXzCSQBXA'],hybrid:['Isolation + antispin','One hand isolates; the other antispins. Watch hand timing separately from shaft direction.','nrYl22Z7bQ8'],antibrid:['Antibrid','The moving grip follows the other staff’s thumb end. This front alignment study leaves the reel’s exact front–back route to the source.','8ScYjUsv4LQ']};
 let catalog=[];catalogPromise().then(s=>{catalog=s.flatMap(x=>x.entries);refresh();}).catch(()=>{});
 function refresh(){const kind=$('#lab-pattern').value;const timing=$('#lab-timing').value,plane=timing==='split-same'&&['isolation','extension','antispin','inspin'].includes(kind)?'wheel':'wall';p.setSpec({kind,timing,plane});const [title,body,id]=texts[kind];$('#lab-title').textContent=title;$('#lab-description').textContent=body;const l=catalog.find(x=>x.videoId===id);if(l)$('#lab-lesson').href=l.href;$('#lab-timing').disabled=kind==='antibrid';}
 $('#lab-pattern').addEventListener('change',refresh);$('#lab-timing').addEventListener('change',refresh);refresh();
}
$$('[data-timing]').forEach(el=>{
 const mode=el.dataset.timing,angles=timingAngles(.1,mode);
 const x=a=>120+62*Math.sin(a),y=a=>90-62*Math.cos(a);
 el.innerHTML=`<svg viewBox="0 0 240 180" aria-hidden="true"><circle cx="120" cy="90" r="62" fill="none" stroke="var(--line)" stroke-dasharray="3 5"/><path d="M40 90h160M120 10v160" stroke="var(--line)"/><circle cx="${x(angles[0])-4}" cy="${y(angles[0])}" r="7" fill="var(--green)"/><circle cx="${x(angles[1])+4}" cy="${y(angles[1])}" r="7" fill="var(--orange)"/><text x="120" y="98" text-anchor="middle" fill="var(--muted)" font-size="22">${mode.endsWith('opposite')?'↻ ↺':'↻ ↻'}</text></svg>`;
});
$$('[data-flower]').forEach(el=>{const anti=el.dataset.flower==='antispin',points=Array.from({length:361},(_,i)=>{const a=i/360*TAU,b=(anti?-3:3)*a;return `${120+48*Math.sin(a)+48*Math.sin(b)},${120+48*Math.cos(a)+48*Math.cos(b)}`;}).join(' ');el.innerHTML=`<svg viewBox="0 0 240 240" role="img" aria-label="${anti?'Four-petal antispin':'Two-petal inspin'} reference curve"><circle cx="120" cy="120" r="96" stroke="var(--line)" fill="none"/><polyline points="${points}" stroke="${anti?'var(--orange)':'var(--green)'}" stroke-width="2" fill="none"/></svg><span>${anti?'Four-petal antispin':'Two-petal inspin'} · one end</span>`;});
