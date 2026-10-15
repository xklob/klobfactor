// Render-surface checks for this review scene. These do not approve technique.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {staffClearance,segmentDistance} from './antispin-clearance.mjs';

const filename=process.argv[2]||'preview/antispin/antispin-split-same.glb';
const samples=Number(process.argv[3]||480),output=process.argv[4]||'.artifacts/antispin-audit.json';
const bytes=await readFile(filename),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const root=gltf.scene;
const mixer=new T.AnimationMixer(root),clip=gltf.animations[0],action=mixer.clipAction(clip);
action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[],staves=[],bones={};
root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(/^Staff_[lr]$/.test(o.name))staves.push(o);if(o.isBone)bones[o.name]=o;});
assert.equal(staves.length,2,'Both staff volumes must be audited');
assert(meshes.some(m=>m.material.name==='Natural_nails'||m.material.name==='Natural nails'),'Include the sculpted nail surface');
assert(meshes.some(m=>m.geometry.attributes.position.count>100000),'Include the detailed body surface');
const restPositions={};
for(const mesh of meshes)mesh.skeleton.bones.forEach((bone,i)=>{
  restPositions[bone.name]=new T.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert());
});
const point=new T.Vector3(),first=new Map(),rows=[];
const previousRotations=new Map();
let minimum=Infinity,loopError=0,maxWristBend=0,staffGap=Infinity,maxArmStretch=1,maxArmAngularSpeedDegrees=0;
for(let n=0;n<=samples;n++){
  action.paused=false;action.enabled=true;mixer.setTime(n/samples*clip.duration);root.updateMatrixWorld(true);for(const mesh of meshes)mesh.skeleton.update();
  for(const [name,bone]of Object.entries(bones))if(/^DEF-(upper_arm|forearm|hand)/.test(name)){
    const q=bone.getWorldQuaternion(new T.Quaternion()).normalize(),previous=previousRotations.get(name);
    if(previous)maxArmAngularSpeedDegrees=Math.max(maxArmAngularSpeedDegrees,q.angleTo(previous)*180/Math.PI*samples/clip.duration);
    previousRotations.set(name,q);
  }
  const hands=staves.map(o=>({center:o.getWorldPosition(new T.Vector3()).toArray(),axis:new T.Vector3(0,1,0).applyQuaternion(o.getWorldQuaternion(new T.Quaternion())).toArray(),halfLength:.41}));
  const ends=hands.map(h=>[-1,1].map(sign=>new T.Vector3(...h.center).addScaledVector(new T.Vector3(...h.axis),sign*.41)));
  staffGap=Math.min(staffGap,segmentDistance(...ends[0],...ends[1])-.04);
  const clearance=meshes.map((m,mi)=>({...staffClearance(m,true,hands),mi})).reduce((a,b)=>a.minimum<b.minimum?a:b);
  if(clearance.hit){
    const mesh=meshes[clearance.mi],geometry=mesh.geometry,weights={};
    for(let j=0;j<3;j++){
      const v=geometry.index.getX(clearance.hit.triangle*3+j);
      for(let k=0;k<4;k++){
        const name=mesh.skeleton.bones[geometry.attributes.skinIndex.getComponent(v,k)].name;
        weights[name]=(weights[name]||0)+geometry.attributes.skinWeight.getComponent(v,k);
      }
    }
    clearance.region=Object.entries(weights).sort((a,b)=>b[1]-a[1])[0][0];
  }
  for(const side of ['l','r']){
    const position=n=>bones['DEF-'+n+side.toUpperCase()].getWorldPosition(new T.Vector3());
    const W=position('hand'),E=position('forearm'),I=position('f_index01'),P=position('f_pinky01');
    maxWristBend=Math.max(maxWristBend,W.clone().sub(E).angleTo(I.add(P).multiplyScalar(.5).sub(W))*180/Math.PI);
    const U=position('upper_arm'),suffix=side.toUpperCase();
    for(const [a,b,A,B]of[['hand','forearm',W,E],['forearm','upper_arm',E,U]]){
      const length=restPositions['DEF-'+a+suffix].distanceTo(restPositions['DEF-'+b+suffix]);
      maxArmStretch=Math.max(maxArmStretch,A.distanceTo(B)/length);
    }
  }
  if(n===0||n===samples)for(const mesh of meshes){
    const positions=mesh.geometry.attributes.position,array=n===0?new Float32Array(positions.count*3):first.get(mesh);
    for(let v=0;v<positions.count;v++){
      point.fromBufferAttribute(positions,v);mesh.applyBoneTransform(v,point);point.applyMatrix4(mesh.matrixWorld);
      if(n===0)point.toArray(array,v*3);else loopError=Math.max(loopError,Math.hypot(point.x-array[v*3],point.y-array[v*3+1],point.z-array[v*3+2]));
    }
    if(n===0)first.set(mesh,array);
  }
  minimum=Math.min(minimum,clearance.minimum);rows.push({phase:n/samples,...clearance,gapMetres:clearance.minimum});
  if(n%24===0)console.log(JSON.stringify({sample:n,minimumGapMetres:minimum,maxWristBend}));
}
const result={modelSha256:createHash('sha256').update(bytes).digest('hex'),samples:samples+1,vertices:meshes.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0),triangles:meshes.reduce((sum,m)=>sum+m.geometry.index.count/3,0),minimumGapMetres:minimum,staffGapMetres:staffGap,loopErrorMetres:loopError,maxWristBendDegrees:maxWristBend,maxArmStretch,maxArmAngularSpeedDegrees,rows};
await writeFile(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:undefined}));
if(!Number.isFinite(minimum)||minimum<0||staffGap<0||loopError>.0001||maxArmStretch>1.05||(samples>=120&&maxArmAngularSpeedDegrees>1800))process.exitCode=1;
