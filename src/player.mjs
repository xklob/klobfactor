import {sampleMotion,mod} from './motion.mjs';
import {StaffScene} from './scene.mjs';
const clean=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class MotionPlayer {
  constructor(root,spec={},opts={}) {
    Object.assign(this,{root,spec,opts,phase:0,speed:.5,playing:false,view:'isometric',mirror:false,trails:false,body:true,xray:false,inset:false,insetHand:0,loop:true,previous:0});
    root.innerHTML=`
      <div class="stage-toolbar">
        <label class="camera-preset"><span class="sr-only">Camera view</span><select aria-label="Camera view" data-camera><option value="isometric">Isometric</option><option value="front">Front</option><option value="side">Side</option><option value="top">Top</option><option value="free" disabled>Custom view</option></select></label>
        <div class="viewer-actions"><button data-action="inset" aria-pressed="false">Grip inset</button><button data-action="expand" aria-expanded="false">Expand</button></div>
      </div>
      <div class="stage">
        <div class="scene-labels" aria-hidden="true"></div>
        <span class="scene-status"></span>
        <div class="grip-picture" hidden><div class="grip-picture-head"><label><span class="sr-only">Inset hand</span><select aria-label="Inset hand"><option value="0">Left hand</option><option value="1">Right hand</option></select></label><button data-action="inset" aria-label="Close grip inset">×</button></div><div class="grip-window" tabindex="0" aria-label="Grip close-up. Drag to rotate, scroll to zoom."></div><div class="grip-labels"></div></div>
        <span class="view-note">Isometric</span>
        <div class="stage-zoom"><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="reset-camera" aria-label="Reset camera">↺</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div>
      </div>
      <div class="study-caption" aria-live="off" hidden></div>
      <div class="diagram-legend"><span><i class="dot left"></i> L</span><span><i class="dot right"></i> R</span><span class="thumb-key">● Thumb</span><span class="pinky-key">○ Pinky</span></div>
      <div class="playback"><div class="transport"><button class="icon-button" data-action="restart" aria-label="Restart cycle">↺</button><button class="icon-button" data-action="back" aria-label="Step backward one eighth of a cycle">‹</button><button class="play-button" data-action="play" aria-label="Play animation">▶</button><button class="icon-button" data-action="forward" aria-label="Step forward one eighth of a cycle">›</button><label class="speed-label"><span class="sr-only">Playback speed</span><select aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5" selected>0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><button data-action="loop" class="loop-button" aria-pressed="true">Loop</button></div><div class="scrubber"><input type="range" min="0" max="1000" value="0" step="1" aria-label="Cycle position"><output>0%</output></div></div>
      ${opts.onMoveStep?'<div class="expanded-move-controls"><button data-action="previous-move">← Previous section</button><span class="expanded-move-title"></span><button data-action="next-move">Next section →</button></div>':''}
      <details class="view-options"><summary>View options</summary><div class="display-options"><label><input type="checkbox" data-option="trails"> Tip paths</label><label><input type="checkbox" data-option="body" checked> Body guide</label><label><input type="checkbox" data-option="xray"> See through body</label><label><input type="checkbox" data-option="mirror"> Mirror view</label></div><div class="camera-actions"><button data-action="focus-left">Focus left grip</button><button data-action="focus-right">Focus right grip</button><button data-action="fullscreen">Full screen</button></div><p class="camera-help">Drag to orbit · Scroll / pinch to zoom · Right-drag / two fingers to pan.<br>Keyboard: WASD orbits, + / − zooms, R resets. Space plays; ← / → step.</p></details>
      <p class="model-note" hidden></p>`;
    this.range=root.querySelector('input[type=range]');this.output=root.querySelector('output');this.button=root.querySelector('[data-action=play]');
    this.preset=root.querySelector('[data-camera]');
    try {this.scene=new StaffScene(root.querySelector('.stage'),()=>{this.view='free';this.preset.value='free';this.updateViewNote();});}
    catch(error) {root.querySelector('.scene-status').textContent='3D unavailable. Use the source video.';root.dataset.renderer='unavailable';console.warn('3D viewer unavailable:',error.message);}
    this.preset.addEventListener('change',()=>this.setView(this.preset.value));
    root.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;const action=button.dataset.action;
      if(action==='play')this.toggle();
      if(action==='restart')this.seek(0);
      if(action==='back')this.step(-1);
      if(action==='forward')this.step(1);
      if(action==='loop'){this.loop=!this.loop;button.setAttribute('aria-pressed',String(this.loop));}
      if(action==='inset'){this.inset=!this.inset;root.querySelector('[data-action=inset]').setAttribute('aria-pressed',String(this.inset));this.render();}
      if(action==='zoom-in')this.scene?.zoom(1.25);
      if(action==='zoom-out')this.scene?.zoom(.8);
      if(action==='reset-camera')this.setView('isometric');
      if(action==='focus-left')this.scene?.focusHand(0);
      if(action==='focus-right')this.scene?.focusHand(1);
      if(action==='expand')this.toggleTheater();
      if(action==='fullscreen')this.toggleFullscreen();
      if(action==='previous-move')this.opts.onMoveStep?.(-1);
      if(action==='next-move')this.opts.onMoveStep?.(1);
    });
    this.range.addEventListener('input',()=>this.seek(Number(this.range.value)/1000));
    root.querySelector('[aria-label="Playback speed"]').addEventListener('change',e=>{this.speed=Number(e.target.value);});
    root.querySelector('[aria-label="Inset hand"]').addEventListener('change',e=>{this.insetHand=Number(e.target.value);this.render();});
    root.querySelectorAll('[data-option]').forEach(input=>input.addEventListener('change',()=>{this[input.dataset.option]=input.checked;this.render();}));
    root.tabIndex=0;root.setAttribute('aria-label','Motion player');
    root.addEventListener('keydown',e=>{
      if(e.target.matches('input,select,button,summary'))return;
      if(e.code==='Space'){e.preventDefault();this.toggle();}
      if(e.key==='ArrowRight'){e.preventDefault();this.step(1);}
      if(e.key==='ArrowLeft'){e.preventDefault();this.step(-1);}
      const key=e.key.toLowerCase();
      if(key==='r')this.setView('isometric');
      if(key==='+'||key==='=')this.scene?.zoom(1.15);
      if(key==='-')this.scene?.zoom(1/1.15);
      if(this.scene&&'wasd'.includes(key)&&key.length===1){e.preventDefault();const c=e.target.closest('.grip-picture')?this.scene.insetControls:this.scene.controls;if(key==='a')c.rotateLeft(.12);if(key==='d')c.rotateLeft(-.12);if(key==='w')c.rotateUp(.12);if(key==='s')c.rotateUp(-.12);c.update();}
    });
    this.fullscreenChange=()=>{root.classList.toggle('is-fullscreen',document.fullscreenElement===root);root.querySelector('[data-action=fullscreen]').textContent=document.fullscreenElement===root?'Exit full screen':'Full screen';this.scene?.resize();};
    document.addEventListener('fullscreenchange',this.fullscreenChange);
    this.rebuild();this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
    addEventListener('pagehide',()=>this.destroy());
    addEventListener('pageshow',event=>{if(event.persisted){
      this.root.querySelector('canvas')?.remove();
      try {this.scene=new StaffScene(this.root.querySelector('.stage'),()=>{this.view='free';this.preset.value='free';this.updateViewNote();});}catch {}
      this.setView('isometric');this.rebuild();this.previous=0;
      document.addEventListener('fullscreenchange',this.fullscreenChange);this.raf=requestAnimationFrame(this.tick);
    }});
  }
  setSpec(spec) {this.spec=spec;this.phase=0;this.rebuild();}
  setView(view) {this.view=view;this.scene?.setView(view);this.preset.value=view;this.updateViewNote();}
  updateViewNote() {this.root.querySelector('.view-note').textContent=`${this.mirror?'Mirror · ':''}${({isometric:'Isometric',front:'Front',side:'Side',top:'Top',free:'Custom view'})[this.view]}`;}
  toggleTheater() {
    if(this.dialog){this.closeTheater();return;}
    this.placeholder=document.createComment('player');this.root.before(this.placeholder);
    this.dialog=document.createElement('dialog');this.dialog.className='player-theater';this.dialog.setAttribute('aria-label','Expanded motion viewer');
    document.body.append(this.dialog);this.dialog.append(this.root);this.root.classList.add('is-expanded');
    this.root.querySelector('[data-action=expand]').textContent='Close';this.root.querySelector('[data-action=expand]').setAttribute('aria-expanded','true');
    this.oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.closeTheater();});
    this.dialog.showModal();this.scene?.resize();this.root.querySelector('[data-action=expand]').focus();
  }
  closeTheater() {
    if(!this.dialog)return;
    if(document.fullscreenElement===this.root)document.exitFullscreen().catch(()=>{});
    this.placeholder.replaceWith(this.root);this.dialog.close();this.dialog.remove();this.dialog=null;
    this.root.classList.remove('is-expanded');document.body.style.overflow=this.oldOverflow;
    const button=this.root.querySelector('[data-action=expand]');button.textContent='Expand';button.setAttribute('aria-expanded','false');button.focus();this.scene?.resize();
  }
  async toggleFullscreen() {
    if(document.fullscreenElement===this.root){await document.exitFullscreen();return;}
    try {if(!this.root.requestFullscreen)throw new Error('Fullscreen unsupported');await this.root.requestFullscreen();}
    catch {if(!this.dialog)this.toggleTheater();this.root.querySelector('.view-note').textContent='Expanded view · full screen unavailable';}
  }
  step(direction) {const count=this.spec.frames?.length;if(count){const index=Math.min(count-1,Math.floor(this.phase*count));this.seek((mod(index+direction,count)+.001)/count);}else this.seek(mod(this.phase+direction*.125));}
  toggle() {this.playing=!this.playing;this.previous=0;this.updateButton();}
  updateButton() {this.button.textContent=this.playing?'Ⅱ':'▶';this.button.setAttribute('aria-label',this.playing?'Pause animation':'Play animation');}
  seek(n) {this.phase=n;this.playing=false;this.updateButton();this.render();}
  tick(now) {
    if(this.playing&&this.previous){
      this.phase+=(Math.min(now-this.previous,100)/6000)*this.speed;
      if(this.phase>=1){if(this.opts.onComplete?.()){this.previous=now;this.raf=requestAnimationFrame(this.tick);return;}if(this.loop)this.phase=mod(this.phase);else{this.phase=1;this.playing=false;this.updateButton();}}
      this.render();
    }
    this.previous=now;this.raf=requestAnimationFrame(this.tick);
  }
  rebuild() {
    this.scene?.configure(this.spec);
    const note=this.root.querySelector('.model-note');note.textContent=this.spec.note||'';note.hidden=!this.spec.note;
    const single=this.spec.frames?.length===1;
    for(const el of this.root.querySelectorAll('[data-action=play],[data-action=back],[data-action=forward],input[type=range]'))el.disabled=single;
    this.root.querySelector('[data-option=trails]').closest('label').hidden=this.spec.kind==='study'||this.spec.handsOnly;
    const title=this.root.querySelector('.expanded-move-title');if(title)title.textContent=this.spec.title||'';
    for(const [name,delta]of [['previous-move',-1],['next-move',1]]){const button=this.root.querySelector(`[data-action=${name}]`);if(button)button.disabled=this.opts.canMove?!this.opts.canMove(delta):false;}
    this.render();
  }
  render() {
    const state=sampleMotion(this.spec,this.phase);
    this.scene?.update(state,{body:this.body,trails:this.trails,mirror:this.mirror,xray:this.xray,inset:this.inset,insetHand:this.insetHand});
    const frames=this.spec.frames||[],index=Math.min(frames.length-1,Math.floor(this.phase*frames.length)),frame=frames[index]||state.cue;
    const caption=this.root.querySelector('.study-caption');caption.hidden=!frame;caption.innerHTML=frame?`<strong>${clean(frame.title)}</strong><p>${clean(frame.caption)}</p>`:'';
    this.root.querySelector('.diagram-legend').hidden=!state.hands.length;
    this.root.querySelector('[data-action=inset]').disabled=!state.hands.length;
    this.root.querySelector('[data-action=focus-left]').disabled=!state.hands.length;
    this.root.querySelector('[data-action=focus-right]').disabled=state.hands.length<2;
    this.range.value=String(Math.round(this.phase*1000));this.output.value=frames.length?`${index+1} / ${frames.length}`:`${Math.round(this.phase*100)}%`;
    this.range.setAttribute('aria-valuetext',frames.length?`Checkpoint ${index+1} of ${frames.length}: ${frame.title}`:`${Math.round(this.phase*100)} percent through the cycle`);
    if(this.scene){const n=state.hands.length,overlap=this.root.querySelector('.stage').dataset.overlap==='true';this.root.querySelector('.scene-status').textContent=n===1?'1 staff · solo drill':n===2?(overlap?'2 staves · overlap in this view':'2 staves'):'';}
    this.root.querySelector('[aria-label="Inset hand"] option[value="1"]').disabled=state.hands.length<2;
    if(state.hands.length<2)this.insetHand=0;
    this.root.querySelector('[aria-label="Inset hand"]').value=String(this.insetHand);
    this.updateViewNote();this.root.dataset.phase=this.phase.toFixed(4);this.root.dataset.playing=String(this.playing);
  }
  destroy() {cancelAnimationFrame(this.raf);this.closeTheater();this.scene?.destroy();this.scene=null;this.playing=false;this.updateButton();document.removeEventListener('fullscreenchange',this.fullscreenChange);}
}
