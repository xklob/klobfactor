"""Build the review character from Blender Studio's anatomical base mesh.

The mesh includes sculpted hand detail. Rigify supplies the arm, hand, and
forearm deformation rig; the antispin animation is authored separately.
Run: blender -b --factory-startup --python scripts/blender-character.py --
     --asset /path/to/human_base_meshes_bundle.blend --output /path/to/output
"""
import argparse
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--asset', required=True)
p.add_argument('--output', required=True)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
names = ['GEO-body_male_realistic', 'GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R']
with bpy.data.libraries.load(str(Path(args.asset).resolve()), link=False) as (src, dst):
    dst.objects = names
body, *eyes = dst.objects
asset_offset = body.location.x
for obj in dst.objects:
    bpy.context.collection.objects.link(obj)
    obj.location.x -= asset_offset
    obj.hide_set(False)
    obj.hide_render = False
body.name = 'Body'
bpy.context.view_layer.objects.active = body
body.select_set(True)

sets = defaultdict(set)
attr = body.data.attributes['.sculpt_face_set']
face_sets = [item.value for item in attr.data]
for face in body.data.polygons:
    sets[face_sets[face.index]].update(face.vertices)

def mean(indices):
    ids = list(indices)
    assert ids, 'Missing anatomical boundary'
    return sum((body.data.vertices[i].co for i in ids), Vector()) / len(ids)

def joint(a, b):
    return mean(sets[a] & sets[b])

# The source asset's face sets follow anatomical parts and phalanges. Joint
# centers come from their shared edge rings, rather than guessed proportions.
fingers = {'pinky': [64, 65, 66], 'ring': [68, 69, 70],
           'middle': [72, 73, 74], 'index': [76, 77, 78], 'thumb': [80, 81, 82]}
landmarks = {'shoulder': joint(1, 21), 'elbow': joint(21, 12), 'wrist': joint(12, 9)}
for name, ids in fingers.items():
    pts = [joint(9, ids[0]), joint(ids[0], ids[1]), joint(ids[1], ids[2])]
    axis = (pts[-1] - pts[-2]).normalized()
    vertices = sets[ids[-1]]
    furthest = max(body.data.vertices[i].co.dot(axis) for i in vertices)
    tip = mean(i for i in vertices if body.data.vertices[i].co.dot(axis) > furthest - .003)
    pts.append(tip)
    if name == 'thumb':
        pts[0] = landmarks['wrist'].lerp(pts[0], .45)
    landmarks[name] = pts
landmarks['hip'] = joint(18, 24)
landmarks['hip'].z += .08
landmarks['knee'] = joint(24, 15)
landmarks['ankle'] = joint(15, 14)

def material(name, color, roughness=.65):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .28
    return m

skin = material('Skin', (.48, .29, .20), .67)
nails = material('Natural nails', (.53, .33, .26), .43)
body.data.materials.clear()
body.data.materials.append(skin)
body.data.materials.append(nails)
nail_sets = {67, 71, 75, 79, 83, 87, 91, 95, 99, 103}
for face in body.data.polygons:
    face.material_index = int(face_sets[face.index] in nail_sets)
    face.use_smooth = True

# Fit a complete Rigify metarig. Facial animation is outside this study, so the
# face uses the head bone. All articulated finger and palm bones are retained.
bpy.ops.preferences.addon_enable(module='rigify')
bpy.ops.object.armature_human_metarig_add()
meta = bpy.context.object
meta.name = 'Character metarig'
bpy.ops.object.mode_set(mode='EDIT')
eb = meta.data.edit_bones
remove = [b.name for b in eb if b.name == 'face' or any(a.name == 'face' for a in b.parent_recursive)]
remove += [b.name for b in eb if b.name.startswith(('breast', 'pelvis.'))]
for name in set(remove):
    if name in eb:
        eb.remove(eb[name])
for bone in eb:
    bone.head *= .85
    bone.tail *= .85

spine = [(0, .015, .89), (0, .012, 1.02), (0, .01, 1.14),
         (0, .008, 1.27), (0, .005, 1.405), (0, -.015, 1.455),
         (0, -.028, 1.50), (0, -.028, 1.68)]
