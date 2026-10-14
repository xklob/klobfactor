// Geometric studies in performer coordinates: right, up, toward audience.
// These functions describe prop relationships. They do not pose a human body.
export const TAU=Math.PI*2;
export const HALF_STAFF=.9;
export const mod=(n,d=1)=>((n%d)+d)%d;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const vec=(a,r=1)=>[Math.sin(a)*r,Math.cos(a)*r,0];
const plus=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,n)=>a.map(v=>v*n);
const rotateY=(p,a)=>[p[0]*Math.cos(a)+p[2]*Math.sin(a),p[1],-p[0]*Math.sin(a)+p[2]*Math.cos(a)];
export function pointOnBox(t,w=1.25,h=.8){const q=mod(t)*4,i=Math.floor(q),u=q-i,c=[[-w,h,0],[w,h,0],[w,-h,0],[-w,-h,0]];return c[i].map((v,j)=>lerp(v,c[(i+1)%4][j],u));}
export function timingAngles(phase,timing='together-same'){
 const a=phase*TAU;return [a,(timing.includes('opposite')?-a:a)+(timing.startsWith('split')?Math.PI:0)];
}
function circular(angle,kind,options={}){
 const a=Math.PI-angle,r=['isolation','antispin'].includes(kind)?HALF_STAFF:kind==='static'?0:1.1;
 const turns=({isolation:1,extension:1,antispin:-1,inspin:3,rtype:0,static:1})[kind];
 if(turns==null)throw new Error(`Unsupported geometric study: ${kind}`);
 const shaft=turns*a+(options.orientation||0)+(['isolation','antispin'].includes(kind)?Math.PI:0)+(options.pinky?Math.PI:0);
 return {center:plus([0,1.3,0],vec(a,r)),axis:vec(shaft),kind,armAngle:a,pinkyLed:!!options.pinky};
}
export function sampleMotion(spec={},phase=0){
 const kind=spec.kind||'isolation',t=mod(spec.reverse?-phase:phase),angles=timingAngles(t,spec.timing),orientation=spec.orientation||0;
 let hands;
 if(kind==='study'){
  const frames=spec.frames||[],frame=frames[Math.min(frames.length-1,Math.floor(Math.min(phase,.999999)*frames.length))];
  hands=(frame?.hands||[]).map((h,i)=>({...h,center:[h.center[0],h.center[1],h.center[2]+i*.32]}));
 }else if(kind==='hybrid')hands=angles.map((a,i)=>circular(a,(spec.pair||['isolation','antispin'])[i],{orientation,pinky:spec.pinky}));
 else if(kind==='transition'){
  const a=t*TAU+Math.PI/2,q=Math.floor(t*4),b=q===0?a:q===1?2*Math.PI-a:q===2?a-Math.PI:3*Math.PI-a;
  hands=[a,b].map(x=>circular(x,spec.base||'isolation',{orientation}));
 }else if(kind==='box'){
  const h=HALF_STAFF,low=.2,z=.68,stages=[[0,[-h/2,low,z],0,1,Math.PI],[1,[-h/2,low+h,z],-Math.PI/2,-1,Math.PI/2],[0,[h/2,low+h,z],Math.PI,-1,Math.PI],[1,[h/2,low,z],Math.PI/2,1,Math.PI/2]];
  const progress=spec.stage==null?t*4:spec.stage+(phase===1?1-1e-12:t),[anchor,center,A,S,B]=stages[Math.floor(progress)%4],b=(progress%1)*2.5*Math.PI,u=a=>[Math.cos(a),Math.sin(a),0];
  hands=[];hands[anchor]={center,axis:scale(u(A+b),S),kind};hands[1-anchor]={center:plus(center,scale(u(A+b),h)),axis:u(B-b),kind};
 }else if(['antibrid','crank'].includes(kind)){
  const base=[0,.9,.68],a=angles[0]+orientation,axis=vec(Math.PI/2-a);
  hands=[{center:base,axis,kind},{center:plus(base,scale(axis,HALF_STAFF)),axis:vec(a-Math.PI/2),kind}];
  if(kind==='crank')hands[1].center=plus(base,[HALF_STAFF*Math.cos(a),HALF_STAFF*Math.abs(Math.sin(a)),0]);
 }else hands=angles.map(a=>circular(a,kind,{orientation,pinky:spec.pinky}));
 if(['static','isolation','extension','antispin','inspin','rtype','hybrid','transition'].includes(kind))hands=hands.map((h,i)=>({...h,center:[h.center[0]+(spec.solo?0:(i?.28:-.28)),h.center[1],.62+i*.16]}));
 if(['box','antibrid','crank'].includes(kind))hands=hands.map((h,i)=>({...h,center:[h.center[0],h.center[1],.68+i*.16]}));
 if(spec.swap)hands=hands.reverse().map(h=>({...h,center:[-h.center[0],h.center[1],h.center[2]],axis:[-h.axis[0],h.axis[1],h.axis[2]]}));
 if(spec.plane==='wheel')hands=hands.map((h,i)=>({...h,center:[i?.72:-.72,h.center[1],-h.center[0]],axis:rotateY(h.axis,Math.PI/2)}));
 hands=hands.map((h,i)=>{const axis=scale(h.axis,1/(Math.hypot(...h.axis)||1));return {...h,axis,side:i?'right':'left',thumb:plus(h.center,scale(axis,HALF_STAFF)),pinky:plus(h.center,scale(axis,-HALF_STAFF))};});
 if(spec.solo)hands=hands.slice(0,1);
 return {hands,kind,alignmentOnly:true,referenceBody:kind==='study'&&!!spec.landmarks?.length,phase:kind==='study'?Math.min(phase,.999999):kind==='box'&&spec.stage!=null?Math.max(0,Math.min(1,phase)):t};
}
export function project(p,view='front',mirror=false){const yaw=view==='side'?Math.PI/2:view==='perspective'?-.65:0,q=rotateY(p,yaw);if(view==='top')return [400+(mirror?-1:1)*p[0]*82,275-p[2]*82,p[1]];if(view==='perspective')return [400+(mirror?-1:1)*q[0]*82,290-(q[1]*.96-q[2]*.28)*82,q[2]];return [400+(mirror?-1:1)*q[0]*82,290-q[1]*82,q[2]];}
export const BASIC_PATTERNS=['static','isolation','extension','antispin','inspin','hybrid','rtype','transition','antibrid','crank','box','study'];
