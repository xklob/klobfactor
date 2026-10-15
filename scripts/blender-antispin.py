"""Build an editable antispin review scene, then bake its constrained rig to glTF.

Run with Blender 4.5 LTS: blender -b --python scripts/blender-antispin.py --
  --guide GUIDE.json --grips GRIPS.json --rig RIG.json --output DIRECTORY
The source capture is a reference. This preview has not been technique-approved.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Quaternion, Vector
import numpy as np

argsv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--guide',required=True);p.add_argument('--grips',required=True);p.add_argument('--rig',required=True);p.add_argument('--output',required=True);p.add_argument('--keys',type=int,default=34);args=p.parse_args(argsv)
ROOT=Path(__file__).resolve().parent.parent;out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
data=json.loads(Path(args.guide).read_text());grips=json.loads(Path(args.grips).read_text());rows=data['frames'][:args.keys];N=len(rows);FPS=240;STEP=16;END=N*STEP+1
C=Matrix.Rotation(math.pi/2,4,'X');Ci=C.inverted();native=lambda v: C@Vector(v)
qxy=lambda a:Quaternion((a[3],a[0],a[1],a[2]))

def unit(v):return v.normalized() if v.length>1e-8 else Vector((0,0,1))
def smooth(values,passes=2):
 values=np.array(values)
 for _ in range(passes):values=(np.roll(values,1,axis=0)+2*values+np.roll(values,-1,axis=0))/4
 return values

def smooth_quaternions(values):
 q=[qxy(a)for a in values]
 for _ in range(2):
  q=[q[i].slerp(q[(i-1)%N],.25).slerp(q[(i+1)%N],.25)for i in range(N)]
 return q

def material(name,color,metallic=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metallic;n.inputs['Roughness'].default_value=.7;return m

def empty(name,display='SPHERE',size=.035):
 o=bpy.data.objects.new(name,None);controls.objects.link(o);o.empty_display_type=display;o.empty_display_size=size;o.rotation_mode='QUATERNION';return o

previous_quaternions={}
def keys(o,frame):
 previous=previous_quaternions.get(o.name)
 if previous and o.rotation_quaternion.dot(previous)<0:o.rotation_quaternion.negate()
 previous_quaternions[o.name]=o.rotation_quaternion.copy()
 for prop in ['location','rotation_quaternion']:o.keyframe_insert(prop,frame=frame,group=o.name)

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'src/models/performer.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.name='Performer';mesh=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));mesh.name='Body'
for o in list(bpy.data.objects):
 if o.type=='MESH' and o!=mesh:bpy.data.objects.remove(o,do_unlink=True)
controls=bpy.data.collections.new('Animation controls');bpy.context.scene.collection.children.link(controls)
props=bpy.data.collections.new('Staves');bpy.context.scene.collection.children.link(props)
rest={b.name:b.matrix_local.copy()for b in rig.data.bones};bind=json.loads(Path(args.rig).read_text())
# glTF import may orient a bone differently. Preserve its original Blender basis.
correction={n:(C@qxy(b['quaternion']).to_matrix().to_4x4()).inverted()@rest[n].to_3x3().to_4x4()for n,b in bind.items()if n in rest}

def bone_matrix(n,rotation,position):
 m=C@rotation.to_matrix().to_4x4()@correction[n];m.translation=native(position);return m

# Make the anatomy readable without adding separate procedural sleeve surfaces.
skin=material('Skin',(.62,.47,.36));shirt=material('Shirt',(.12,.16,.23));pants=material('Trousers',(.085,.095,.12));shoes=material('Shoes',(.025,.03,.04))
mesh.data.materials.clear()
for m in [skin,shirt,pants,shoes]:mesh.data.materials.append(m)
groups={g.index:g.name for g in mesh.vertex_groups}
for f in mesh.data.polygons:
 weights={}
 for vi in f.vertices:
  for g in mesh.data.vertices[vi].groups:weights[groups[g.group]]=weights.get(groups[g.group],0)+g.weight
 owner=max(weights,key=weights.get)if weights else 'pelvis'
 f.material_index=3 if owner.startswith(('foot','ball')) else 2 if owner.startswith(('thigh','calf','pelvis')) else 1 if owner.startswith(('spine','clavicle')) else 0;f.use_smooth=True

names=list(rows[0]['guide']['bones']);rotations={n:smooth_quaternions([r['guide']['bones'][n]['q']for r in rows])for n in names};positions={n:smooth([r['guide']['bones'][n]['p']for r in rows])for n in names}
# Key the captured torso and stance. Arms get Blender's two-bone IK below.
for k in range(N+1):
 i=k%N;frame=1+k*STEP
 for n in names:
  pb=rig.pose.bones.get(n)
  if not pb:continue
  pb.rotation_mode='QUATERNION';pb.matrix=bone_matrix(n,rotations[n][i],positions[n][i]);pb.scale=(1,1,1)
  if n!='Root':pb.location=(0,0,0)
  bpy.context.view_layer.update();keys(pb,frame)

# Anatomical palm frames from the asset's index/pinky knuckles.
handFrames=[]
for i,s in enumerate(['l','r']):
 wrist=Vector(bind['hand_'+s]['position']);qh=qxy(bind['hand_'+s]['quaternion']);
 a=(Vector(bind['index_01_'+s]['position'])-wrist);b=(Vector(bind['pinky_01_'+s]['position'])-wrist)
 F=unit(a+b);across=(b-a)*(1 if i==0 else -1);P=unit(across.cross(F));X=F.cross(P);frame=Matrix((X,F,P)).transposed().to_quaternion();handFrames.append(qh.inverted()@frame)

black=material('Black shaft',(.012,.014,.018));white=material('White center',(.9,.9,.9));blue=material('Thumb end',(.015,.12,.6));gold=material('Pinky end',(.7,.2,.015))

def cylinder(name,radius,depth,z,mat,parent):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth);o=bpy.context.object;o.name=name
 for c in list(o.users_collection):c.objects.unlink(o)
 props.objects.link(o);o.parent=parent;o.location=(0,0,z);o.data.materials.append(mat)
 for f in o.data.polygons:f.use_smooth=True
 bevel=o.modifiers.new('Soft edges','BEVEL');bevel.width=.0015;bevel.segments=2
 return o

staffs=[];targets=[];poles=[];half=.41
for i,s in enumerate(['l','r']):
 target=empty('Grip '+s);pole=empty('Elbow '+s,'CIRCLE',.07);targets.append(target);poles.append(pole)
 staff=empty('Staff '+s,'ARROWS',.15);staffs.append(staff);staff['side']='left'if i==0 else 'right';staff.parent=rig;staff.parent_type='BONE';staff.parent_bone='hand_'+s
 cylinder('Shaft '+s,.0105,half*2,0,black,staff);cylinder('Grip '+s,.0122,.13,0,black,staff);cylinder('Center '+s,.0122,.018,0,white,staff)
 for end,mat in [(1,blue),(-1,gold)]:cylinder(('Thumb 'if end==1 else 'Pinky ')+s,.020,.056,end*(half-.04),mat,staff)
 arm=rig.pose.bones['lowerarm_'+s];ik=arm.constraints.new('IK');ik.name='Hand position';ik.target=target;ik.pole_target=pole;ik.chain_count=2;ik.iterations=64;ik.use_stretch=False
 rig.pose.bones['upperarm_'+s].ik_stretch=0;arm.ik_stretch=0
 hand=rig.pose.bones['hand_'+s];copy=hand.constraints.new('COPY_ROTATION');copy.name='Grip orientation';copy.target=target;copy.target_space='WORLD';copy.owner_space='WORLD'

# Shaft counterrotation is authored independently of the wrist. A straight wrist
# and a moving thumb/index support keep the hand from winding around the shaft.
wrist=np.stack([positions['hand_l'],positions['hand_r']],1);elbows=np.stack([positions['lowerarm_l'],positions['lowerarm_r']],1)
center=(wrist.max(0)+wrist.min(0))/2;radius=(wrist.max(0)-wrist.min(0))/2
angles=np.unwrap(np.arctan2((wrist[:,:,1]-center[None,:,1])/radius[None,:,1],(wrist[:,:,0]-center[None,:,0])/radius[None,:,0]),axis=0)
angles[:,1]+=2*math.pi*round((angles[0,0]+math.pi-angles[0,1])/(2*math.pi));angles=(angles[:,0]+angles[:,1]-math.pi)/2
# Remove source speed noise while retaining the source's nonuniform timing.
linear=angles[0]-2*math.pi*np.arange(N)/N;angles=linear+smooth(angles-linear)
# Author a stable support change around each side checkpoint. Smoothing the
# palm roll around the shaft avoids an abrupt 180-degree hand flip as the
# forearm and shaft become parallel. Blender owns the arm solve and playback.
raw=[]
for i in range(N):
 pair=[]
 for side,s in enumerate(['l','r']):
  sign=1 if side else -1;theta=float(angles[i]+side*math.pi);axis=Vector((math.cos(theta),-math.sin(theta),0));W=Vector(wrist[i,side]);W.x*=.94;W.z=min(W.z,-.22)if side==0 else max(W.z,.22);E=Vector(elbows[i,side]);E.z*=.3;F=unit(W-E);P=unit(axis.cross(F)*sign);pivot=math.acos(max(-1,min(1,F.dot(axis))));roll=math.atan2(P.dot(Vector((0,0,1)).cross(axis)),P.z)
  degree=pivot*180/math.pi;a=min(len(grips)-2,int(degree));u=degree-a;contact=Vector(np.array(grips[a]['c'])*(1-u)+np.array(grips[a+1]['c'])*u);R=F.cross(P)*sign;G=W+R*contact.x+F*contact.y+P*contact.z
  pair.append({'roll':roll,'pivot':pivot,'grip':list(G)})
 raw.append(pair)
rolls=np.unwrap(np.array([[a['roll']for a in r]for r in raw]),axis=0)
rolls=smooth(rolls,2);pivots=smooth(np.array([[a['pivot']for a in r]for r in raw]),1);centers=np.array([[a['grip']for a in r]for r in raw])
def interpolate(values,t):
 k=int(t)%N;f=t-int(t);return values[k]*(1-f)+values[(k+1)%N]*f
report=[]
for k in range(N*STEP+1):
 t=k/STEP;i=int(t)%N;frame=1+k;bpy.context.scene.frame_set(frame)
 for side,s in enumerate(['l','r']):
  sign=1 if side else -1;theta=float(interpolate(angles+2*math.pi*np.arange(N)/N,t)-2*math.pi*t/N+side*math.pi);axis=Vector((math.cos(theta),-math.sin(theta),0));roll=float(interpolate(rolls,t)[side]);pivot=float(interpolate(pivots,t)[side]);P=Vector((0,0,1))*math.cos(roll)+Vector((0,0,1)).cross(axis)*math.sin(roll);F=Quaternion(P,sign*pivot)@axis;R=F.cross(P)*sign
  degree=pivot*180/math.pi;a=min(len(grips)-2,int(degree));u=degree-a;gp={name:np.array(grips[a][name])*(1-u)+np.array(grips[a+1][name])*u for name in ['f','t','c']};contact=gp['c'];W=Vector(interpolate(wrist,t)[side]);W.x*=.94;W.z=min(W.z,-.22)if side==0 else max(W.z,.22);E=Vector(interpolate(elbows,t)[side]);E.z*=.3;S=Ci@(rig.matrix_world@rig.pose.bones['upperarm_'+s].head);delta=W-S
  if delta.length>.475:W=S+delta.normalized()*.475
  G=W+R*contact[0]+F*contact[1]+P*contact[2]
  palm=Matrix((F.cross(P),F,P)).transposed().to_quaternion();handQ=palm@handFrames[side].inverted();target=targets[side];target.matrix_world=bone_matrix('hand_'+s,handQ,W);keys(target,frame)
  D=unit(W-S);bend=unit(E-S-D*(E-S).dot(D));poles[side].location=native(E+bend*.28);keys(poles[side],frame)
  bpy.context.view_layer.update();actualW=Ci@(rig.matrix_world@rig.pose.bones['hand_'+s].head);G=actualW+R*contact[0]+F*contact[1]+P*contact[2]
  staff=staffs[side];matrix=Vector((0,0,1)).rotation_difference(native(axis)).to_matrix().to_4x4();matrix.translation=native(G);staff.matrix_world=matrix;keys(staff,frame)
  for name in grips[a]['rotations']:
   if not name.endswith('_'+s):continue
   q0=qxy(grips[a]['rotations'][name]);q1=qxy(grips[a+1]['rotations'][name]);delta=q0.slerp(q1,u)
   change=rest[name].to_quaternion().inverted()@C.to_quaternion()@qxy(bind[name]['quaternion'])
   pb=rig.pose.bones[name];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=change@delta@change.inverted();pb.keyframe_insert('rotation_quaternion',frame=frame,group=name)
  target['support_degrees']=degree;target.keyframe_insert(data_path='["support_degrees"]',frame=frame)
  report.append({'frame':frame,'side':s,'pivot':degree,'axis':list(axis),'wrist':list(W),'grip':list(G),'palm':list(P),'fingers':list(F),'fingerAngles':gp['f'].tolist(),'thumbAngles':gp['t'].tolist()})

# Linear channels preserve the authored contacts between sampled keys without
# independent Bezier handles overshooting the thumb or staff transforms.
for action in bpy.data.actions:
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'

# Calibrate each IK pole against the first captured elbow, avoiding guessed bone-roll conventions.
bpy.context.scene.frame_set(1)
for side,s in enumerate(['l','r']):
 ik=rig.pose.bones['lowerarm_'+s].constraints['Hand position'];expected=native(elbows[0,side]);best=(1e9,0)
 for deg in range(-180,181,2):
  ik.pole_angle=math.radians(deg);bpy.context.view_layer.update();actual=rig.matrix_world@rig.pose.bones['lowerarm_'+s].head;distance=(actual-expected).length
  if distance<best[0]:best=(distance,deg)
 ik.pole_angle=math.radians(best[1]);print('POLE',s,best,flush=True)

# The editable file keeps controls and source reference. Export bakes constraints.
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=END;scene.render.fps=FPS;scene['source_video']='https://www.youtube.com/watch?v=pRoRKPIewhE&t=505s';scene['technique_status']='Review preview; not approved';scene['source_start']=505;scene['period']=N/15
scene.timeline_markers.new('Start',frame=1);scene.timeline_markers.new('Opposite high / low',frame=1+N*2);scene.timeline_markers.new('Loop',frame=END)
# Keep the source demonstration local to the authoring scene.
reference=empty('Source footage','IMAGE',1);reference['path']=str(ROOT/'source-videos/pRoRKPIewhE.mp4');reference.hide_render=True
scene.frame_set(1);bpy.context.view_layer.update()
# Neutral studio setup is stored in Blender; the browser supplies its own camera.
world=scene.world or bpy.data.worlds.new('World');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.13,.16,1)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'antispin-split-same.blend'))
# Export only the performer and solid props. Empty control objects are baked through their children.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True)
for o in props.objects:o.select_set(True)
for o in staffs:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/'antispin-split-same.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='SCENE',export_anim_scene_split_object=False,export_anim_slide_to_zero=True,export_force_sampling=True,export_frame_range=True,export_frame_step=1,export_bake_animation=True,export_extras=True)
(out/'authoring-report.json').write_text(json.dumps({'source':scene['source_video'],'period':N/15,'status':'preview','frames':report},indent=2))
print('SCENE_READY',str(out/'antispin-split-same.blend'),flush=True)