for i in range(7):
    b = eb['spine' + (f'.{i:03}' if i else '')]
    b.head, b.tail = spine[i], spine[i + 1]

for side, sign in [('L', 1), ('R', -1)]:
    def point(v):
        return Vector((sign * v[0], v[1], v[2]))
    def fit(name, a, b, roll=None):
        bone = eb[name + '.' + side]
        bone.head, bone.tail = point(a), point(b)
        if roll is not None:
            bone.align_roll(point(roll))
    shoulder, elbow, wrist = [landmarks[n] for n in ['shoulder', 'elbow', 'wrist']]
    # Anatomical surface boundary is slightly lateral to the shoulder center.
    shoulder = shoulder + Vector((.008, 0, .037))
    fit('shoulder', (.02, -.01, 1.37), shoulder)
    fit('upper_arm', shoulder, elbow)
    fit('forearm', elbow, wrist)
    knuckle = (landmarks['index'][0] + landmarks['pinky'][0]) / 2
    forward = (knuckle - wrist).normalized()
    across = (landmarks['index'][0] - landmarks['pinky'][0]).normalized()
    dorsal = forward.cross(across).normalized()
    if dorsal.x < 0:
        dorsal = -dorsal
    fit('hand', wrist, knuckle, dorsal)
    for j, name in enumerate(['index', 'middle', 'ring', 'pinky']):
        pts = landmarks[name]
        fit(f'palm.{j+1:02}', wrist.lerp(pts[0], .26), pts[0], dorsal)
        for k in range(3):
            fit(f'f_{name}.{k+1:02}', pts[k], pts[k+1], dorsal)
    for k in range(3):
        fit(f'thumb.{k+1:02}', landmarks['thumb'][k], landmarks['thumb'][k+1], dorsal)
    hip, knee, ankle = [landmarks[n] for n in ['hip', 'knee', 'ankle']]
    fit('thigh', hip, knee)
    fit('shin', knee, ankle)
    fit('foot', ankle, (ankle.x + .02, -.085, .03))
    fit('toe', (ankle.x + .02, -.085, .03), (ankle.x + .035, -.14, .025))
    heel = eb.get('heel.02.' + side)
    if heel:
        heel.head = point((ankle.x - .025, .075, .015))
        heel.tail = point((ankle.x + .025, .075, .015))
bpy.ops.object.mode_set(mode='OBJECT')
for pb in meta.pose.bones:
    if pb.rigify_type in ['limbs.arm', 'limbs.leg']:
        pb.rigify_parameters.segments = 3
        pb.rigify_parameters.bbones = 1
    if pb.rigify_type == 'limbs.super_finger':
        pb.rigify_parameters.primary_rotation_axis = 'X'
        pb.rigify_parameters.bbones = 1
bpy.context.view_layer.objects.active = meta
bpy.ops.pose.rigify_generate()
rig = bpy.context.object
rig.name = 'Performer'
meta.hide_render = True
meta.hide_set(True)

# Bind the original quad cage, then evaluate the asset's sculpted multires
# surface. This retains its creases and modeled nail beds at browser resolution.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# Match the four-weight skinning used by the browser, rather than allowing the
# exporter to silently discard influences after Blender's deformation review.
deform={g.index for g in body.vertex_groups if g.name in rig.data.bones and rig.data.bones[g.name].use_deform}
for v in body.data.vertices:
    weights=sorted([(g.group,g.weight) for g in v.groups if g.group in deform],key=lambda x:-x[1])
    total=sum(w for _,w in weights[:4])
    for group,_ in weights[4:]:body.vertex_groups[group].remove([v.index])
    if total:
        for group,weight in weights[:4]:body.vertex_groups[group].add([v.index],weight/total,'REPLACE')
for modifier in body.modifiers:
    if modifier.type == 'MULTIRES':
        modifier.levels = modifier.render_levels = 2
    if modifier.type == 'ARMATURE':
        modifier.use_deform_preserve_volume = False
