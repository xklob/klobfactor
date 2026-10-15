"""Surface and deformation improvements for the Blender review performer.

This refines the CC0 source mesh. It does not generate or validate technique.
"""
import math
import bmesh
import bpy
from mathutils import Vector, Quaternion
from mathutils.bvhtree import BVHTree


def refine_surface(mesh):
    """Weld imported normal seams, recover quads, and subdivide the anatomy."""
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    before = len(mesh.data.vertices)
    if mesh.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000003)
    bmesh.ops.join_triangles(
        bm, faces=list(bm.faces), angle_face_threshold=.70,
        angle_shape_threshold=.70, cmp_uvs=False, cmp_materials=True,
    )
    bm.normal_update()
    bm.to_mesh(mesh.data)
    bm.free()
    # Subdivide in the bind pose, before deformation. glTF stores the resulting
    # surface and interpolated weights, so the browser needs no modifier stack.
    subdivision = mesh.modifiers.new('Anatomical surface', 'SUBSURF')
    subdivision.subdivision_type = 'CATMULL_CLARK'
    subdivision.levels = subdivision.render_levels = 1
    bpy.ops.object.modifier_move_up(modifier=subdivision.name)
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    for face in mesh.data.polygons:
        face.use_smooth = True
    mesh.data.update()
    print('SURFACE', before, '->', len(mesh.data.vertices), 'vertices', flush=True)
    return {'source_vertices': before, 'surface_vertices': len(mesh.data.vertices)}


