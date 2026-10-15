"""Author the antispin review on the anatomical Rigify character.

The sampled capture guides the body. Hands and staff support remain a review
draft and must be checked against the footage, not certified by an angle limit.
"""
import argparse, json, math, sys, subprocess
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector, Quaternion, Matrix

p=argparse.ArgumentParser()
p.add_argument('--character',required=True)
p.add_argument('--guide',required=True)
p.add_argument('--output',required=True)
p.add_argument('--renders',action='store_true')
p.add_argument('--contacts')
p.add_argument('--offline',action='store_true',help='Use cached Python authoring dependencies')
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
contacts=json.loads(Path(args.contacts).read_text())['frames'] if args.contacts else None
bpy.ops.wm.open_mainfile(filepath=str(Path(args.character).resolve()))
scene=bpy.context.scene;rig=bpy.data.objects['Performer']
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
viewport_modifiers=[]
for obj in bpy.data.objects:
    if obj.type=='MESH' and obj.parent==rig:
        for modifier in obj.modifiers:
            viewport_modifiers.append((modifier,modifier.show_viewport))
            modifier.show_viewport=False
source=json.loads(Path(args.guide).read_text());rows=source['frames'][:34];N=len(rows);FPS=60;STEP=4
bind=source['rig']['bones']
C=Matrix.Rotation(math.pi/2,4,'X');Ci=C.inverted();CQ=C.to_quaternion()
def vector(a):return C@Vector(a)
def quat(a):return Quaternion((a[3],a[0],a[1],a[2]))
def unit(v):return v.normalized() if v.length>1e-8 else Vector((0,0,1))
def smooth(values,passes=1):
    values=np.asarray(values)
    for _ in range(passes):values=(np.roll(values,1,axis=0)+2*values+np.roll(values,-1,axis=0))/4
    return values
def at(values,t):
    i=int(t)%N;f=t-int(t)
    if isinstance(values[0],Quaternion):return values[i].slerp(values[(i+1)%N],f)
    return values[i]*(1-f)+values[(i+1)%N]*f
names=list(rows[0]['guide']['bones'])
positions={n:smooth([r['guide']['bones'][n]['p']for r in rows])for n in names}
# The monocular trace does not determine depth. Author separate parallel staff
# planes, as in the demonstrated wall-plane passage, instead of trusting the
# reconstruction's fluctuating hand depth through the torso.
for side,depth in [('l',-.255),('r',.255)]:
    positions['hand_'+side][:,2]=depth
    # Keep the elbow on the body side of the prop plane. The source's 2D elbow
    # path is retained; its unobserved depth is not a reliable pole target.
    positions['lowerarm_'+side][:,2]*=.35
rotations={n:[quat(r['guide']['bones'][n]['q'])for r in rows]for n in names}
palms={s:[quat(r['guide']['arms'][i]['palmQ']) for r in rows]for i,s in enumerate(['L','R'])}
for qset in list(rotations.values())+list(palms.values()):
    for i in range(1,N):
        if qset[i-1].dot(qset[i])<0:qset[i].negate()
    qset[:]=[qset[i].slerp(qset[(i-1)%N],.18).slerp(qset[(i+1)%N],.18)for i in range(N)]
rest={b.name:b.matrix_local.copy()for b in rig.data.bones}
last_q={}
def key(pb,frame):
    pb.rotation_mode='QUATERNION'
    if pb.name in last_q and last_q[pb.name].dot(pb.rotation_quaternion)<0:pb.rotation_quaternion.negate()
    last_q[pb.name]=pb.rotation_quaternion.copy()
    for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame,group=pb.name)
def delta(name,t):return CQ@at(rotations[name],t)@quat(bind[name]['quaternion']).inverted()@CQ.inverted()
def control(name,q,position=None):
    pb=rig.pose.bones[name];m=q.to_matrix().to_4x4()@rest[name];m.translation=position if position is not None else pb.head.copy();pb.matrix=m
    if position is None:pb.location=(0,0,0)
    pb.scale=(1,1,1)
    bpy.context.view_layer.update()
    return pb
def make_material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.65
    return m
