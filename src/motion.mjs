import {archerPose} from './archer.mjs';
// All coordinates are in a performer-centered right-handed space: x right,
// y up, z toward the audience. Angle zero points up. Staffs are rigid segments.
export const TAU = Math.PI * 2;
export const HALF_STAFF = 0.72;
export const mod = (n, d = 1) => ((n % d) + d) % d;
export const lerp = (a, b, t) => a + (b - a) * t;
export const vec = (a, r = 1) => [Math.sin(a) * r, Math.cos(a) * r, 0];
const plus = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, n) => a.map(v => v * n);
function rotateY(p, angle) { const c = Math.cos(angle), s = Math.sin(angle); return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]; }
export function pointOnBox(t, w = 1.25, h = 0.8) {
  const q = mod(t) * 4, i = Math.floor(q), u = q - i;
  const corners = [[-w,h,0],[w,h,0],[w,-h,0],[-w,-h,0]];
  return corners[i].map((v,j)=>lerp(v,corners[(i+1)%4][j],u));
}
export function timingAngles(phase, timing = 'together-same') {
  const a = phase * TAU;
  const opposite = timing.includes('opposite');
  const split = timing.startsWith('split');
  return [a,(opposite ? -a : a)+(split ? Math.PI : 0)];
}
function circular(a, kind, options = {}) {
  let radius = ['isolation','antispin'].includes(kind) ? HALF_STAFF : kind === 'extension' ? 1.35 : 1.0;
  let turns = ({isolation:1,extension:1,antispin:-1,inspin:3,rtype:0,static:1})[kind] ?? 1;
  if (kind === 'static') radius = 0;
  let shaft = turns*a + (options.orientation || 0);
  if (kind === 'isolation') shaft = a+Math.PI;
  if (kind === 'antispin') shaft += Math.PI;
  if (options.pinky) shaft += Math.PI;
  return {center:plus([0,0.85,0.46],vec(a,radius)),axis:vec(shaft),kind};
}
export function sampleMotion(spec = {}, phase = 0) {
  const t=mod(phase), kind=spec.kind||'isolation', timing=spec.timing||'together-same';
  let angles=timingAngles(t,timing), hands, stance=0, extra={};
  const orientation=spec.orientation||0;
  if(kind === 'study') {
    // Discrete, source-verified poses or spatial landmarks. Never interpolate
    // these into a purported body movement between the observed checkpoints.
    const frame=spec.frames?.[Math.min((spec.frames?.length||1)-1,Math.floor(Math.min(phase,.999999)*(spec.frames?.length||1)))];
    hands=frame?.hands||[];
  } else if(kind === 'archer') {
    extra=archerPose(t,spec.solo);hands=extra.hands;
  } else if(kind === 'grip') {
    hands=[-1,1].map((s,i)=>({center:[s*0.64,0.6,0.5],axis:vec(spec.still?Math.PI/2:Math.sin(t*TAU)*Math.PI*0.75*(i? -1:1)),kind}));
  } else if(kind==='hybrid') {
    const pair=spec.pair||['isolation','antispin'];
    hands=angles.map((a,i)=>circular(a,pair[i],{orientation,pinky:spec.pinky}));
  } else if(kind==='transition') {
    // Reverse one hand at cardinal meeting/opposition points, continuously.
    const a=t*TAU+Math.PI/2, q=Math.floor(t*4);
    const b=q===0?a:q===1?2*Math.PI-a:q===2?a-Math.PI:3*Math.PI-a;
    hands=[a,b].map(x=>circular(x,spec.base||'isolation',{orientation}));
  } else if(kind==='box') {
    // Source's four circle-plus-quarter handoffs, in front alignment only.
    const h=HALF_STAFF,low=.2,z=.35;
    const stages=[
      [0,[-h/2,low,z],0,1,Math.PI],
      [1,[-h/2,low+h,z],-Math.PI/2,-1,Math.PI/2],
      [0,[h/2,low+h,z],Math.PI,-1,Math.PI],
      [1,[h/2,low,z],Math.PI/2,1,Math.PI/2]
    ];
    const progress=spec.stage==null?t*4:spec.stage+(phase===1?1-1e-12:t);
    const [anchor,center,A,S,B]=stages[Math.floor(progress)%4],b=(progress%1)*2.5*Math.PI;
    const u=a=>[Math.cos(a),Math.sin(a),0];
    hands=[];hands[anchor]={center,axis:scale(u(A+b),S),kind};
    hands[1-anchor]={center:plus(center,scale(u(A+b),h)),axis:u(B-b),kind};
  } else if(['antibrid','crank'].includes(kind)) {
    const base=[-HALF_STAFF,0.8,0.3];
    const a=(spec.reverse?-1:1)*(angles[0]+orientation), axis=vec(Math.PI/2-a), anti=vec(a-Math.PI/2);
    // Source-derived front alignment: left hand is the pivot; right grip
    // follows its thumb end while the right shaft turns in the other direction.
    hands=[{center:base,axis,kind},{center:plus(base,scale(axis,HALF_STAFF)),axis:anti,kind}];
    if(kind==='crank')hands[1].center=plus(base,[HALF_STAFF*Math.cos(a),HALF_STAFF*Math.abs(Math.sin(a)),0]);
  } else {
    hands=angles.map(a=>circular(a,kind,{orientation,pinky:spec.pinky}));
  }
  // Separate the two wall planes, even when the front projections coincide.
  // Contact studies retain their original geometry and explicit depth limits.
  if(['static','isolation','extension','antispin','inspin','rtype','hybrid','transition'].includes(kind)) {
    hands=hands.map((h,i)=>({...h,center:[h.center[0],h.center[1],.48+i*.3]}));
  }
  if(spec.swap)hands=hands.reverse().map(h=>({...h,center:[-h.center[0],h.center[1],h.center[2]],axis:[-h.axis[0],h.axis[1],h.axis[2]]}));
  if(spec.plane==='wheel') hands=hands.map(h=>({...h,center:rotateY(h.center,Math.PI/2),axis:rotateY(h.axis,Math.PI/2)}));
  hands=hands.map((h,i)=>{
    const n=Math.hypot(...h.axis)||1, axis=scale(h.axis,1/n);
    return {...h,axis,side:i?'right':'left',thumb:plus(h.center,scale(axis,HALF_STAFF)),pinky:plus(h.center,scale(axis,-HALF_STAFF))};
  });
  if(spec.solo)hands=hands.slice(0,1);
  return {...extra,hands,stance,phase:kind==='study'?Math.min(phase,.999999):t,kind};
}

