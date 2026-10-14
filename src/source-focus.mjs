// A crop of the actual local video frame. No mirroring or reconstructed pose.
export class SourceFocus {
 constructor(root,video,onClose){
  this.root=root;this.video=video;this.center=[.5,.5];this.zoom=3;this.enabled=false;this.onClose=onClose;
  this.box=document.createElement('div');this.box.className='source-focus';this.box.hidden=true;
  this.box.innerHTML='<div class="source-focus-head"><button data-pick>Pick area</button><button data-close aria-label="Close video close-up">×</button></div><canvas tabindex="0" aria-label="Video close-up. Drag or use arrow keys to pan; scroll or use plus and minus to zoom."></canvas><span>Drag to pan · Scroll to zoom</span>';
  root.append(this.box);this.canvas=this.box.querySelector('canvas');this.context=this.canvas.getContext('2d');
  this.pick=document.createElement('button');this.pick.className='source-pick';this.pick.setAttribute('aria-label','Choose an area of the source video');this.pick.hidden=true;root.append(this.pick);
  this.box.querySelector('[data-close]').onclick=()=>{this.setEnabled(false);onClose?.();};
  this.box.querySelector('[data-pick]').onclick=()=>{this.pick.hidden=!this.pick.hidden;};
  this.pick.onclick=e=>{const r=root.getBoundingClientRect(),ratio=video.videoWidth/video.videoHeight,w=Math.min(r.width,r.height*ratio),h=w/ratio;this.center=[(e.clientX-r.left-(r.width-w)/2)/w,(e.clientY-r.top-(r.height-h)/2)/h];this.pick.hidden=true;this.draw();};
  this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(1,Math.min(10,this.zoom*Math.exp(-e.deltaY*.002)));this.draw();},{passive:false});
  this.canvas.addEventListener('pointerdown',e=>{this.drag=[e.clientX,e.clientY];this.canvas.setPointerCapture(e.pointerId);});
  this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;const r=this.canvas.getBoundingClientRect(),crop=this.crop();this.center[0]-=(e.clientX-this.drag[0])/r.width*crop.w/video.videoWidth;this.center[1]-=(e.clientY-this.drag[1])/r.height*crop.h/video.videoHeight;this.drag=[e.clientX,e.clientY];this.draw();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(name,()=>this.drag=null);
  this.canvas.addEventListener('keydown',e=>{const directions={ArrowLeft:[-.03,0],ArrowRight:[.03,0],ArrowUp:[0,-.03],ArrowDown:[0,.03]};if(directions[e.key]){e.preventDefault();this.center=this.center.map((v,i)=>v+directions[e.key][i]);this.draw();}else if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoom=Math.max(1,Math.min(10,this.zoom*(e.key==='-'?.8:1.25)));this.draw();}});
  this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(this.canvas);this.lastTime=-1;
  const tick=()=>{if(this.enabled&&this.lastTime!==video.currentTime){this.draw();this.lastTime=video.currentTime;}this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);
 }
 crop(){const r=this.canvas.getBoundingClientRect(),main=this.root.getBoundingClientRect(),ratio=(r.width||240)/(r.height||180),displayWidth=Math.min(main.width,main.height*this.video.videoWidth/this.video.videoHeight),scale=displayWidth/this.video.videoWidth,w=Math.min((r.width||240)/Math.max(.001,scale)/this.zoom,this.video.videoWidth,this.video.videoHeight*ratio),h=w/ratio;this.center[0]=Math.max(w/this.video.videoWidth/2,Math.min(1-w/this.video.videoWidth/2,this.center[0]));this.center[1]=Math.max(h/this.video.videoHeight/2,Math.min(1-h/this.video.videoHeight/2,this.center[1]));return {x:this.center[0]*this.video.videoWidth-w/2,y:this.center[1]*this.video.videoHeight-h/2,w,h};}
 setEnabled(value){this.enabled=value;this.box.hidden=!value;if(!value)this.pick.hidden=true;this.draw();}
 draw(){if(!this.enabled||this.video.readyState<2)return;const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(!w||!h)return;if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}const c=this.crop();this.context.drawImage(this.video,c.x,c.y,c.w,c.h,0,0,w,h);this.canvas.dataset.crop=[c.x,c.y,c.w,c.h].map(n=>n.toFixed(2)).join(',');this.canvas.dataset.videoTime=this.video.currentTime.toFixed(3);}
 dispose(){cancelAnimationFrame(this.raf);this.observer.disconnect();this.box.remove();this.pick.remove();}
}
