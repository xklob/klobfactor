import {sampleMotion,project,mod,TAU} from './motion.mjs';
const colors=['#167b73','#cf6743'];
const clean=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n.toFixed(2));
export class MotionPlayer {
  constructor(root,spec={},opts={}) {
    this.root=root;this.spec=spec;this.phase=0;this.speed=.5;this.playing=false;this.view=spec.view||'front';this.mirror=false;this.trails=true;this.body=true;this.loop=true;this.opts=opts;this.previous=0;
    root.innerHTML=`<div class="stage-toolbar"><span class="diagram-label">${opts.mini?'PATTERN STUDY':'INTERACTIVE DIAGRAM'}</span><div class="view-buttons" role="group" aria-label="Diagram view"><button data-view="front" aria-pressed="true">Front</button><button data-view="side" aria-pressed="false">Side</button><button data-view="top" aria-pressed="false">Top</button><button data-view="perspective" aria-pressed="false">3D</button></div></div><div class="stage"><svg class="motion-svg" viewBox="0 0 800 520" role="img" aria-label="Animated double staff diagram"><defs><pattern id="grid-${opts.id||'main'}" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d9ddd6"/></pattern></defs><rect width="800" height="520" fill="url(#grid-${opts.id||'main'})"/><g class="trail-layer"></g><g class="body-layer"></g><g class="staff-layer"></g><g class="annotation-layer"></g></svg><span class="view-note">Audience view · your left is on the right</span></div><div class="study-caption" aria-live="off" hidden></div><div class="diagram-legend"><span><i class="dot left"></i> Left hand</span><span><i class="dot right"></i> Right hand</span><span>● Thumb end</span><span>○ Pinky end</span></div><div class="playback"><div class="transport"><button class="icon-button" data-action="restart" aria-label="Restart cycle" title="Restart cycle">↺</button><button class="icon-button" data-action="back" aria-label="Step backward one eighth of a cycle" title="Step backward">‹</button><button class="play-button" data-action="play" aria-label="Play animation">▶</button><button class="icon-button" data-action="forward" aria-label="Step forward one eighth of a cycle" title="Step forward">›</button><label class="speed-label"><span class="sr-only">Playback speed</span><select aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5" selected>0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><button data-action="loop" class="loop-button" aria-pressed="true">Loop</button></div><div class="scrubber"><input type="range" min="0" max="1000" value="0" step="1" aria-label="Cycle position"><output>0%</output></div></div><div class="display-options"><label><input type="checkbox" data-option="trails" checked> Tip paths</label><label><input type="checkbox" data-option="body" checked> Body guide</label><label><input type="checkbox" data-option="mirror"> Mirror view</label></div><p class="model-note" hidden></p>`;
    this.svg=root.querySelector('svg');this.range=root.querySelector('input[type=range]');this.output=root.querySelector('output');this.button=root.querySelector('[data-action=play]');
    root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view){this.view=b.dataset.view;root.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));this.rebuild();}const a=b.dataset.action;if(a==='play')this.toggle();if(a==='restart')this.seek(0);if(a==='back')this.step(-1);if(a==='forward')this.step(1);if(a==='loop'){this.loop=!this.loop;b.setAttribute('aria-pressed',String(this.loop));}});
    this.range.addEventListener('input',()=>this.seek(Number(this.range.value)/1000));
    root.querySelector('select').addEventListener('change',e=>{this.speed=Number(e.target.value);});
    root.querySelectorAll('[data-option]').forEach(input=>input.addEventListener('change',()=>{this[input.dataset.option]=input.checked;this.rebuild();}));
    root.tabIndex=0;root.setAttribute('aria-label','Motion player. Space to play or pause. Arrow keys to step.');
    root.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(e.code==='Space'){e.preventDefault();this.toggle();}if(e.key==='ArrowRight'){e.preventDefault();this.step(1);}if(e.key==='ArrowLeft'){e.preventDefault();this.step(-1);}});
    this.rebuild();this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
  }
  setSpec(spec){this.spec=spec;this.phase=0;if(spec.view)this.view=spec.view;this.rebuild();}
  step(direction){const count=this.spec.frames?.length;if(count){const index=Math.min(count-1,Math.floor(this.phase*count));this.seek((mod(index+direction,count)+.001)/count);}else this.seek(mod(this.phase+direction*.125));}
  toggle(){this.playing=!this.playing;this.previous=0;this.updateButton();}
  updateButton(){this.button.textContent=this.playing?'Ⅱ':'▶';this.button.setAttribute('aria-label',this.playing?'Pause animation':'Play animation');}
  seek(n){this.phase=n;this.playing=false;this.updateButton();this.render();}
  tick(now){if(this.playing && this.previous){this.phase+=(Math.min(now-this.previous,100)/6000)*this.speed;if(this.phase>=1){if(this.opts.onComplete?.()){this.previous=now;this.raf=requestAnimationFrame(this.tick);return;}if(this.loop)this.phase=mod(this.phase);else{this.phase=1;this.playing=false;this.updateButton();}}this.render();}this.previous=now;this.raf=requestAnimationFrame(this.tick);}
  p(p){return project(p,this.view,!this.mirror);}
  line(a,b,attrs=''){const p=this.p(a),q=this.p(b);return `<line x1="${fmt(p[0])}" y1="${fmt(p[1])}" x2="${fmt(q[0])}" y2="${fmt(q[1])}" ${attrs}/>`;}
  circle(p,r,attrs=''){const q=this.p(p);return `<circle cx="${fmt(q[0])}" cy="${fmt(q[1])}" r="${r}" ${attrs}/>`;}
  rebuild(){
    const paths=[];
    if(this.trails&&this.spec.kind!=='study'&&!this.spec.handsOnly)for(let i=0;i<(this.spec.solo?1:2);i++)for(const end of ['thumb','pinky']){
      const pts=Array.from({length:181},(_,j)=>this.p(sampleMotion(this.spec,j/180).hands[i][end]).slice(0,2).map(fmt).join(',')).join(' ');
      paths.push(`<polyline points="${pts}" fill="none" stroke="${colors[i]}" stroke-width="1.5" opacity="${end==='thumb'?'.3':'.15'}" ${end==='pinky'?'stroke-dasharray="3 5"':''}/>`);
    }
    this.svg.querySelector('.trail-layer').innerHTML=paths.join('');
    this.root.querySelector('.diagram-label').textContent=this.spec.label||(this.opts.mini?'PATTERN STUDY':'INTERACTIVE DIAGRAM');
    this.root.querySelector('[data-option=trails]').closest('label').hidden=this.spec.kind==='study'||this.spec.handsOnly;
    this.root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===this.view)));
    this.root.querySelector('.model-note').textContent=this.spec.note||'';
    this.root.querySelector('.model-note').hidden=!this.spec.note;
    const single=this.spec.frames?.length===1;
    for(const el of this.root.querySelectorAll('[data-action=play],[data-action=back],[data-action=forward],input[type=range]'))el.disabled=single;
    this.render();
  }
  render(){
    const state=sampleMotion(this.spec,this.phase);
    if(this.spec.solo)state.hands=state.hands.slice(0,1);
    let body='';
    if(this.body){
      if(this.view==='top')body=this.circle([0,.5,0],28,'fill="#e8e9e4" stroke="#c7ccc3"');
      else{
        body+=this.circle([0,1.92,0],22,'fill="#e8e9e4" stroke="#c7ccc3" stroke-width="2"');
        for(const [a,b,w]of [[[0,1.64,0],[0,.0,0],25],[[-.45,1.3,0],[.45,1.3,0],18],[[0,.02,0],[-.42,-1.65,0],16],[[0,.02,0],[.42,-1.65,0],16],[[-.42,-1.65,0],[-.63,-1.7,.22],12],[[.42,-1.65,0],[.63,-1.7,.22],12]])body+=this.line(a,b,`stroke="#d8ddd4" stroke-width="${w}" stroke-linecap="round"`);
        state.hands.forEach((h,i)=>{const s=[i?.45:-.45,1.3,0],c=h.center;const elbow=[(s[0]+c[0])*.5+(i?.2:-.2),(s[1]+c[1])*.5-.23,(s[2]+c[2])*.5];body+=this.line(s,elbow,'stroke="#bec8bc" stroke-width="10" stroke-linecap="round"')+this.line(elbow,c,'stroke="#bec8bc" stroke-width="8" stroke-linecap="round"');});
        body+=this.line([-.92,-1.82,0],[.92,-1.82,0],'stroke="#d0d5cb" stroke-width="1.5"');
      }
    }
    this.svg.querySelector('.body-layer').innerHTML=body;
    const hands=[...state.hands].sort((a,b)=>this.p(a.center)[2]-this.p(b.center)[2]);
    const overlap=hands.length===2&&Math.hypot(...this.p(hands[0].center).slice(0,2).map((v,i)=>v-this.p(hands[1].center)[i]))<4;
    this.svg.querySelector('.staff-layer').innerHTML=hands.map(h=>{
      const i=h.side==='left'?0:1,c=colors[i],behind=h.center[2]<-.05;
      const width=overlap?(i?3:9):6,radius=overlap?(i?6:12):10;
      const shaft=this.spec.handsOnly?'':(!overlap?this.line(h.pinky,h.thumb,`stroke="white" stroke-width="11" stroke-linecap="round"`):'')+this.line(h.pinky,h.thumb,`stroke="${c}" stroke-width="${width}" stroke-linecap="round" ${behind?'stroke-dasharray="9 5"':''}`)+this.circle(h.pinky,overlap?(i?4:8):6,`fill="#fafbf7" stroke="${c}" stroke-width="2"`)+this.circle(h.thumb,overlap?(i?4:9):7,`fill="${c}" stroke="white" stroke-width="1.5"`);
      return shaft+this.circle(h.center,radius,`fill="white" stroke="${c}" stroke-width="3"`)+this.circle(h.center,3,`fill="${c}"`);
    }).join('');
    let annotations=state.hands.map((h,i)=>{const p=this.p(h.center);return `<text x="${fmt(p[0]+(overlap&&!i?-24:15))}" y="${fmt(p[1]-14)}" fill="${colors[i]}" font-size="13" font-weight="650">${i?'R':'L'}${h.center[2]<-.05?' · rear':''}</text>`;}).join('');
    const frames=this.spec.frames||[],frameIndex=Math.min(frames.length-1,Math.floor(this.phase*frames.length)),frame=frames[frameIndex];
    const landmarks=this.spec.landmarks||[];
    for(const [from,to] of this.spec.edges||[]){const a=landmarks.find(p=>p.id===from),b=landmarks.find(p=>p.id===to);if(a&&b)annotations+=this.line(a.position,b.position,'stroke="#a7b5a5" stroke-width="1.5" stroke-dasharray="4 5"');}
    for(const mark of landmarks){
      const active=frame?.active?.includes(mark.id),p=this.p(mark.position),left=p[0]<395;
      annotations+=this.circle(mark.position,active?10:6,`fill="${active?'#167b73':'#f6f7f2'}" stroke="#167b73" stroke-width="2"`);
      annotations+=`<text x="${fmt(p[0]+(left?-17:17))}" y="${fmt(p[1]-10)}" text-anchor="${left?'end':'start'}" fill="${active?'#153d33':'#65745e'}" font-size="13" font-weight="${active?'700':'500'}">${clean(mark.label)}</text>`;
    }
    this.svg.querySelector('.annotation-layer').innerHTML=annotations;
    const caption=this.root.querySelector('.study-caption');caption.hidden=!frame;caption.innerHTML=frame?`<strong>${clean(frame.title)}</strong><p>${clean(frame.caption)}</p>`:'';
    this.root.querySelector('.diagram-legend').hidden=this.spec.kind==='study'&&!state.hands.length;
    this.range.value=String(Math.round(this.phase*1000));this.output.value=`${Math.round(this.phase*100)}%`;
    this.range.setAttribute('aria-valuetext',`${Math.round(this.phase*100)} percent through the cycle`);
    if(frame){this.output.value=`${frameIndex+1} / ${frames.length}`;this.range.setAttribute('aria-valuetext',`Checkpoint ${frameIndex+1} of ${frames.length}: ${frame.title}`);}
    this.root.querySelector('.view-note').textContent=this.view==='front'?(this.mirror?'Mirror view · your left is on the left':'Audience view · your left is on the right'):this.view==='side'?'Side view · depth is visible':this.view==='perspective'?'3D view · schematic depth':'Top view · looking down at the planes';
    this.root.dataset.phase=this.phase.toFixed(4);this.root.dataset.playing=String(this.playing);
  }
  destroy(){cancelAnimationFrame(this.raf);}
}