export function armPose(hand,index=0) {
  const shoulder=[index?.45:-.45,1.3,0];
  if(hand.elbow)return {shoulder,elbow:hand.elbow};
  const c=hand.center,delta=c.map((v,i)=>v-shoulder[i]);
  const distance=Math.hypot(...delta)||1,axis=delta.map(v=>v/distance);
  // A schematic bend plane, not an anatomically reconstructed wrist/elbow.
  const hint=[index?.6:-.6,-1,-.2],dot=hint.reduce((v,x,i)=>v+x*axis[i],0);
  const bend=hint.map((x,i)=>x-dot*axis[i]),length=Math.hypot(...bend)||1;
  const offset=Math.min(.38,Math.max(.12,.48-distance*.17));
  return {shoulder,elbow:shoulder.map((x,i)=>x+delta[i]*.5+bend[i]/length*offset)};
}
export function project(p, view='front', mirror=false) {
  const yaw=view==='side'?Math.PI/2:view==='perspective'?-.65:0;
  const q=rotateY(p,yaw);
  if(view==='top') return [400+(mirror?-1:1)*p[0]*82,275-p[2]*82,p[1]];
  if(view==='perspective')return [400+(mirror?-1:1)*q[0]*82,290-(q[1]*.96-q[2]*.28)*82,q[2]];
  return [400+(mirror?-1:1)*q[0]*82,290-q[1]*82,q[2]];
}
export const BASIC_PATTERNS=['grip','static','isolation','extension','antispin','inspin','hybrid','rtype','transition','antibrid','crank','box','archer','study'];
