import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sampleMotion} from './motion.mjs';
import {DiagramModel} from './model.mjs';


const v = a => new THREE.Vector3(...a);
const up = new THREE.Vector3(0,1,0);
const presets = {isometric:[7,5,9],front:[0,0,12],side:[12,0,0],top:[0,12,.001]};

// Depth-tested prop geometry and stationary spatial landmarks.
export class StaffScene {
  constructor(stage,onCamera) {
    this.stage=stage;this.onCamera=onCamera;this.state=null;this.options={};
    this.scene=new THREE.Scene();this.world=new THREE.Group();this.scene.add(this.world);
    this.world.scale.x=-1;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.domElement.className='motion-canvas';
    this.renderer.domElement.setAttribute('aria-label','Double staff model. Drag to orbit, scroll to zoom, right-drag to pan.');
    this.renderer.domElement.tabIndex=0;
    stage.prepend(this.renderer.domElement);
    this.camera=new THREE.OrthographicCamera(-4,4,3,-3,.01,100);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=false;this.controls.minZoom=.5;this.controls.maxZoom=7;
    this.controls.minPolarAngle=.01;this.controls.maxPolarAngle=Math.PI-.01;
    this.controls.addEventListener('change',()=>{if(!this.settingView){this.onCamera?.();}this.draw();});
    this.scene.add(new THREE.HemisphereLight(0xf0f5ff,0x484554,1.7));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    const light=new THREE.DirectionalLight(0xfff2e4,3);light.position.set(-3,6,8);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.normalBias=.025;this.scene.add(light);
    const rim=new THREE.DirectionalLight(0xb7d5ff,2.2);rim.position.set(4,3,-5);this.scene.add(rim);
    this.geometries={sphere:new THREE.SphereGeometry(1,16,12),cylinder:new THREE.CylinderGeometry(1,1,1,12),ring:new THREE.TorusGeometry(.052,.014,8,24)};
    this.materials={};
    for(const key of ['body','arm','hand','left','right','thumb','pinky'])this.materials[key]=new THREE.MeshStandardMaterial({roughness:.7});
    this.anatomy=new DiagramModel(this.world);this.bodyGroup=this.anatomy.body;
    this.handGroups=this.anatomy.hands;
    this.handGroups.forEach((hand,i)=>{hand.marker=this.ball(hand.root,this.materials[i?'right':'left'],[0,0,0],[.055,.055,.055]);hand.marker.visible=false;});
    this.pathGroup=new THREE.Group();this.world.add(this.pathGroup);
    this.landmarkGroup=new THREE.Group();this.world.add(this.landmarkGroup);
    this.environment=new THREE.Group();this.scene.add(this.environment);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(3.8,96),new THREE.MeshStandardMaterial({color:0x262c38,roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-1.80;floor.receiveShadow=true;this.environment.add(floor);this.floor=floor;
    this.grid=new THREE.GridHelper(7,14,0x71829b,0x566172);this.grid.position.y=-1.795;this.grid.material.transparent=true;this.grid.material.opacity=.20;this.environment.add(this.grid);
    const ring=new THREE.Mesh(new THREE.RingGeometry(2.15,2.17,96),new THREE.MeshBasicMaterial({color:0x71829b,transparent:true,opacity:.35,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-1.79;this.environment.add(ring);
    this.floorLabel('FRONT',[0,-1.785,2.6]);this.floorLabel('BACK',[0,-1.785,-2.6],Math.PI);
    this.labels=stage.querySelector('.scene-labels');
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(stage);
    this.themeObserver=new MutationObserver(()=>this.theme());
    this.themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    this.setView('isometric');this.theme();this.resize();
  }
  ball(group,material,position=[0,0,0],scale=[1,1,1]) {
    const mesh=new THREE.Mesh(this.geometries.sphere,material);mesh.position.fromArray(position);mesh.scale.fromArray(scale);group.add(mesh);return mesh;
  }
  bone(group,material,a=[0,0,0],b=[0,1,0],radius=.04) {
    const mesh=new THREE.Mesh(this.geometries.cylinder,material);group.add(mesh);this.setBone(mesh,a,b,radius);return mesh;
  }
  setBone(mesh,a,b,radius) {
    const start=v(a),end=v(b),direction=end.clone().sub(start);
    mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.scale.set(radius,Math.max(.001,direction.length()),radius);
    mesh.quaternion.setFromUnitVectors(up,direction.normalize());
  }
  floorLabel(text,position,rotation=0) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#8b96ab';ctx.textAlign='center';ctx.font='500 42px sans-serif';ctx.fillText(text,256,80);
    const texture=new THREE.CanvasTexture(canvas),mesh=new THREE.Mesh(new THREE.PlaneGeometry(.8,.2),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    mesh.rotation.set(-Math.PI/2,0,rotation);mesh.position.fromArray(position);this.environment.add(mesh);
  }
  theme() {
    const css=getComputedStyle(document.documentElement),color=name=>css.getPropertyValue(name).trim();
    const palette={body:'--body',arm:'--arm',hand:'--hand-outline',left:'--green',right:'--orange',thumb:'--thumb',pinky:'--pinky'};
    for(const [key,name]of Object.entries(palette))this.materials[key].color.set(color(name));
    this.scene.background=new THREE.Color(document.documentElement.dataset.theme==='light'?0xe5e7eb:0x333741);
    this.floor.material.color.set(document.documentElement.dataset.theme==='light'?0xdfe2e8:0x252b36);
    if(this.spec)this.makePaths();this.draw();
  }
  resize() {
    const {width,height}=this.stage.getBoundingClientRect();if(!width||!height)return;
    this.width=width;this.height=height;this.renderer.setSize(width,height,false);
    const aspect=width/height,half=2.45;
    this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();this.draw();
  }
  setView(name='isometric') {
    this.settingView=true;this.camera.zoom=1;this.camera.up.set(0,1,0);
    this.controls.target.set(0,1.15,.55);this.camera.position.copy(this.controls.target).add(v(presets[name]||presets.isometric));
    this.camera.lookAt(this.controls.target);this.camera.updateProjectionMatrix();this.controls.update();
    this.settingView=false;this.draw();
  }
  zoom(factor) {this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,.5,7);this.camera.updateProjectionMatrix();this.draw();}
  focusHand(index) {
    if(!this.state?.hands[index])return;
    this.world.updateMatrixWorld(true);
    const target=this.handGroups[index].root.getWorldPosition(new THREE.Vector3());
    const delta=this.camera.position.clone().sub(this.controls.target);this.controls.target.copy(target);this.camera.position.copy(target).add(delta);this.camera.zoom=3.5;this.camera.updateProjectionMatrix();this.controls.update();this.draw();
  }
  configure(spec) {this.spec=spec;this.makePaths();this.makeLandmarks();}
  clearGroup(group) {
    while(group.children.length){const child=group.children[0];group.remove(child);if(child.userData.owned){child.geometry.dispose();child.material.dispose();}}
  }
  makePaths() {
    this.clearGroup(this.pathGroup);if(!this.spec||this.spec.kind==='study'||this.spec.handsOnly)return;
    const count=sampleMotion(this.spec,0).hands.length;
    for(let i=0;i<count;i++)for(const end of ['thumb','pinky']) {
      const points=Array.from({length:181},(_,j)=>v(sampleMotion(this.spec,j/180).hands[i][end]));
      const geometry=new THREE.BufferGeometry().setFromPoints(points);
      const material=new THREE.LineBasicMaterial({color:this.materials[i?'right':'left'].color,transparent:true,opacity:end==='thumb'?.25:.14,depthWrite:false});
      const path=new THREE.Line(geometry,material);path.userData.owned=true;path.userData.hand=i;this.pathGroup.add(path);
    }
  }
  makeLandmarks() {
    this.clearGroup(this.landmarkGroup);this.marks=[];
    for(const mark of this.spec.landmarks||[]) {
      const mesh=this.ball(this.landmarkGroup,this.materials.left,mark.position,[.045,.045,.045]);this.marks.push({mark,mesh});
    }
    for(const [from,to]of this.spec.edges||[]) {
      const a=this.spec.landmarks.find(p=>p.id===from),b=this.spec.landmarks.find(p=>p.id===to);if(!a||!b)continue;
      const geometry=new THREE.BufferGeometry().setFromPoints([v(a.position),v(b.position)]);
      const material=new THREE.LineBasicMaterial({color:this.materials.arm.color});
      const line=new THREE.Line(geometry,material);line.userData.owned=true;this.landmarkGroup.add(line);
    }
  }
  update(state,options) {
    this.state=state;this.options=options;this.world.scale.x=options.mirror?1:-1;
    this.bodyGroup.visible=options.body&&state.referenceBody;this.pathGroup.visible=options.trails;
    this.pathGroup.children.forEach(p=>p.visible=options.staffVisible?.[p.userData.hand]!==false);
    for(let i=0;i<2;i++){
      const model=this.handGroups[i],h=state.hands[i],visible=options.staffVisible?.[i]!==false;
      model.root.visible=Boolean(h)&&visible;if(!h)continue;
      model.root.position.fromArray(h.center);model.staff.quaternion.setFromUnitVectors(up,v(h.axis));
      model.staff.visible=!this.spec.handsOnly;model.marker.visible=Boolean(this.spec.handsOnly);
    }
    const frame=this.spec.frames?.[Math.min(this.spec.frames.length-1,Math.floor(state.phase*this.spec.frames.length))];
    for(const {mark,mesh}of this.marks||[])mesh.scale.setScalar(frame?.active?.includes(mark.id)?.08:.045);
    this.draw();
  }
  screen(point,camera=this.camera,width=this.width,height=this.height) {
    const q=this.world.localToWorld(v(point)).project(camera);
    return {x:(q.x+1)*width/2,y:(1-q.y)*height/2,visible:q.z>=-1&&q.z<=1};
  }
  label(text,point,className='',dx=0,dy=0) {
    const p=this.screen(point);if(!p.visible)return '';
    return `<span class="scene-label ${className}" style="left:${p.x+dx}px;top:${p.y+dy}px">${text}</span>`;
  }
  draw() {
    if(!this.renderer||!this.width)return;
    this.world.updateMatrixWorld(true);
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.render(this.scene,this.camera);
    if(!this.state)return;
    const h=this.state.hands,overlap=h.length===2&&(()=>{const a=this.screen(h[0].center),b=this.screen(h[1].center);return Math.hypot(a.x-b.x,a.y-b.y)<32;})();
    this.labels.innerHTML=h.map((hand,i)=>this.options.staffVisible?.[i]===false?'':this.label(i?'R':'L',hand.center,i?'right-label':'left-label',overlap?(i?22:-22):18,-25)).join('')+(this.spec.landmarks||[]).map(mark=>this.label(mark.label,mark.position,'landmark-label',0,-20)).join('');
    this.stage.dataset.representation=this.state.referenceBody?'reference':'pattern';this.stage.dataset.bodyAnimated='false';this.stage.dataset.overlap=String(overlap);this.stage.dataset.staffCount=String(h.length);this.stage.dataset.visibleStaffCount=String(h.filter((_,i)=>this.options.staffVisible?.[i]!==false).length);
    const visible=h.filter((_,i)=>this.options.staffVisible?.[i]!==false).length;
    this.stage.querySelector('.scene-status').textContent=this.spec.handsOnly?`${visible} of ${h.length} hand paths`:visible<h.length?`${visible} of ${h.length} staves visible`:h.length===1?'1 staff · solo study':h.length===2?(overlap?'2 staves · overlap in this view':'2 staves'):'';
    this.stage.dataset.camera=this.camera.position.toArray().map(n=>n.toFixed(3)).join(',');this.stage.dataset.zoom=this.camera.zoom.toFixed(3);
  }
  destroy() {
    this.controls.dispose();this.anatomy.dispose();
    this.environment.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});this.observer.disconnect();this.themeObserver.disconnect();
    this.clearGroup(this.pathGroup);this.clearGroup(this.landmarkGroup);
    for(const g of Object.values(this.geometries))g.dispose();for(const m of Object.values(this.materials))m.dispose();this.renderer.dispose();
  }
}