def add_forearm_twists(mesh, rig):
    """Distribute palm roll along the forearm instead of at one wrist ring."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for side in ['l', 'r']:
        lower = rig.data.edit_bones['lowerarm_' + side]
        for i in [1]:
            bone = rig.data.edit_bones.new(f'forearm_twist_{i}_{side}')
            bone.head = lower.head
            bone.tail = lower.tail
            bone.roll = lower.roll
            bone.parent = lower
            bone.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    for side in ['l', 'r']:
        source = mesh.vertex_groups['lowerarm_' + side]
        groups = [source, mesh.vertex_groups.new(name=f'forearm_twist_1_{side}')]
        start = rig.data.bones['lowerarm_' + side].head_local
        end = rig.data.bones['hand_' + side].head_local
        axis = end - start
        for vertex in mesh.data.vertices:
            weight = next((g.weight for g in vertex.groups if g.group == source.index), 0)
            if weight < 1e-8:
                continue
            t = min(1, max(0, (vertex.co - start).dot(axis) / axis.length_squared))
            # Reach the hand's roll just before the wrist flexion crease.
            fraction = min(1, t / .94)
            source.remove([vertex.index])
            for group, amount in [(groups[0], 1 - fraction), (groups[1], fraction)]:
                if amount > 1e-8:
                    group.add([vertex.index], amount * weight, 'REPLACE')
    # Limit to four influences explicitly; do not let the exporter silently
    # truncate the new weights at elbow and wrist transitions.
    for vertex in mesh.data.vertices:
        weights = sorted([(g.group, g.weight) for g in vertex.groups if g.weight > 1e-8], key=lambda x: -x[1])
        total = sum(w for _, w in weights[:4])
        for group, _ in weights[4:]:
            mesh.vertex_groups[group].remove([vertex.index])
        for group, weight in weights[:4]:
            mesh.vertex_groups[group].add([vertex.index], weight / total, 'REPLACE')


def bake_forearm_twists(rig, scene):
    rest = {}
    for side in ['l', 'r']:
        w = rig.data.bones['hand_' + side].head_local
        index = rig.data.bones['index_01_' + side].head_local - w
        pinky = rig.data.bones['pinky_01_' + side].head_local - w
        forward = (index + pinky).normalized()
        across = (pinky - index) * (1 if side == 'l' else -1)
        normal = across.cross(forward).normalized()
        rest[side] = (normal, rig.data.bones['lowerarm_' + side].matrix_local.to_quaternion())
    angles = {side: [] for side in rest}
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for side, (normal, bind) in rest.items():
            lower, hand = [rig.pose.bones[n + '_' + side] for n in ['lowerarm', 'hand']]
            axis = (hand.head - lower.head).normalized()
            reference = (lower.matrix.to_quaternion() @ bind.inverted()) @ normal
            index = rig.pose.bones['index_01_' + side].head - hand.head
            pinky = rig.pose.bones['pinky_01_' + side].head - hand.head
            desired = ((pinky - index) * (1 if side == 'l' else -1)).cross(index + pinky).normalized()
            reference = (reference - axis * reference.dot(axis)).normalized()
            desired = (desired - axis * desired.dot(axis)).normalized()
            angle = math.atan2(axis.dot(reference.cross(desired)), reference.dot(desired))
            # Keep equivalent rotations continuous across the +/-180 boundary.
            if angles[side]:
                angle += 2 * math.pi * round((angles[side][-1] - angle) / (2 * math.pi))
            angles[side].append(angle)
            for i in [1]:
                bone = rig.pose.bones[f'forearm_twist_{i}_{side}']
                bone.rotation_mode = 'QUATERNION'
                bone.rotation_quaternion = Quaternion((0, 1, 0), angle)
                bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
    for modifier in bpy.data.objects['Body'].modifiers:
        if modifier.type == 'ARMATURE':
            modifier.use_deform_preserve_volume = True
    return {side: {'loop_rotation_error_degrees': math.degrees(abs(math.remainder(values[-1] - values[0], 2 * math.pi)))} for side, values in angles.items()}


def add_fingernails(mesh, rig, material):
    """Fit curved nail plates to the actual distal finger surfaces in rest pose."""
    nails = []
    for side in ['l', 'r']:
        wrist = rig.data.bones['hand_' + side].head_local
        index = rig.data.bones['index_01_' + side].head_local - wrist
        pinky = rig.data.bones['pinky_01_' + side].head_local - wrist
        dorsal = -((pinky - index) * (1 if side == 'l' else -1)).cross(index + pinky).normalized()
        for finger in ['thumb', 'index', 'middle', 'ring', 'pinky']:
            name = f'{finger}_03_{side}'
            origin = rig.data.bones[name].head_local
            along = (origin - rig.data.bones[f'{finger}_02_{side}'].head_local).normalized()
            normal = (dorsal - along * dorsal.dot(along)).normalized()
            across = along.cross(normal).normalized()
            group = mesh.vertex_groups[name].index
            selected = {v.index for v in mesh.data.vertices if any(g.group == group and g.weight > .25 for g in v.groups)}
            points = [mesh.data.vertices[i].co - origin for i in selected]
            faces = [tuple(f.vertices) for f in mesh.data.polygons if any(i in selected for i in f.vertices)]
            surface = BVHTree.FromPolygons([v.co for v in mesh.data.vertices], faces)
            tip = max(p.dot(along) for p in points)
            y0, y1 = max(.003, tip * .22), tip * .90
            length = (y1 - y0) / 2
            center = (y0 + y1) / 2
            profile = [(p.dot(along), p.dot(across)) for p in points]
            surface_faces = faces
            vertices, faces, skin_weights = [], [], []
            segments, rings = 40, 9
            # Concentric rounded rectangles conform to the skin, with a small
            # raised plate and a soft edge rather than a floating ellipsoid.
            for ring in range(rings + 1):
                radius = max(.001, ring / rings)
                for j in range(segments):
                    angle = 2 * math.pi * j / segments
                    y = center + math.copysign(abs(math.sin(angle)) ** .70, math.sin(angle)) * length * radius
                    section = [x for py, x in profile if abs(py - y) < .002]
                    if not section:
                        section = [x for _, x in sorted(profile, key=lambda p: abs(p[0] - y))[:12]]
                    x0, x1 = min(section), max(section)
                    half_width = (x1 - x0) * .33
                    x = (x0 + x1) / 2 + math.copysign(abs(math.cos(angle)) ** .70, math.cos(angle)) * half_width * radius
                    start = origin + across * x + along * y + normal * .05
                    hit, _, face_index, _ = surface.ray_cast(start, -normal, .10)
                    point = hit if hit is not None else start - normal * .042
                    weights = {group: 1.0}
                    if hit is not None:
                        ids = surface_faces[face_index]
                        best = None
                        for j2 in range(1, len(ids) - 1):
                            triangle = [ids[0], ids[j2], ids[j2 + 1]]
                            a, b, c = [mesh.data.vertices[vi].co for vi in triangle]
                            v0, v1, v2 = b - a, c - a, hit - a
                            d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
                            denominator = d00 * d11 - d01 * d01
                            if abs(denominator) < 1e-18:
                                continue
                            u = (d11 * v2.dot(v0) - d01 * v2.dot(v1)) / denominator
                            v = (d00 * v2.dot(v1) - d01 * v2.dot(v0)) / denominator
                            bary = [1 - u - v, u, v]
                            score = min(bary)
                            if best is None or score > best[0]:
                                best = (score, triangle, bary)
                        if best:
                            weights = {}
                            for vi, amount in zip(best[1], best[2]):
                                for g in mesh.data.vertices[vi].groups:
                                    weights[g.group] = weights.get(g.group, 0) + max(0, amount) * g.weight
                            weights = dict(sorted(weights.items(), key=lambda item: -item[1])[:4])
                            total = sum(weights.values())
                            weights = {group: weight / total for group, weight in weights.items()}
                    point += normal * (.00050 + .00015 * (1 - radius ** 4))
                    vertices.append(point)
                    skin_weights.append(weights)
                    if ring:
                        a = (ring - 1) * segments + j
                        b = (ring - 1) * segments + (j + 1) % segments
                        c = ring * segments + (j + 1) % segments
                        d = ring * segments + j
                        faces.append((a, d, c, b))
            data = bpy.data.meshes.new('Nail surface ' + name)
            data.from_pydata(vertices, [], faces)
            data.update()
            nail = bpy.data.objects.new('Nail ' + name, data)
            mesh.users_collection[0].objects.link(nail)
            nail.data.materials.append(material)
            for group in mesh.vertex_groups:
                nail.vertex_groups.new(name=group.name)
            for vi, weights in enumerate(skin_weights):
                for group, weight in weights.items():
                    nail.vertex_groups[group].add([vi], weight, 'REPLACE')
            armature = nail.modifiers.new('Finger deformation', 'ARMATURE')
            armature.object = rig
            for face in data.polygons:
                face.use_smooth = True
            nails.append(nail)
    return nails
