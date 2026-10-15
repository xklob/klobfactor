// Bake thumb support against deformed triangles. This authoring tool is not
// runtime animation code. Run the independent 3D audit over the final export.
import {readFile,writeFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const [model,reportPath,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node scripts/fit-antispin-support.mjs model.glb authoring-report.json output.json');
const bytes=await readFile(model),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const report=JSON.parse(await readFile(reportPath,'utf8'));
const root=gltf.scene,clip=gltf.animations[0],mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);
action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[],staves={};
root.traverse(mesh=>{
 if(/^Staff_[lr]$/.test(mesh.name))staves[mesh.name.at(-1)]=mesh;
 if(!mesh.isSkinnedMesh)return;
 const g=mesh.geometry,n=g.attributes.position.count,thumb=new Int8Array(n).fill(-1);
 for(let i=0;i<n;i++)for(let j=0;j<4;j++){
  const name=mesh.skeleton.bones[g.attributes.skinIndex.getComponent(i,j)]?.name||'';
  if(/thumb0[12]/.test(name)&&g.attributes.skinWeight.getComponent(i,j)>.3)thumb[i]=name.at(-1)==='L'?0:1;
 }
 meshes.push({mesh,thumb,world:new Float64Array(n*3),projected:new Float64Array(n*3)});
});
const point=new T.Vector3(),axis=new T.Vector3(),delta=new T.Vector3();
const count=report.frames.length/2-1,frames=[],geometry=[],options={l:[],r:[]};
function native(a){return new T.Vector3(a[0],a[2],-a[1]);}
function edgeDistance(x,y,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
function triangleDistance(x,y,t){
 const [ax,ay,bx,by,cx,cy]=t;
 const a=(bx-ax)*(y-ay)-(by-ay)*(x-ax),b=(cx-bx)*(y-by)-(cy-by)*(x-bx),c=(ax-cx)*(y-cy)-(ay-cy)*(x-cx);
 if(Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))>1e-12&&((a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0)))return 0;
 return Math.min(edgeDistance(x,y,ax,ay,bx,by),edgeDistance(x,y,bx,by,cx,cy),edgeDistance(x,y,cx,cy,ax,ay));
}
function evaluate(triangles,x,y){
 let minimum=.1,thumbGap=1,penalty=0;
 for(const t of triangles){
  const boxGap=Math.hypot(Math.max(t[8]-x,0,x-t[9]),Math.max(t[10]-y,0,y-t[11]))-t[6];
  if(boxGap>minimum&&(!t[7]||boxGap>thumbGap))continue;
  const distance=triangleDistance(x,y,t)-t[6];
  minimum=Math.min(minimum,distance);if(t[7])thumbGap=Math.min(thumbGap,distance);
  if(distance<.0018)penalty+=(.0018-distance)**2;
 }
 return {loss:1e6*Math.max(0,.0018-minimum)**2+1000*penalty+150000*(thumbGap-.0018)**2+100*(x*x+y*y),minimum,thumbGap};
}
const volumes=[[-.41,.41,.0105],[-.065,.065,.0122],[-.009,.009,.0125],[-.398,-.342,.02],[.342,.398,.02]];
for(let i=0;i<count;i++){
 action.paused=false;action.enabled=true;mixer.setTime(i/count*clip.duration);root.updateMatrixWorld(true);
 for(const {mesh,world}of meshes){
  mesh.skeleton.update();
  for(let v=0;v<mesh.geometry.attributes.position.count;v++){
   point.fromBufferAttribute(mesh.geometry.attributes.position,v);mesh.applyBoneTransform(v,point);point.applyMatrix4(mesh.matrixWorld);point.toArray(world,v*3);
  }
 }
 const frame={},row={};
 for(const [s,index]of[['l',0],['r',1]]){
  const center=staves[s].getWorldPosition(new T.Vector3());
  axis.set(0,1,0).applyQuaternion(staves[s].getWorldQuaternion(new T.Quaternion()));
  const P=native(report.frames[i*2+index].palm).addScaledVector(axis,-native(report.frames[i*2+index].palm).dot(axis)).normalize();
  const V=new T.Vector3().crossVectors(axis,P).normalize(),triangles=[];
  for(const {mesh,world,projected,thumb}of meshes){
   for(let j=0;j<world.length;j+=3){delta.fromArray(world,j).sub(center);projected[j]=delta.dot(P);projected[j+1]=delta.dot(V);projected[j+2]=delta.dot(axis);}
   const ids=mesh.geometry.index.array;
   for(let j=0;j<ids.length;j+=3){
    const a=ids[j]*3,b=ids[j+1]*3,c=ids[j+2]*3;
    const minx=Math.min(projected[a],projected[b],projected[c]),maxx=Math.max(projected[a],projected[b],projected[c]);
    const miny=Math.min(projected[a+1],projected[b+1],projected[c+1]),maxy=Math.max(projected[a+1],projected[b+1],projected[c+1]);
    if(minx>.07||maxx<-.07||miny>.07||maxy<-.07)continue;
    const lo=Math.min(projected[a+2],projected[b+2],projected[c+2]),hi=Math.max(projected[a+2],projected[b+2],projected[c+2]);
    let radius=0;for(const [start,end,r]of volumes)if(lo<=end+r&&hi>=start-r)radius=Math.max(radius,r);
    if(!radius)continue;
    // Projecting each overlapping triangle and using the largest overlapping
    // radius is conservative, including the rounded ends of the audit capsules.
    const support=[ids[j],ids[j+1],ids[j+2]].filter(v=>thumb[v]===index).length>=2;
    triangles.push([projected[a],projected[a+1],projected[b],projected[b+1],projected[c],projected[c+1],radius,support,minx,maxx,miny,maxy]);
   }
  }
  let best={loss:Infinity,x:0,y:0};const candidates=[];
  for(let x=-.022;x<=.0221;x+=.002)for(let y=-.022;y<=.0221;y+=.002){const e=evaluate(triangles,x,y);const c={...e,x,y};if(e.minimum>=.001)candidates.push(c);if(e.loss<best.loss)best=c;}
  for(const step of [.001,.00025]){
   const base=best;
   for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){
    const x=base.x+a*step,y=base.y+b*step,e=evaluate(triangles,x,y);const c={...e,x,y};if(e.minimum>=.001)candidates.push(c);if(e.loss<best.loss)best=c;
   }
  }
  const offset=P.clone().multiplyScalar(best.x).addScaledVector(V,best.y);frame[s]=[offset.x,-offset.z,offset.y];
  row[s]={minimum:best.minimum,thumbGap:best.thumbGap,offset:offset.length(),triangles:triangles.length};
  const unique=new Map();for(const c of candidates.sort((a,b)=>a.loss-b.loss)){
   const k=Math.round(c.x*4000)+','+Math.round(c.y*4000);if(!unique.has(k))unique.set(k,c);
  }
  const choices=[...unique.values()].slice(0,64).map(c=>{
   const v=P.clone().multiplyScalar(c.x).addScaledVector(V,c.y);return {...c,offset:[v.x,-v.z,v.y]};
  });
  if(!choices.length)throw Error('No clear support candidate at frame '+i+' '+s);
  options[s].push(choices);
 }
 frames.push(frame);geometry.push(row);if(i%16===0)console.log('triangle contacts',i,'/',count);
}
// Choose a continuous cyclic path through valid surface contacts. Averaging
// independently fitted translations can pass through a finger; this keeps
// every selected key on the collision-free side of the actual surface.
const transition=(a,b)=>4000*a.offset.reduce((sum,v,i)=>sum+(v-b.offset[i])**2,0);
for(const s of ['l','r']){
 const rows=options[s];let winner=null;
 for(let start=0;start<Math.min(12,rows[0].length);start++){
  let costs=rows[0].map((c,i)=>i===start?c.loss:Infinity);const links=[];
  for(let i=1;i<count;i++){
   const previous=costs;const back=[];
   costs=rows[i].map(c=>{let best=Infinity,k=0;rows[i-1].forEach((p,j)=>{const score=previous[j]+transition(c,p);if(score<best){best=score;k=j;}});back.push(k);return best+c.loss;});links[i]=back;
  }
  costs.forEach((cost,last)=>{
   const score=cost+transition(rows.at(-1)[last],rows[0][start]);if(winner&&score>=winner.score)return;
   const path=new Array(count);path[count-1]=last;for(let i=count-1;i>0;i--)path[i-1]=links[i][path[i]];winner={score,path};
  });
 }
 for(let i=0;i<count;i++){
  const c=rows[i][winner.path[i]];frames[i][s]=c.offset;geometry[i][s]={minimum:c.minimum,thumbGap:c.thumbGap,offset:Math.hypot(...c.offset)};
 }
}
frames.push(frames[0]);
await writeFile(output,JSON.stringify({status:'Baked triangle support; requires independent full-cycle audit',frames,geometry},null,2));
console.log('Contact file',output);
