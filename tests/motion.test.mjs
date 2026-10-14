import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {sampleMotion,HALF_STAFF,BASIC_PATTERNS} from '../src/motion.mjs';
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
test('rigid staffs and centered grips for every implemented motion and view variant',()=>{
 for(const kind of BASIC_PATTERNS)for(const timing of ['together-same','together-opposite','split-same','split-opposite'])for(let step=0;step<=32;step++){
  for(const h of sampleMotion({kind,timing,plane:step%2?'wheel':'wall',swap:step%3===0},step/32).hands){
   assert.ok([...h.center,...h.thumb,...h.pinky].every(Number.isFinite));
   near(distance(h.thumb,h.pinky),2*HALF_STAFF);near(distance(h.center,h.thumb),HALF_STAFF);
  }
 }
});
test('isolation really pins the chosen end',()=>{
 for(const pinky of [false,true]){const key=pinky?'pinky':'thumb',anchor=sampleMotion({kind:'isolation',pinky},0).hands[0][key];for(let n=0;n<100;n++)near(distance(anchor,sampleMotion({kind:'isolation',pinky},n/100).hands[0][key]),0);}
});
test('equal-radius antispin gives the selected end a horizontal path',()=>{
 for(const pinky of [false,true])for(let n=0;n<100;n++){const h=sampleMotion({kind:'antispin',pinky},n/100).hands[0];near(h[pinky?'pinky':'thumb'][1],1.3);near(h.center[0],-.28+HALF_STAFF*Math.sin(h.armAngle));}
});
test('R-type keeps its shaft orientation fixed',()=>{const axis=sampleMotion({kind:'rtype',orientation:1.2},0).hands[0].axis;for(let n=0;n<100;n++)near(distance(axis,sampleMotion({kind:'rtype',orientation:1.2},n/100).hands[0].axis),0);});
test('basic antibrid maintains front alignment in separate physical planes',()=>{for(let n=0;n<100;n++){const [a,b]=sampleMotion({kind:'antibrid'},n/100).hands;near(distance(a.thumb.slice(0,2),b.center.slice(0,2)),0);assert.ok(Math.abs(a.thumb[2]-b.center[2])>=.1);}});
test('front crank returns by isolation and keeps the moving hand on the upper arc',()=>{
 for(let n=0;n<100;n++){
  const t=n/100,[a,b]=sampleMotion({kind:'crank'},t).hands;
  assert.ok(b.center[1]>=a.center[1]-1e-10);
  near(t<.5?distance(a.thumb.slice(0,2),b.center.slice(0,2)):distance(b.thumb.slice(0,2),a.center.slice(0,2)),0);
 }
});
test('antibrid box preserves its changing contact and joins all four phrases continuously',()=>{
 const contacts=[[0,'thumb',1],[1,'pinky',0],[0,'pinky',1],[1,'thumb',0]];
 for(let n=0;n<200;n++){
  const t=n/200,hands=sampleMotion({kind:'box'},t).hands,[anchor,end,mover]=contacts[Math.floor(t*4)];
  near(distance(hands[anchor][end].slice(0,2),hands[mover].center.slice(0,2)),0);
 }
 for(const t of [.25,.5,.75,1]){
  const before=sampleMotion({kind:'box'},t-1e-8),after=sampleMotion({kind:'box'},t);
  before.hands.forEach((h,i)=>{assert.ok(distance(h.center,after.hands[i].center)<1e-6);assert.ok(distance(h.thumb,after.hands[i].thumb)<1e-6);});
 }
});
test('four-mode transition does not jump at its meeting points',()=>{for(const t of [.25,.5,.75,1]){const a=sampleMotion({kind:'transition'},t-1e-7),b=sampleMotion({kind:'transition'},t);a.hands.forEach((h,i)=>assert.ok(distance(h.thumb,b.hands[i].thumb)<1e-5));}});
test('all 20 researched sources are complete and timestamps stay inside the videos',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../content/catalog.json',import.meta.url),'utf8'));
 const duration=new Map(catalog.flatMap(s=>s.entries.map(e=>[e.videoId,e.duration]))),seen=new Set();
 for(const file of await readdir(new URL('../content/research',import.meta.url)))if(file.endsWith('.json'))for(const l of JSON.parse(await readFile(new URL(`../content/research/${file}`,import.meta.url),'utf8'))){
  assert.ok(!seen.has(l.videoId),`Duplicated research: ${l.videoId}`);seen.add(l.videoId);assert.ok(l.moves.length>0);
  let last=-1;for(const m of l.moves){assert.ok(m.start>=last,`Out of order: ${l.title} ${m.name}`);last=m.start;assert.ok(m.start>=0&&m.end>m.start&&m.end<=duration.get(l.videoId)+1,`Invalid segment ${l.title}: ${m.name}`);for(const k of ['name','description','grip','stance','focus'])assert.ok(typeof m[k]==='string'&&m[k].length>2,`${l.videoId} ${m.name} missing ${k}`);assert.ok(m.steps.length>0);}
 }
 assert.equal(seen.size,20);for(const id of duration.keys())assert.ok(seen.has(id));assert.deepEqual(catalog.map(s=>s.entries.length),[13,8]);
});

