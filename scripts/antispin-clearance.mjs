// Geometry audit for authoring and regression tests. Does not validate technique.
// Checks every rendered triangle, including the gripping hand, against finite
// shaft, grip, and end-cap volumes. Staff dimensions match blender-antispin.py; all contact triangles are checked.
// Measurements use the source model's metres.
import * as T from 'three';
const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),p=new T.Vector3(),tri=new T.Triangle(a,b,c),ray=new T.Ray(),closest=new T.Vector3(),intersect=new T.Vector3(),box=new T.Box3(),bounds=new T.Box3(),line=new T.Line3();
const tmp=Array.from({length:5},()=>new T.Vector3());
function segments(a,b,c,d){const [u,v,w]=tmp;u.subVectors(b,a);v.subVectors(d,c);w.subVectors(a,c);const A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),det=A*C-B*B;let s=det>1e-12?Math.max(0,Math.min(1,(B*E-C*D)/det)):0,t=(B*s+E)/C;if(t<0){t=0;s=Math.max(0,Math.min(1,-D/A));}else if(t>1){t=1;s=Math.max(0,Math.min(1,(B-D)/A));}return w.addScaledVector(u,s).addScaledVector(v,-t).length();}
export {segments as segmentDistance};
export function staffClearance(mesh,skin,hands){
 const g=mesh.geometry,pos=g.attributes.position,index=g.index,points=new Float64Array(pos.count*3),owners=new Int8Array(pos.count).fill(-1),freeFinger=new Float32Array(pos.count),indexFinger=new Float32Array(pos.count),bones=mesh.skeleton?.bones;
 for(let i=0;i<pos.count;i++){
  p.fromBufferAttribute(pos,i);if(skin){mesh.applyBoneTransform(i,p);const weights=g.attributes.skinWeight,ids=g.attributes.skinIndex;const handWeights=[0,0];for(let j=0;j<4;j++){const name=bones[ids.getComponent(i,j)]?.name||'';if(/middle|ring|pinky/.test(name))freeFinger[i]+=weights.getComponent(i,j);if(/index/.test(name))indexFinger[i]+=weights.getComponent(i,j);if(/hand|thumb|index|middle|ring|pinky/.test(name))handWeights[name.endsWith('_l')?0:1]+=weights.getComponent(i,j);}if(Math.max(...handWeights)>.5)owners[i]=handWeights[0]>handWeights[1]?0:1;}
  p.applyMatrix4(mesh.matrixWorld);p.toArray(points,i*3);
 }
 let minimum=10,hit=null;
 const props=hands.flatMap((h,i)=>{
  const half=.41,center=new T.Vector3(...h.center),axis=new T.Vector3(...h.axis),part=(a,b,r)=>({i,a:center.clone().addScaledVector(axis,a),b:center.clone().addScaledVector(axis,b),r:r});
  return [part(-.41,.41,.0105),part(-.065,.065,.0122),part(-.009,.009,.01245),part(-.398,-.342,.020),part(.342,.398,.020)];
 }).map(h=>({...h,box:new T.Box3().setFromPoints([h.a,h.b]).expandByScalar(h.r+.03)}));
 for(let j=0;j<index.count;j+=3){const ids=[index.getX(j),index.getX(j+1),index.getX(j+2)];a.fromArray(points,ids[0]*3);b.fromArray(points,ids[1]*3);c.fromArray(points,ids[2]*3);box.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);
  for(const h of props){const contact=hands[h.i].center,allowed=ids.every(i=>owners[i]===h.i&&freeFinger[i]<.25&&(Math.hypot(points[i*3]-contact[0],points[i*3+1]-contact[1],points[i*3+2]-contact[2])<(hands[h.i].support==='index'&&indexFinger[i]>.5?.3:.13)));if(!box.intersectsBox(h.box))continue;ray.origin.copy(h.a);ray.direction.subVectors(h.b,h.a).normalize();const endDistance=h.a.distanceToSquared(h.b);let distance=10;
   const intersection=ray.intersectTriangle(a,b,c,false,intersect);if(intersection&&intersect.distanceToSquared(h.a)<=endDistance)distance=0;
   else {tri.closestPointToPoint(h.a,closest);distance=closest.distanceTo(h.a);tri.closestPointToPoint(h.b,closest);distance=Math.min(distance,closest.distanceTo(h.b),segments(a,b,h.a,h.b),segments(b,c,h.a,h.b),segments(c,a,h.a,h.b));}
   if(distance-h.r<minimum){minimum=distance-h.r;hit={staff:h.i,triangle:j/3,mesh:mesh.name||'sleeve',contact:allowed};}
  }
 }
 return {minimum,hit};
}
