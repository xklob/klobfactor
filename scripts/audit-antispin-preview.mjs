// Render-surface checks for this review scene. These do not approve technique.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {preserveVolume} from '../preview/antispin/volume-skinning.mjs';
import {staffClearance,segmentDistance} from './antispin-clearance.mjs';

const filename=process.argv[2]||'preview/antispin/antispin-split-same.glb';
const samples=Number(process.argv[3]||480),output=process.argv[4]||'.artifacts/antispin-audit.json';
const bytes=await readFile(filename),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const root=gltf.scene;
const updateSkin=preserveVolume(root),mixer=new T.AnimationMixer(root),clip=gltf.animations[0],action=mixer.clipAction(clip);
action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const meshes=[],staves=[],bones={};
root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);if(/^Staff_[lr]$/.test(o.name))staves.push(o);if(o.isBone)bones[o.name]=o;});
assert.equal(staves.length,2,'Both staff volumes must be audited');
assert.equal(meshes.filter(m=>m.name.startsWith('Nail_')).length,10,'Include all fingernails');
assert(meshes.some(m=>m.geometry.attributes.position.count>100000),'Include the detailed body surface');
const point=new T.Vector3(),first=new Map(),rows=[];
let minimum=Infinity,loopError=0,maxWristBend=0,staffGap=Infinity;
for(let n=0;n<=samples;n++){
  action.paused=false;action.enabled=true;mixer.setTime(n/samples*clip.duration);updateSkin();
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
    const position=n=>bones[n+'_'+side].getWorldPosition(new T.Vector3());
    const W=position('hand'),E=position('lowerarm'),I=position('index_01'),P=position('pinky_01');
    maxWristBend=Math.max(maxWristBend,W.clone().sub(E).angleTo(I.add(P).multiplyScalar(.5).sub(W))*180/Math.PI);
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
const result={samples:samples+1,vertices:meshes.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0),triangles:meshes.reduce((sum,m)=>sum+m.geometry.index.count/3,0),minimumGapMetres:minimum,staffGapMetres:staffGap,loopErrorMetres:loopError,maxWristBendDegrees:maxWristBend,rows};
await writeFile(output,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:undefined}));
if(!Number.isFinite(minimum)||minimum<0||staffGap<0||loopError>.0001||maxWristBend>30)process.exitCode=1;