test('together-same keeps two staves in separate physical planes',()=>{
 for(const kind of ['isolation','antispin','extension','inspin','rtype'])for(let n=0;n<32;n++){
  const [left,right]=sampleMotion({kind,timing:'together-same'},n/32).hands;
  near(right.center[0]-left.center[0],.56);near(left.center[1],right.center[1]);
  assert.ok(Math.abs(left.center[2]-right.center[2])>=.10);
 }
});
// Closest point between two finite segments, sampled independently of rendering.
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]);
function segmentDistance(a,b,c,d){
 const u=sub(b,a),v=sub(d,c),w=sub(a,c),A=dot(u,u),B=dot(u,v),C=dot(v,v),D=dot(u,w),E=dot(v,w),det=A*C-B*B;
 const clamp=n=>Math.max(0,Math.min(1,n));
 let s=det>1e-12?clamp((B*E-C*D)/det):0,t=(B*s+E)/C;
 if(t<0){t=0;s=clamp(-D/A);}else if(t>1){t=1;s=clamp((B-D)/A);}
 return Math.hypot(...w.map((x,i)=>x+s*u[i]-t*v[i]));
}

test('the complete catalog never animates a reconstructed person',async()=>{
 const all=JSON.parse(await readFile(new URL('../dist/assets/catalog.json',import.meta.url),'utf8')).flatMap(s=>s.entries);
 for(const l of all)for(const m of l.moves){if(!m.motion){assert.equal(m.representation,'source');continue;}const state=sampleMotion(m.motion,.3);assert.equal(state.alignmentOnly,true);assert.equal(state.referenceBody,m.motion.kind==='study'&&!!m.motion.landmarks?.length);assert.ok(['reference','pattern'].includes(m.representation));}
 const archer=all.find(l=>l.videoId==='2WMkronsmfo');for(const m of archer.moves)if(m.motion)assert.equal(m.motion.kind,'study');
});
test('all published paired prop studies keep the two shafts physically separate',async()=>{
 const all=JSON.parse(await readFile(new URL('../dist/assets/catalog.json',import.meta.url),'utf8')).flatMap(s=>s.entries);
 const specs=all.flatMap(l=>l.moves.map(m=>m.motion)).filter(Boolean);
 for(const spec of specs)for(let n=0;n<=240;n++){
  const [a,b]=sampleMotion(spec,n/240).hands;if(!b)continue;
  assert.ok(segmentDistance(a.pinky,a.thumb,b.pinky,b.thumb)>.092,`${spec.kind}: overlapping solid staves at ${n/240}`);
 }
});
test('reverse studies traverse the same geometry in the opposite direction',()=>{
 for(const kind of ['isolation','extension','antispin','inspin','rtype','antibrid','crank'])for(const phase of [.1,.24,.63,.91]){
  const forward=sampleMotion({kind},1-phase),reverse=sampleMotion({kind,reverse:true},phase);
  forward.hands.forEach((h,i)=>{near(distance(h.center,reverse.hands[i].center),0);near(distance(h.thumb,reverse.hands[i].thumb),0);});
 }
});