for obj in eyes:
    obj.parent = rig
    modifier = obj.modifiers.new('Head', 'ARMATURE')
    modifier.object = rig
    g = obj.vertex_groups.new(name='DEF-spine.006')
    g.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    # The asset has anatomical eye geometry; keep subdued, readable materials.
    obj.data.materials.clear()
    for mat in [material('Eye white', (.65, .64, .61), .36),
                material('Iris', (.09, .075, .055), .4),
                material('Pupil', (.006, .005, .004), .3)]:
        obj.data.materials.append(mat)
    # The eyeball's local +Z is the cornea axis in this asset.
    for face in obj.data.polygons:
        r = math.hypot(face.center.x, face.center.y)
        face.material_index = (2 if r < .002 else 1 if r < .005 else 0) if face.center.z > 0 else 0

def garment(name, ids, mat, offset, smooth):
    obj = body.copy()
    obj.data = body.data.copy()
    bpy.context.collection.objects.link(obj)
    obj.name = name
    for mod in list(obj.modifiers):
        if mod.type != 'ARMATURE':
            obj.modifiers.remove(mod)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    layer = bm.faces.layers.int.get('.sculpt_face_set')
    keep = []
    for face in bm.faces:
        center = face.calc_center_median()
        use = face[layer] in ids
        if name == 'Shirt' and face[layer] in {20, 21}:
            use = center.z > 1.19
        if use:
            keep.append(face)
    keep = set(keep)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=list(bm.verts), factor=.35,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * offset
        if v.is_boundary:
            if name == 'Shirt' and v.co.z < 1.10:
                v.co.z = .94
            if name == 'Trousers' and v.co.z > .91:
                v.co.z = .93
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for f in obj.data.polygons:
        f.material_index = 0
    sub = obj.modifiers.new('Cloth surface', 'SUBSURF')
    sub.levels = sub.render_levels = 2
    solid = obj.modifiers.new('Fabric thickness', 'SOLIDIFY')
    solid.thickness = .003
    solid.offset = 0
    return obj

shirt = garment('Shirt', {1, 19, 20, 21}, material('Cotton shirt', (.105, .15, .205), .95), .034, 12)
pants = garment('Trousers', {18, 23, 24, 15, 16}, material('Trousers', (.07, .075, .085), .94), .016, 8)
# Omit skin beneath clothing so it cannot poke through the garments. This mask
# is evaluated after the sculpted surface and does not alter the source asset.
visible = body.vertex_groups.new(name='Exposed skin')
skin_ids = set()
for f in body.data.polygons:
    fs = face_sets[f.index]
    if fs in {9, 10, 11, 12, 20, 21} or 64 <= fs <= 103 or f.center.z > 1.35 or f.center.z < .15:
        skin_ids.update(f.vertices)
visible.add(list(skin_ids), 1, 'REPLACE')
mask = body.modifiers.new('Skin under clothing', 'MASK')
mask.vertex_group = visible.name
mask.threshold = .999

# Minimal presentation, with genuinely modeled clothes rather than painted skin.
scene = bpy.context.scene
scene['model_source'] = 'Blender Studio Human Base Meshes 1.4.1; Dan Ulrich; CC0'
scene['animation_status'] = 'Character study; antispin not yet authored'
scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.08, .09, .11, 1)
for name, pos, power, size in [('Key', (3, -4, 5), 700, 4), ('Fill', (-3, -2, 3), 350, 3), ('Rim', (1, 3, 4), 800, 3)]:
    bpy.ops.object.light_add(type='AREA', location=pos)
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.shape = 'DISK'
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add(location=(2.3, -4.5, 2.3))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .95)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.lens = 62
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(out / 'character.png')
scene.view_settings.view_transform = 'AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'character.blend'), compress=True)
bpy.ops.render.render(write_still=True)
scene.render.resolution_x = scene.render.resolution_y = 900
target = landmarks['wrist'].lerp(landmarks['middle'][1], .58)
camera.location = target + Vector((.48, -.32, .26))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.lens = 85
scene.render.filepath = str(out / 'hand.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig, body, *eyes, shirt, pants]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(out / 'character.glb'), export_format='GLB',
    use_selection=True, export_animations=False, export_apply=True, export_def_bones=True)
(out / 'landmarks.json').write_text(json.dumps({k: [list(x) for x in v] if isinstance(v, list) else list(v) for k, v in landmarks.items()}, indent=2))
print('CHARACTER_READY', str(out / 'character.blend'), flush=True)
