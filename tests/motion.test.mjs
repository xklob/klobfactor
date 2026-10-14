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
test('antispin equal-radius reference has horizontal thumb and vertical pinky paths',()=>{
 for(let n=0;n<100;n++){const h=sampleMotion({kind:'antispin'},n/100).hands[0];near(h.thumb[1],.85);near(h.pinky[0],0);}
});
test('R-type keeps its shaft orientation fixed',()=>{const axis=sampleMotion({kind:'rtype',orientation:1.2},0).hands[0].axis;for(let n=0;n<100;n++)near(distance(axis,sampleMotion({kind:'rtype',orientation:1.2},n/100).hands[0].axis),0);});
test('basic antibrid maintains the verified hand-to-thumb-end connection',()=>{for(let n=0;n<100;n++){const [a,b]=sampleMotion({kind:'antibrid'},n/100).hands;near(distance(a.thumb,b.center),0);}});
test('front crank returns by isolation and keeps the moving hand on the upper arc',()=>{
 for(let n=0;n<100;n++){
  const t=n/100,[a,b]=sampleMotion({kind:'crank'},t).hands;
  assert.ok(b.center[1]>=a.center[1]-1e-10);
  near(t<.5?distance(a.thumb,b.center):distance(b.thumb,a.center),0);
 }
});
test('antibrid box preserves its changing contact and joins all four phrases continuously',()=>{
 const contacts=[[0,'thumb',1],[1,'pinky',0],[0,'pinky',1],[1,'thumb',0]];
 for(let n=0;n<200;n++){
  const t=n/200,hands=sampleMotion({kind:'box'},t).hands,[anchor,end,mover]=contacts[Math.floor(t*4)];
  near(distance(hands[anchor][end],hands[mover].center),0);
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
  near(left.center[0],right.center[0]);near(left.center[1],right.center[1]);
  assert.ok(Math.abs(left.center[2]-right.center[2])>=.29);
 }
});
test('archer repeats continuously and distinguishes shoulder and underarm passages',()=>{
 const first=sampleMotion({kind:'archer'},0),last=sampleMotion({kind:'archer'},1-1e-8);
 first.hands.forEach((hand,i)=>{assert.ok(distance(hand.center,last.hands[i].center)<1e-5);assert.ok(distance(hand.thumb,last.hands[i].thumb)<1e-5);});
 const over=sampleMotion({kind:'archer'},.25),under=sampleMotion({kind:'archer'},.75);
 assert.ok(over.hands[0].elbow[1]>1.3);assert.ok(under.hands[0].elbow[1]<1.3);
 assert.ok(over.hands[0].thumb[2]<0);assert.ok(under.hands[0].pinky[2]<0);
 assert.ok(under.hands[1].pinky[2]>0);
 const solo=sampleMotion({kind:'archer',solo:true},.75);assert.equal(solo.hands.length,1);assert.ok(solo.guideHands[1],'Solo drill needs extended arm as a threading reference');
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
test('schematic archer clears the extended arm and the other shaft',()=>{
 for(let n=0;n<1200;n++){
  const [left,right]=sampleMotion({kind:'archer'},n/1200).hands;
  for(const [a,b] of [[[.45,1.3,0],right.elbow],[right.elbow,right.center]])assert.ok(segmentDistance(left.pinky,left.thumb,a,b)>.087,`Arm crossing at ${n/1200}`);
  assert.ok(segmentDistance(left.pinky,left.thumb,right.pinky,right.thumb)>.10,`Staff crossing at ${n/1200}`);
 }
});