black=make_material('Black staff',(.009,.010,.013));white=make_material('White center',(.8,.8,.8));blue=make_material('Thumb end',(.02,.16,.65));gold=make_material('Pinky end',(.85,.26,.025))
staffs={};parts=[];palm_frames={}
for side in ['L','R']:
    for limb in ['upper_arm','thigh']:
        pb=rig.pose.bones[limb+'_parent.'+side]
        pb['IK_FK']=0.;pb['IK_Stretch']=0.;pb['pole_vector']=True
    W=rest['hand_ik.'+side].translation
    I=rest['f_index.01.'+side].translation;K=rest['f_pinky.01.'+side].translation
    F=unit((I+K)/2-W);P=unit(F.cross(I-K)*(1 if side=='L' else -1));X=F.cross(P)
    palm_frames[side]=rest['hand_ik.'+side].to_quaternion().inverted()@Matrix((X,F,P)).transposed().to_quaternion()
    parent=bpy.data.objects.new('Staff '+side.lower(),None);scene.collection.objects.link(parent);parent.rotation_mode='QUATERNION';staffs[side]=parent
    for name,radius,length,z,mat in [('Shaft',.0105,.82,0,black),('Grip',.0122,.13,0,black),('Center',.0125,.018,0,white),('Thumb',.02,.056,.37,blue),('Pinky',.02,.056,-.37,gold)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=length)
        obj=bpy.context.object;obj.name=name+' '+side.lower();obj.parent=parent;obj.location=(0,0,z);obj.data.materials.append(mat)
        bevel=obj.modifiers.new('Rounded edges','BEVEL');bevel.width=.001;bevel.segments=2
        for face in obj.data.polygons:face.use_smooth=True
        parts.append(obj)

# Staff phase follows the measured hand orbit. Native body and palm poses retain
# source bends; no elbow is moved to enforce a cosmetic wrist-angle threshold.
wrists=np.stack([positions['hand_l'],positions['hand_r']],1)
center=(wrists.max(0)+wrists.min(0))/2;radius=(wrists.max(0)-wrists.min(0))/2
angles=np.unwrap(np.arctan2((wrists[:,:,1]-center[None,:,1])/radius[None,:,1],(wrists[:,:,0]-center[None,:,0])/radius[None,:,0]),axis=0)
angles[:,1]+=2*math.pi*round((angles[0,0]+math.pi-angles[0,1])/(2*math.pi));angles=(angles[:,0]+angles[:,1]-math.pi)/2
linear=angles[0]-2*math.pi*np.arange(N)/N;angles=linear+smooth(angles-linear)
report=[];wrist_context={'L':[],'R':[]}
for k in range(N*STEP+1):
    if k%16==0:print('AUTHOR',k,'/',N*STEP,flush=True)
    t=k/STEP;frame=k+1;scene.frame_set(frame)
    # Torso and chest independently follow the observed turn. Source positions
    # locate the pelvis, while Rigify retains the character's limb lengths.
    q=delta('pelvis',t)
    torso=control('torso',q,vector(at(positions['pelvis'],t))+q@(rest['torso'].translation-rest['ORG-spine'].translation))
    key(torso,frame)
    for name,src in [('hips','pelvis'),('chest','spine_03'),('neck','neck_01'),('head','head')]:key(control(name,delta(src,t)),frame)
    for side,s in [('L','l'),('R','r')]:
        key(control('shoulder.'+side,delta('clavicle_'+s,t)),frame)
        foot=control('foot_ik.'+side,delta('foot_'+s,t),vector(at(positions['foot_'+s],t)))
        key(foot,frame)
        knee=rig.pose.bones['thigh_ik_target.'+side]
        km=knee.matrix.copy();km.translation=vector(at(positions['calf_'+s],t))+vector((0,0,.4));knee.matrix=km;key(knee,frame)
        theta=float(at(angles+2*math.pi*np.arange(N)/N,t)-2*math.pi*t/N+(0 if side=='L'else math.pi))
        axis=vector((math.cos(theta),-math.sin(theta),0))
        # Both props stay in parallel wall planes. Depth is authored separately
        # at the grip; tilting the shaft back toward the shoulder is not needed.
        hand=rig.pose.bones['hand_ik.'+side]
        captured=CQ@at(palms[side],t)
        P=captured@Vector((0,0,1));P=unit(P-axis*P.dot(axis))
        F=captured@Vector((0,1,0));F=unit(F-P*F.dot(P))
        vertical=abs(axis.z)**4
        F=unit(F.lerp(-axis,vertical));X=F.cross(P)
        palm=Matrix((X,F,P)).transposed().to_quaternion();hq=palm@palm_frames[side].inverted()
        hm=hq.to_matrix().to_4x4();hm.translation=vector(at(positions['hand_'+s],t));hand.matrix=hm;key(hand,frame)
        elbow=vector(at(positions['lowerarm_'+s],t));shoulder=rig.pose.bones['upper_arm_ik.'+side].head
        D=unit(hm.translation-shoulder);bend=unit(elbow-shoulder-D*(elbow-shoulder).dot(D))
        pole=rig.pose.bones['upper_arm_ik_target.'+side];pm=pole.matrix.copy();pm.translation=elbow+bend*.3;pole.matrix=pm;key(pole,frame)
        bpy.context.view_layer.update()
        F=palm@Vector((0,1,0));P=palm@Vector((0,0,1));X=F.cross(P)
        # A support study: the grip closes as the shaft crosses the palm and
        # opens into the demonstrated thumb-joint support when it runs along it.
        curl=min(1,abs(axis.dot(X)))
        for finger in ['index','middle','ring','pinky']:
            flex=[6+18*curl,8+20*curl,4+12*curl] if finger=='index' else [3+6*curl,3+6*curl,1+3*curl]
            for j,deg in enumerate(flex):
                pb=rig.pose.bones[f'f_{finger}.{j+1:02}.'+side];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion((1,0,0),-math.radians(deg));key(pb,frame)
        for j,deg in enumerate([0,-5,-5]):
            pb=rig.pose.bones[f'thumb.{j+1:02}.'+side];pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion((1,0,0),-math.radians(deg));key(pb,frame)
        bpy.context.view_layer.update()
        W=rig.pose.bones['ORG-hand.'+side].head
        thumb=rig.pose.bones['DEF-thumb.02.'+side].head
        open_center=thumb+P*.0315
        # The tutorial uses the thumb/index support, including the open vertical
        # positions. Do not shift the shaft into the middle of the palm as its
        # direction changes; that produces a physically impossible finger sweep.
        G=open_center
        staff=staffs[side];staff.location=G;staff.rotation_quaternion=Vector((0,0,1)).rotation_difference(axis);key(staff,frame)
        report.append({'frame':frame,'side':side,'wrist':list(W),'elbow':list(rig.pose.bones['ORG-forearm.'+side].head),'palm':list(P),'fingers':list(F),'staff':list(G),'axis':list(axis),'curl':curl})
        forearm=rig.pose.bones['ORG-forearm.'+side]
        neutral=forearm.matrix.to_quaternion()@rest['ORG-forearm.'+side].to_quaternion().inverted()@rest['hand_ik.'+side].to_quaternion()@palm_frames[side]
        wrist_context[side].append({'neutral':neutral.copy(),'forward':neutral.inverted()@F,'axis':neutral.inverted()@axis,'position':hm.translation.copy(),'world_axis':axis.copy()})

