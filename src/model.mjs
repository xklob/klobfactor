import * as THREE from './vendor/three.module.js';
import {HALF_STAFF} from './motion.mjs';
const up=new THREE.Vector3(0,1,0),v=a=>new THREE.Vector3(...a);
// Props and a stationary spatial reference. No inferred human motion is drawn.
export class DiagramModel {
 constructor(world){
  this.owned=[];this.sphere=new THREE.SphereGeometry(1,32,24);this.cylinder=new THREE.CylinderGeometry(1,1,1,32);
  this.materials={reference:new THREE.MeshStandardMaterial({color:0x667084,roughness:1,transparent:true,opacity:.36,depthWrite:false}),staff:new THREE.MeshStandardMaterial({color:0x111318,roughness:.35,metalness:.18}),white:new THREE.MeshStandardMaterial({color:0xf2f2ed,roughness:.7}),thumb:new THREE.MeshStandardMaterial({color:0x67b9f5,roughness:.5}),pinky:new THREE.MeshStandardMaterial({color:0xf2ac59,roughness:.5})};
  this.body=new THREE.Group();world.add(this.body);
  const m=this.materials.reference;
  this.ball(this.body,m,[0,.70,0],[.37,.72,.20]);this.ball(this.body,m,[0,1.82,0],[.19,.28,.18]);this.bone(this.body,m,[0,1.3,0],[0,1.62,0],.11);
  this.ball(this.body,m,[0,0,0],[.29,.22,.19]);
  for(const s of [-1,1]){
   this.bone(this.body,m,[s*.40,1.30,0],[s*.54,.70,.02],.085);this.bone(this.body,m,[s*.54,.70,.02],[s*.58,.13,.08],.065);this.ball(this.body,m,[s*.58,.02,.08],[.065,.13,.04]);
   this.bone(this.body,m,[s*.17,0,0],[s*.3,-.8,.06],.11);this.bone(this.body,m,[s*.3,-.8,.06],[s*.4,-1.62,0],.085);this.ball(this.body,m,[s*.4,-1.70,.10],[.11,.08,.23]);
  }
  this.hands=[0,1].map(()=>{
   const root=new THREE.Group(),staff=new THREE.Group();root.add(staff);world.add(root);
   this.bone(staff,this.materials.staff,[0,-HALF_STAFF+.06,0],[0,HALF_STAFF-.06,0],.024);
   this.bone(staff,this.materials.staff,[0,-.15,0],[0,.15,0],.027);
   this.bone(staff,this.materials.white,[0,-.013,0],[0,.013,0],.028);
   const cap=new THREE.CapsuleGeometry(.046,.082,8,24);this.owned.push(cap);
   for(const sign of [-1,1]){const end=this.mesh(staff,cap,sign>0?this.materials.thumb:this.materials.pinky);end.position.y=sign*(HALF_STAFF-.087);}
   return {root,staff};
  });
 }
 mesh(parent,geometry,material){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 ball(parent,material,position,scale){const m=this.mesh(parent,this.sphere,material);m.position.fromArray(position);m.scale.fromArray(scale);return m;}
 bone(parent,material,a,b,r){const m=this.mesh(parent,this.cylinder,material),d=v(b).sub(v(a));m.position.copy(v(a).add(v(b)).multiplyScalar(.5));m.scale.set(r,d.length(),r);m.quaternion.setFromUnitVectors(up,d.normalize());return m;}
 dispose(){this.sphere.dispose();this.cylinder.dispose();this.owned.forEach(g=>g.dispose());Object.values(this.materials).forEach(m=>m.dispose());}
}
