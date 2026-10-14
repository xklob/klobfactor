import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sampleMotion,armPose} from './motion.mjs';

const v = a => new THREE.Vector3(...a);
const up = new THREE.Vector3(0,1,0);
const presets = {isometric:[7,7,7],front:[0,0,12],side:[12,0,0],top:[0,12,.001]};

// A depth-tested scene: shafts, hands and arms occlude one another at their
// actual model positions. The model is schematic, not motion capture.
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
    this.insetCamera=new THREE.OrthographicCamera(-.28,.28,.25,-.25,.01,100);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=false;this.controls.minZoom=.5;this.controls.maxZoom=7;
    this.controls.minPolarAngle=.01;this.controls.maxPolarAngle=Math.PI-.01;
    this.controls.addEventListener('change',()=>{if(!this.settingView){this.onCamera?.();}this.draw();});
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x707889,2));
    const light=new THREE.DirectionalLight(0xffffff,2.1);light.position.set(-3,6,8);this.scene.add(light);
    this.geometries={sphere:new THREE.SphereGeometry(1,16,12),cylinder:new THREE.CylinderGeometry(1,1,1,12),ring:new THREE.TorusGeometry(.052,.014,8,24)};
    this.materials={};
    for(const key of ['body','arm','hand','left','right','thumb','pinky'])this.materials[key]=new THREE.MeshStandardMaterial({roughness:.7});
    this.bodyGroup=new THREE.Group();this.world.add(this.bodyGroup);
    this.buildBody();
    this.handGroups=[0,1].map(i=>this.buildHand(i));
    this.armGroups=[0,1].map(()=>{
      const g=new THREE.Group();this.bodyGroup.add(g);
      return {group:g,upper:this.bone(g,this.materials.arm),lower:this.bone(g,this.materials.arm),elbow:this.ball(g,this.materials.arm)};
    });
    this.pathGroup=new THREE.Group();this.world.add(this.pathGroup);
    this.landmarkGroup=new THREE.Group();this.world.add(this.landmarkGroup);
    this.grid=new THREE.GridHelper(4,8,0x34373f,0x2d3038);this.grid.position.y=-1.82;this.grid.material.vertexColors=false;this.grid.material.transparent=true;this.grid.material.opacity=.28;this.world.add(this.grid);
    this.labels=stage.querySelector('.scene-labels');
    this.inset=stage.querySelector('.grip-picture');
    this.insetLabels=this.inset.querySelector('.grip-labels');
    this.insetControls=new OrbitControls(this.insetCamera,this.inset.querySelector('.grip-window'));
    this.insetControls.enablePan=false;this.insetControls.minZoom=.7;this.insetControls.maxZoom=3;
    this.insetControls.addEventListener('change',()=>{if(!this.settingInset)this.draw();});

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
  buildBody() {
    const g=this.bodyGroup,m=this.materials.body;
    this.ball(g,m,[0,.72,0],[.30,.67,.18]);
    this.ball(g,m,[0,.05,0],[.31,.21,.2]);
    this.neck=this.bone(g,m,[0,1.34,0],[0,1.58,0],.12);
    this.head=this.ball(g,m,[0,1.82,0],[.2,.26,.19]);
    this.nose=this.ball(g,this.materials.arm,[0,1.82,.19],[.045,.04,.065]);
    for(const side of [-1,1]) {
      this.ball(g,m,[side*.45,1.3,0],[.115,.13,.13]);
      this.bone(g,m,[side*.18,.04,0],[side*.31,-.81,.06],.105);
      this.bone(g,m,[side*.31,-.81,.06],[side*.43,-1.62,0],.075);
      this.ball(g,m,[side*.43,-1.7,.12],[.11,.075,.23]);
    }
  }
  buildHand(index) {
    const group=new THREE.Group();this.world.add(group);
    const staff=new THREE.Group();group.add(staff);
    this.bone(staff,this.materials[index?'right':'left'],[0,-.72,0],[0,.72,0],.027);
    this.ball(staff,this.materials.thumb,[0,.72,0],[.057,.057,.057]);
    this.bone(staff,this.materials.pinky,[0,-.72,0],[0,-.65,0],.035);
    const ring=new THREE.Mesh(this.geometries.ring,this.materials.pinky);ring.rotation.x=Math.PI/2;ring.position.y=-.72;staff.add(ring);
    const hand=new THREE.Group();group.add(hand);
    this.ball(hand,this.materials.hand,[.09,-.005,0],[.08,.155,.055]);
    const ys=[.105,.035,-.04,-.11];
    for(let i=0;i<4;i++) {
      const y=ys[i],mat=i===3?this.materials.pinky:this.materials.hand;
      const joints=[[.13,y,.01],[.065,y,.067],[-.035,y,.055],[-.055,y,-.006]];
      for(let j=0;j<3;j++)this.bone(hand,mat,joints[j],joints[j+1],.018);
      for(const joint of joints.slice(1))this.ball(hand,mat,joint,[.02,.02,.02]);
    }
    const thumb=[[.135,.04,-.035],[.06,.135,-.075],[-.035,.13,-.02]];
    for(let i=0;i<2;i++)this.bone(hand,this.materials.thumb,thumb[i],thumb[i+1],.025);
    this.ball(hand,this.materials.thumb,thumb[2],[.027,.027,.027]);
    const openHand=new THREE.Group();group.add(openHand);openHand.visible=false;
    this.ball(openHand,this.materials.hand,[-.035,0,0],[.11,.08,.035]);
    for(const y of [.065,.022,-.022,-.065])this.bone(openHand,this.materials.hand,[-.07,y,0],[-.24,y,0],.018);
    this.bone(openHand,this.materials.hand,[.025,.05,0],[-.025,.15,0],.025);
    return {group,staff,hand,openHand};
  }
  theme() {
    const css=getComputedStyle(document.documentElement),color=name=>css.getPropertyValue(name).trim();
    const palette={body:'--body',arm:'--arm',hand:'--hand-outline',left:'--green',right:'--orange',thumb:'--thumb',pinky:'--pinky'};
    for(const [key,name]of Object.entries(palette))this.materials[key].color.set(color(name));
    this.scene.background=new THREE.Color(color('--stage'));
    this.grid.material.color.set(color('--grid'));
    if(this.spec)this.makePaths();this.draw();
  }
  resize() {
    const {width,height}=this.stage.getBoundingClientRect();if(!width||!height)return;
    this.width=width;this.height=height;this.renderer.setSize(width,height,false);
    const aspect=width/height,half=2.85;
    this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;this.camera.updateProjectionMatrix();this.draw();
  }
  setView(name='isometric') {
    this.settingView=true;this.camera.zoom=1;this.camera.up.set(0,1,0);
    this.controls.target.set(0,.55,0);this.camera.position.copy(this.controls.target).add(v(presets[name]||presets.isometric));
    this.camera.lookAt(this.controls.target);this.camera.updateProjectionMatrix();this.controls.update();
    this.settingView=false;this.draw();
  }
  zoom(factor) {this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,.5,7);this.camera.updateProjectionMatrix();this.draw();}
  focusHand(index) {
    if(!this.state?.hands[index])return;
    this.world.updateMatrixWorld(true);
    const target=this.handGroups[index].group.getWorldPosition(new THREE.Vector3());
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
      const path=new THREE.Line(geometry,material);path.userData.owned=true;this.pathGroup.add(path);
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
    this.bodyGroup.visible=options.body;this.pathGroup.visible=options.trails;this.grid.visible=options.body;
    this.head.position.x=this.nose.position.x=state.headLean||0;this.setBone(this.neck,[0,1.34,0],[state.headLean||0,1.58,0],.12);
    for(const name of ['body','arm']) {
      const m=this.materials[name];m.transparent=Boolean(options.xray);m.opacity=options.xray?.18:1;m.depthWrite=!options.xray;
    }
    for(let i=0;i<2;i++) {
      const model=this.handGroups[i],h=state.hands[i]||state.guideHands?.[i],arm=this.armGroups[i];
      model.group.visible=Boolean(h);arm.group.visible=Boolean(h);model.hand.visible=Boolean(state.hands[i]);model.openHand.visible=Boolean(h)&&!state.hands[i];if(!h)continue;
      const pose=armPose(h,i);this.setBone(arm.upper,pose.shoulder,pose.elbow,.06);this.setBone(arm.lower,pose.elbow,h.center,.048);arm.elbow.position.fromArray(pose.elbow);arm.elbow.scale.setScalar(.068);
      // Orient the palm from the forearm; local +Y always points thumb-ward.
      const y=v(h.axis),x=v(pose.elbow).sub(v(h.center));x.addScaledVector(y,-x.dot(y));
      if(x.lengthSq()<1e-5){x.set(0,0,1);x.addScaledVector(y,-x.dot(y));}x.normalize();
      const z=new THREE.Vector3().crossVectors(x,y).normalize();
      model.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));model.group.position.fromArray(h.center);model.staff.visible=Boolean(state.hands[i])&&!this.spec.handsOnly;
    }
    const frame=this.spec.frames?.[Math.min(this.spec.frames.length-1,Math.floor(state.phase*this.spec.frames.length))];
    for(const {mark,mesh}of this.marks||[])mesh.scale.setScalar(frame?.active?.includes(mark.id)?.08:.045);
    this.inset.hidden=!options.inset||!state.hands.length;
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
    this.labels.innerHTML=h.map((hand,i)=>this.label(i?'R':'L',hand.center,i?'right-label':'left-label',overlap?(i?22:-22):18,-25)).join('')+(this.spec.landmarks||[]).map(mark=>this.label(mark.label,mark.position,'landmark-label',0,-20)).join('');
    this.stage.dataset.overlap=String(overlap);this.stage.dataset.staffCount=String(h.length);
    this.stage.querySelector('.scene-status').textContent=h.length===1?'1 staff · solo drill':h.length===2?(overlap?'2 staves · overlap in this view':'2 staves'):'';
    this.stage.dataset.camera=this.camera.position.toArray().map(n=>n.toFixed(3)).join(',');this.stage.dataset.zoom=this.camera.zoom.toFixed(3);
    if(this.options.inset&&h.length) {
      const index=Math.min(this.options.insetHand||0,h.length-1),model=this.handGroups[index].group;
      const target=model.localToWorld(new THREE.Vector3(0,0,0));
      this.settingInset=true;
      if(this.insetIndex!==index){
        const direction=model.localToWorld(new THREE.Vector3(1,.5,-2)).sub(target);
        this.insetCamera.position.copy(target).add(direction);this.insetCamera.up.set(0,1,0);this.insetCamera.zoom=1;this.insetIndex=index;
      }else this.insetCamera.position.add(target.clone().sub(this.insetControls.target));
      this.insetControls.target.copy(target);this.insetControls.update();this.settingInset=false;
      this.stage.dataset.insetCamera=this.insetCamera.position.clone().sub(target).toArray().map(n=>n.toFixed(3)).join(',');
      const box=this.inset.querySelector('.grip-window').getBoundingClientRect(),stage=this.stage.getBoundingClientRect();
      const left=box.left-stage.left,bottom=stage.bottom-box.bottom,w=box.width,height=box.height;
      this.insetCamera.left=-.26*w/height;this.insetCamera.right=.26*w/height;this.insetCamera.updateProjectionMatrix();
      // Isolate only the selected grip in this viewport, leaving the main view intact.
      const hidden=[this.bodyGroup,this.pathGroup,this.landmarkGroup,this.grid,this.handGroups[1-index].group];
      const visible=hidden.map(o=>o.visible);hidden.forEach(o=>o.visible=false);
      this.renderer.setScissor(left,bottom,w,height);this.renderer.setViewport(left,bottom,w,height);this.renderer.setScissorTest(true);this.renderer.clearDepth();this.renderer.render(this.scene,this.insetCamera);
      hidden.forEach((o,i)=>o.visible=visible[i]);this.renderer.setScissorTest(false);
      this.insetLabels.innerHTML='<span class="thumb-key">● Thumb</span><span class="pinky-key">○ Pinky</span><span class="grip-schematic">Schematic grip · drag to rotate</span>';
    }
  }
  destroy() {
    this.controls.dispose();this.insetControls.dispose();this.observer.disconnect();this.themeObserver.disconnect();
    this.clearGroup(this.pathGroup);this.clearGroup(this.landmarkGroup);
    for(const g of Object.values(this.geometries))g.dispose();for(const m of Object.values(this.materials))m.dispose();this.renderer.dispose();
  }
}