# Author the hand around anatomical flexion, forearm roll, and deviation axes.
# The capture's palms can imply a >100-degree sideways wrist bend. These four
# source checkpoints are the editable pose prior; the shaft lies in the palm
# plane and intermediate joint angles stay within the study's authored range.
pose_prior={'L':[(-64,-4),(-29,2),(29,73),(-34,-54)],
            'R':[(31,-56),(-58,38),(-75,14),(-27,7)]}
rad=math.pi/180;count=N*STEP
def prior_at(side,i):
    x=i/count*4;j=int(x)%4;u=x-int(x);u=u*u*(3-2*u)
    a=pose_prior[side][j];b=pose_prior[side][(j+1)%4]
    return [(a[k]*(1-u)+b[k]*u)*rad for k in range(2)]
solver_input={side:[{'axis':list(ctx['axis']),'forward':list(ctx['forward']),'prior':prior_at(side,i)+[0]}for i,ctx in enumerate(wrist_context[side][:count])]for side in ['L','R']}
(out/'wrist-context.json').write_text(json.dumps(solver_input))
subprocess.run(['uv','run',*(['--offline']if args.offline else []),'--with','scipy==1.18.1','python',str(Path(__file__).with_name('fit-antispin-wrists.py')),str(out/'wrist-context.json'),str(out/'wrist-poses.json')],check=True)
joint_keys=json.loads((out/'wrist-poses.json').read_text())
for k in range(count+1):
    frame=k+1;scene.frame_set(frame)
    for side in ['L','R']:
        ctx=wrist_context[side][k];a,p,d=joint_keys[side][k]
        hand=rig.pose.bones['hand_ik.'+side];neutral=ctx['neutral'];position=ctx['position'].copy()
        # Constrain the props' actual planes, not just the wrist centers. Their
        # support points are offset from the wrist and the torso turns between
        # them. Re-evaluate the forearm basis as the IK target changes depth.
        for iteration in range(7):
            palm=neutral@Quaternion((0,1,0),p)@Quaternion((1,0,0),a)@Quaternion((0,0,1),d)
            hm=(palm@palm_frames[side].inverted()).to_matrix().to_4x4();hm.translation=position;hand.matrix=hm
            bpy.context.view_layer.update()
            P=palm@Vector((0,0,1));G=rig.pose.bones['DEF-thumb.02.'+side].head+P*.0315
            if iteration<6:
                position.y+=(.34 if side=='L' else -.34)-G.y
                forearm=rig.pose.bones['ORG-forearm.'+side]
                neutral=forearm.matrix.to_quaternion()@rest['ORG-forearm.'+side].to_quaternion().inverted()@rest['hand_ik.'+side].to_quaternion()@palm_frames[side]
        key(hand,frame)
        if contacts:G+=Vector(contacts[k][side.lower()])
        staff=staffs[side];staff.location=G;key(staff,frame)
        item=report[k*2+(side=='R')];item['staff']=list(G);item['palm']=list(P);item['fingers']=list(palm@Vector((0,1,0)));item['joint_degrees']=[v/rad for v in (a,p,d)]
        item['wrist']=list(rig.pose.bones['ORG-hand.'+side].head);item['elbow']=list(rig.pose.bones['ORG-forearm.'+side].head)

