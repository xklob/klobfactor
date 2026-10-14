import {MotionPlayer} from '/assets/player.mjs';
const catalog=await fetch('/assets/catalog.json').then(r=>r.json());
const lessons=catalog.flatMap(s=>s.entries),params=new URLSearchParams(location.search);
let lesson=lessons.find(l=>l.id===params.get('lesson'))||lessons[0],index=-1;
const send=(name,...args)=>window.Trainer?.[name]?.(...args);
const p=new MotionPlayer(document.querySelector('#trainer-player'),{}, {
 id:'android',
 canMove:direction=>index+direction>=0&&index+direction<lesson.moves.length,
 onMoveStep:direction=>select(lesson.id,index+direction,true),
 onComplete:()=>{
  if(!window.trainer.autoAdvance||index>=lesson.moves.length-1)return false;
  select(lesson.id,index+1,true);
  p.playing=!!lesson.moves[index].motion&&!p.referenceOnly;p.updateButton();return true;
 }
});
function select(id,n,notify=false){
 const next=lessons.find(l=>l.id===id);if(!next)return;
 n=Math.max(0,Math.min(next.moves.length-1,Number(n)||0));
 if(lesson.id===id&&index===n)return;
 lesson=next;index=n;const m=lesson.moves[index];
 p.playing=false;p.updateButton();
 p.root.hidden=!m.motion;document.querySelector('#unavailable').hidden=!!m.motion;
 if(m.motion)p.setSpec({...m.motion,title:m.name});else {window.nativeExit?.();p.closeTheater();}
 document.body.dataset.lesson=lesson.id;document.body.dataset.move=String(index);
 if(notify)send('moveTo',index);
}
window.trainer={select,autoAdvance:false,pause:()=>{p.playing=false;p.updateButton();},close:()=>window.nativeExit?.(),destroy:()=>p.destroy()};
// The native shell expands the WebView to the available screen for either action.
p.toggleFullscreen=()=>p.toggleTheater();
select(window.nativeState?.id||lesson.id,window.nativeState?.move??Number(params.get('move')||0));
window.trainer.autoAdvance=window.nativeState?.auto||false;
document.body.dataset.ready='true';send('ready');