# Rigify's segmented bendy-arm roll can wrap by a full turn at an almost
# straight elbow. Each baked frame looks valid, but interpolating the cancelling
# local rotations then swings the downstream hand through the staff. Bake
# continuous twist frames explicitly, retaining the IK joint positions.
twist_targets={}
for side in ['L','R']:
    for limb in ['upper_arm','forearm']:
        for j in range(3):
            name='DEF-'+limb+'.'+side+(''if j==0 else f'.{j:03}')
            target=bpy.data.objects.new('Twist '+name,None);scene.collection.objects.link(target);target.rotation_mode='QUATERNION';target.hide_render=True
            constraint=rig.pose.bones[name].constraints.new('COPY_ROTATION');constraint.name='Continuous export twist';constraint.target=target;constraint.owner_space='WORLD';constraint.target_space='WORLD'
            twist_targets[side,limb,j]=target
for k in range(count+1):
    frame=k+1;scene.frame_set(frame);bpy.context.view_layer.update()
    for side in ['L','R']:
        fore=rig.pose.bones['ORG-forearm.'+side].matrix.to_quaternion()
        hand=rig.pose.bones['ORG-hand.'+side].matrix.to_quaternion()
        aligned=hand@rest['ORG-hand.'+side].to_quaternion().inverted()@rest['ORG-forearm.'+side].to_quaternion()
        relative=fore.inverted()@aligned
        angle=2*math.atan2(relative.y,relative.w);angle=(angle+math.pi)%(2*math.pi)-math.pi
        for limb in ['upper_arm','forearm']:
            org='ORG-'+limb+'.'+side;base=rig.pose.bones[org].matrix.to_quaternion()
            for j in range(3):
                name='DEF-'+limb+'.'+side+(''if j==0 else f'.{j:03}')
                target=twist_targets[side,limb,j]
                target.rotation_quaternion=rig.matrix_world.to_quaternion()@base@Quaternion((0,1,0),angle*j/3 if limb=='forearm'else 0)@rest[org].to_quaternion().inverted()@rest[name].to_quaternion()
                key(target,frame)

for action in bpy.data.actions:
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for keyframe in fc.keyframe_points:keyframe.interpolation='LINEAR'
scene.frame_start=1;scene.frame_end=N*STEP+1;scene.render.fps=FPS
scene['animation_status']='Unapproved antispin study; review contact and complete source motion'
scene['source_video']='https://www.youtube.com/watch?v=pRoRKPIewhE&t=505s'
for modifier,enabled in viewport_modifiers:modifier.show_viewport=enabled
scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'antispin-split-same.blend'),compress=True)
if args.renders:
    scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.cycles.samples=16
    for i in range(4):
        scene.frame_set(1+round(i*N*STEP/4));scene.render.filepath=str(out/f'pose-{i}.png');bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig,bpy.data.objects['Body'],bpy.data.objects['Shirt'],bpy.data.objects['Trousers'],*staffs.values(),*parts]+[o for o in bpy.data.objects if '.eye.' in o.name]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/'antispin-split-same.glb'),export_format='GLB',use_selection=True,
    export_apply=True,export_def_bones=True,export_animations=True,export_animation_mode='SCENE',
    export_anim_scene_split_object=False,export_anim_slide_to_zero=True,export_force_sampling=True,
    export_frame_range=True,export_frame_step=1,export_bake_animation=True,export_extras=True)
(out/'authoring-report.json').write_text(json.dumps({'status':'unapproved','wrist_checkpoints':pose_prior,'frames':report},indent=2))
print('ANTISPIN_READY',str(out/'antispin-split-same.glb'),flush=True)
