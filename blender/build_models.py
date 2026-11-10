"""Builds the detailed Tomorrowland Reimagined models in Blender and exports GLB files.

Run headless (Blender 4.2+ or the `bpy` Python module):
    blender -b -P blender/build_models.py
    python blender/build_models.py

Output goes to public/models/. Everything is authored in the web scene's units
(about 2 m per unit). Helpers take three.js-style coordinates (x east, y up,
z south) and convert them to Blender's Z-up space; the glTF exporter converts
them back. Materials are named after the site's shared materials (white,
silver, glass, warmGlow ...). The site swaps in its own materials by name, so
the files only carry geometry and stay small.
"""
import math
import os
import random

import bpy  # noqa: E402 (bpy must load before bmesh)
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'models')
os.makedirs(OUT, exist_ok=True)

# Display colours only (the site replaces these by name).
PALETTE = {
    'white': (0.82, 0.85, 0.93),
    'panel': (0.74, 0.78, 0.88),
    'silver': (0.55, 0.6, 0.72),
    'roof': (0.42, 0.46, 0.58),
    'dark': (0.05, 0.08, 0.12),
    'glass': (0.06, 0.14, 0.26),
    'warmGlow': (1.0, 0.65, 0.3),
    'blueGlow': (0.31, 0.66, 1.0),
    'blueSoft': (0.31, 0.66, 1.0),
    'coral': (1.0, 0.42, 0.29),
    'foliage': (0.16, 0.54, 0.49),
    'foliageDark': (0.1, 0.4, 0.38),
    'palm': (0.24, 0.6, 0.42),
    'trunk': (0.42, 0.36, 0.3),
    'planter': (0.86, 0.88, 0.94),
}


def mat(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        c = PALETTE[name]
        m.diffuse_color = (*c, 1)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*c, 1)
    return m


def B(x, y, z):
    """three.js position -> Blender position."""
    return Vector((x, -z, y))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_coll(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


COLL = None


def link(o):
    for c in o.users_collection:
        c.objects.unlink(o)
    COLL.objects.link(o)
    return o


def obj_from_bm(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    o.data.materials.append(mat(material))
    return o


def bevel(o, width, segments=1):
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    return o


def box(w, h, d, x, y, z, material, rot=0.0, bev=0.0, name='box'):
    """Box w (x) by h (up) by d (z), centred at three.js (x, y, z), turned rot around up."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    o = obj_from_bm(name, bm, material)
    o.location = B(x, y, z)
    o.rotation_euler = (0, 0, rot)
    if bev:
        bevel(o, bev)
    return o


def cyl(rb, rt, h, seg, x, y, z, material, name='cyl', cap=True):
    """Cylinder/cone with bottom radius rb and top radius rt, centred at (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=rb, radius2=rt, depth=h)
    o = obj_from_bm(name, bm, material)
    o.location = B(x, y, z)
    return o


def ring(r, tube, x, y, z, material, seg=48, tseg=6, name='ring'):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=tube, major_segments=seg, minor_segments=tseg, location=B(x, y, z))
    o = link(bpy.context.active_object)
    o.name = name
    o.data.materials.append(mat(material))
    return o


def paneled_wall(w, h, x, y, z, rot, material, px=3.2, py=2.6, gap=0.07, depth=0.05, name='wall'):
    """Flat wall of inset cladding panels. Faces +z (south) before rot is applied."""
    nx = max(1, round(w / px))
    ny = max(1, round(h / py))
    bm = bmesh.new()
    verts = [[bm.verts.new((-w / 2 + w * i / nx, 0, -h / 2 + h * j / ny)) for j in range(ny + 1)] for i in range(nx + 1)]
    faces = []
    for i in range(nx):
        for j in range(ny):
            faces.append(bm.faces.new((verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1])))
    bm.normal_update()
    # Blender -y is three.js +z: flip so the wall faces outwards.
    for f in faces:
        if f.normal.y > 0:
            f.normal_flip()
    res = bmesh.ops.inset_individual(bm, faces=faces, thickness=gap, depth=depth)
    o = obj_from_bm(name, bm, material)
    o.location = B(x, y, z)
    o.rotation_euler = (0, 0, rot)
    return o


def arch_rib(radius, height_scale, thick, width, x, y, z, rot, material, seg=14, name='rib'):
    """Half-ring rib in the plane facing x (spans z), squashed by height_scale."""
    bm = bmesh.new()
    outer, inner = [], []
    for i in range(seg + 1):
        a = math.pi * i / seg
        outer.append((math.cos(a) * radius, math.sin(a) * radius * height_scale))
        inner.append((math.cos(a) * (radius - thick), math.sin(a) * (radius - thick) * height_scale))
    vs = []
    for sx in (-width / 2, width / 2):
        row_o = [bm.verts.new((sx, -p[0], p[1])) for p in outer]
        row_i = [bm.verts.new((sx, -p[0], p[1])) for p in inner]
        vs.append((row_o, row_i))
    (o0, i0), (o1, i1) = vs
    for k in range(seg):
        bm.faces.new((o0[k], o0[k + 1], o1[k + 1], o1[k]))
        bm.faces.new((i0[k + 1], i0[k], i1[k], i1[k + 1]))
        bm.faces.new((o0[k + 1], o0[k], i0[k], i0[k + 1]))
        bm.faces.new((o1[k], o1[k + 1], i1[k + 1], i1[k]))
    for side in ((o0, i0), (o1, i1)):
        pass
    bm.faces.new((o0[0], i0[0], i1[0], o1[0]))
    bm.faces.new((i0[-1], o0[-1], o1[-1], i1[-1]))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material)
    o.location = B(x, y, z)
    o.rotation_euler = (0, 0, rot)
    return o


def half_vault(radius, height_scale, length, x, y, z, material, seg=20, name='vault'):
    """Barrel vault running along x, spanning z."""
    bm = bmesh.new()
    rows = []
    for sx in (-length / 2, length / 2):
        rows.append([bm.verts.new((sx, -math.cos(math.pi * i / seg) * radius, math.sin(math.pi * i / seg) * radius * height_scale)) for i in range(seg + 1)])
    for k in range(seg):
        bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    o = obj_from_bm(name, bm, material)
    o.location = B(x, y, z)
    return o


def half_disc(radius, height_scale, x, y, z, material, seg=20, name='gable'):
    """Flat half-ellipse (a vault end wall) facing x."""
    bm = bmesh.new()
    c = bm.verts.new((0, 0, 0))
    pts = [bm.verts.new((0, -math.cos(math.pi * i / seg) * radius, math.sin(math.pi * i / seg) * radius * height_scale)) for i in range(seg + 1)]
    for k in range(seg):
        bm.faces.new((c, pts[k], pts[k + 1]))
    o = obj_from_bm(name, bm, material)
    o.location = B(x, y, z)
    return o


def hvac(x, y, z, rot=0.0, w=4.0, d=3.0):
    """Rooftop air handler: a ribbed box with two fan shrouds."""
    box(w, 1.5, d, x, y + 0.75, z, 'silver', rot=rot, bev=0.08)
    for i in range(4):
        box(w + 0.06, 0.08, d + 0.06, x, y + 0.3 + i * 0.3, z, 'roof', rot=rot)
    ca, sa = math.cos(rot), math.sin(rot)
    for s in (-1, 1):
        ox = s * w / 4
        cyl(0.7, 0.7, 0.35, 16, x + ox * ca, y + 1.65, z - ox * sa, 'dark')
        cyl(0.78, 0.78, 0.12, 16, x + ox * ca, y + 1.85, z - ox * sa, 'roof', cap=False)


def storefront(w, h, x, y, z, rot, mullion=2.0):
    """Dark glass shopfront with slim mullions and a transom, facing +z."""
    box(w, h, 0.12, x, y + h / 2, z, 'glass', rot=rot)
    ca, sa = math.cos(rot), math.sin(rot)
    n = max(1, round(w / mullion))
    for i in range(n + 1):
        ox = -w / 2 + w * i / n
        box(0.14, h, 0.24, x + ox * ca, y + h / 2, z - ox * sa, 'silver', rot=rot)
    box(w, 0.16, 0.26, x, y + h * 0.72, z, 'silver', rot=rot)
    box(w + 0.2, 0.22, 0.3, x, y + h, z, 'silver', rot=rot)


def finalize(name):
    """Apply modifiers, join each material's objects into one mesh and export."""
    bpy.ops.object.select_all(action='DESELECT')
    objs = list(COLL.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')
    by_mat = {}
    for o in COLL.objects:
        key = o.data.materials[0].name if o.data.materials else 'white'
        by_mat.setdefault(key, []).append(o)
    for key, group in by_mat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:
            o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1:
            bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = f'{name}_{key}'
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bm = bmesh.new()
        bm.from_mesh(j.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bm.to_mesh(j.data)
        bm.free()
    tris = 0
    for o in COLL.objects:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    bpy.ops.object.select_all(action='DESELECT')
    for o in COLL.objects:
        o.select_set(True)
    path = os.path.join(OUT, f'{name}.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials='EXPORT',
        export_animations=False,
    )
    print(f'{name}: {tris} triangles, {os.path.getsize(path) / 1024:.0f} KB')


def start(name):
    global COLL
    reset()
    COLL = new_coll(name)


# ---------------------------------------------------------------------------
# South show building: Monsters, Inc. Laugh Floor (west) + Buzz Lightyear (east)
# Local origin is the centre of the footprint at ground level. Footprint 44 x 38
# (layout.ts L.southBldg); the front (promenade side) is north.
# ---------------------------------------------------------------------------
def south_building():
    start('south-building')
    W, D = 44, 38
    split = 0  # Laugh Floor / Buzz split (L.laughFloorSplit - centre x)
    lf_h, bz_h = 11.0, 12.5
    # Base course.
    box(W + 0.8, 0.9, D + 0.8, 0, 0.45, 0, 'silver', bev=0.1)
    # Two volumes.
    hw = W / 2
    lf_w, bz_w = split + hw, hw - split
    lf_x, bz_x = (-hw + split) / 2, (split + hw) / 2
    box(lf_w, lf_h, D, lf_x, lf_h / 2, 0, 'white')
    box(bz_w, bz_h, D, bz_x, bz_h / 2, 0, 'white')
    # Cladding on every face.
    for (vx, vw, vh) in ((lf_x, lf_w, lf_h), (bz_x, bz_w, bz_h)):
        paneled_wall(vw, vh - 1.4, vx, (vh - 1.4) / 2 + 0.9, -D / 2 - 0.02, math.pi, 'panel')
        paneled_wall(vw, vh - 1.4, vx, (vh - 1.4) / 2 + 0.9, D / 2 + 0.02, 0, 'panel')
    paneled_wall(D, lf_h - 1.4, -hw - 0.02, (lf_h - 1.4) / 2 + 0.9, 0, -math.pi / 2, 'panel')
    paneled_wall(D, bz_h - 1.4, hw + 0.02, (bz_h - 1.4) / 2 + 0.9, 0, math.pi / 2, 'panel')
    # Cornices with a stepped coping and a reveal band.
    for (vx, vw, vh) in ((lf_x, lf_w, lf_h), (bz_x, bz_w, bz_h)):
        box(vw + 1.0, 0.6, D + 1.0, vx, vh - 0.3, 0, 'silver', bev=0.12)
        box(vw + 0.4, 0.5, D + 0.4, vx, vh + 0.25, 0, 'white', bev=0.08)
        box(vw + 0.3, 0.18, D + 0.3, vx, 4.0, 0, 'silver')
    # Laugh Floor storefront under a cantilevered canopy.
    # (The site's porthole windows sit above it at y 3.8 to 6.2.)
    storefront(16, 2.4, -11, 0.9, -D / 2 - 0.3, math.pi)
    box(18, 0.3, 3.2, -11, 3.55, -D / 2 - 1.6, 'white', bev=0.1)
    box(18, 0.12, 0.2, -11, 3.36, -D / 2 - 3.15, 'blueSoft')
    for dx in (-8.4, 8.4):
        cyl(0.14, 0.14, 2.6, 8, -11 + dx, 2.2, -D / 2 - 2.9, 'silver')
    # Buzz storefront behind the fins.
    storefront(18, 3.4, 11, 0.9, -D / 2 - 0.3, math.pi, mullion=2.4)
    # Laugh Floor exit on the west side with a canopy.
    storefront(8, 3.0, -hw - 0.3, 0.9, 6, -math.pi / 2)
    box(3, 0.3, 10, -hw - 1.6, 4.2, 6, 'white', bev=0.08)
    box(0.18, 0.1, 10, -hw - 3.0, 4.0, 6, 'warmGlow')
    # Loading docks at the back.
    for x in (-14, -2, 12):
        box(4.2, 4.4, 0.2, x, 3.1, D / 2 + 0.12, 'dark')
        for i in range(8):
            box(4.0, 0.06, 0.26, x, 1.2 + i * 0.5, D / 2 + 0.14, 'silver')
        box(5.4, 0.3, 2.2, x, 5.6, D / 2 + 1.1, 'silver', bev=0.05)
    # Roof: Buzz clerestory vault with ribs and skylights.
    half_vault(4.0, 0.7, 18, 11, bz_h + 0.5, 4, 'roof')
    for i in range(8):
        arch_rib(4.15, 0.7, 0.35, 0.3, 11 - 8.75 + i * 2.5, bz_h + 0.5, 4, 0, 'silver')
    for sx in (-9.1, 9.1):
        half_disc(4.0, 0.7, 11 + sx, bz_h + 0.5, 4, 'glass')
    for z in (-6, 14):
        box(14, 0.25, 1.6, 11, bz_h + 0.6, z, 'glass')
        box(14.4, 0.3, 2.0, 11, bz_h + 0.48, z, 'silver')
    # Air handlers.
    for (x, z, r) in ((-17, -6, 0), (-9, 8, 0.0), (-17, 12, math.pi / 2), (4, -12, 0), (19, -4, math.pi / 2)):
        hvac(x, (lf_h if x < split else bz_h) + 0.5, z, r)
    # Roof walkway/parapet rails.
    for z in (-D / 2 + 1.5, D / 2 - 1.5):
        box(lf_w - 2, 0.6, 0.15, lf_x, lf_h + 0.8, z, 'silver')
    finalize('south-building')


# ---------------------------------------------------------------------------
# North show building: Merchant of Venus (west), the former Stitch's Great
# Escape theater (rotunda on the roof), Cosmic Ray's Starlight Café (east).
# Footprint 44 x 42 (layout.ts L.northBldg), front (promenade) is south.
# ---------------------------------------------------------------------------
def north_building():
    start('north-building')
    W, D, H = 44, 42, 10
    box(W + 0.8, 0.9, D + 0.8, 0, 0.45, 0, 'silver', bev=0.1)
    box(W, H, D, 0, H / 2, 0, 'white')
    paneled_wall(W, H - 1.4, 0, (H - 1.4) / 2 + 0.9, -D / 2 - 0.02, math.pi, 'panel')
    paneled_wall(D, H - 1.4, -W / 2 - 0.02, (H - 1.4) / 2 + 0.9, 0, -math.pi / 2, 'panel')
    paneled_wall(D, H - 1.4, W / 2 + 0.02, (H - 1.4) / 2 + 0.9, 0, math.pi / 2, 'panel')
    # Front: cladding except the Stitch bay (local x -20..2) and Cosmic Ray's glazing.
    # Front: Stitch bay local x -18..0 (rotunda at -9), Cosmic Ray's 0..22.
    paneled_wall(4, H - 1.4, -20, (H - 1.4) / 2 + 0.9, D / 2 + 0.02, 0, 'panel')
    paneled_wall(18, H - 1.4, -9, (H - 1.4) / 2 + 0.9, D / 2 + 0.02, 0, 'panel', px=2.6)
    paneled_wall(22, H - 5.4, 11, (H - 5.4) / 2 + 4.9, D / 2 + 0.02, 0, 'panel')
    box(W + 1.0, 0.6, D + 1.0, 0, H - 0.3, 0, 'silver', bev=0.12)
    box(W + 0.4, 0.5, D + 0.4, 0, H + 0.25, 0, 'white', bev=0.08)
    box(W + 0.3, 0.18, D + 0.3, 0, 4.0, 0, 'silver')
    # Tapered space-age fins along the front, rising above the roof.
    for x in (-20.5, 0.6, 6.0, 11.4, 16.8, 21.6):
        bm = bmesh.new()
        prof = [(0, 0), (1.6, 0), (1.6, 0.6), (0.9, H + 2.6), (0.2, H + 3.0), (0, H + 3.0)]
        front = [bm.verts.new((-0.25, -p[0], p[1])) for p in prof]
        back = [bm.verts.new((0.25, -p[0], p[1])) for p in prof]
        bm.faces.new(front)
        bm.faces.new(list(reversed(back)))
        n = len(prof)
        for k in range(n):
            bm.faces.new((front[k], front[(k + 1) % n], back[(k + 1) % n], back[k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = obj_from_bm('fin', bm, 'silver')
        o.location = B(x, 0, D / 2)
        box(0.12, H - 1, 0.12, x, H / 2 + 0.5, D / 2 + 1.5, 'blueSoft')
    # Cosmic Ray's: glazed frontage, canopy and a ribbed barrel vault.
    storefront(20, 4.0, 11, 0.9, D / 2 + 0.25, 0, mullion=2.5)
    box(21, 0.35, 3.6, 11, 5.2, D / 2 + 1.8, 'white', bev=0.1)
    for i in range(10):
        cyl(0.18, 0.18, 0.06, 8, 2 + i * 2, 5.0, D / 2 + 1.8 + (0.8 if i % 2 else -0.8), 'warmGlow')
    for dx in (-10, 10):
        cyl(0.16, 0.16, 4.3, 8, 11 + dx, 3.05, D / 2 + 3.3, 'silver')
    half_vault(9, 0.5, 20, 11, H, 2, 'roof', seg=24)
    for i in range(8):
        arch_rib(9.2, 0.5, 0.45, 0.35, 11 - 9.8 + i * 2.8, H, 2, 0, 'silver', seg=18)
    for sx in (-10.05, 10.05):
        half_disc(9, 0.5, 11 + sx, H, 2, 'glass', seg=18)
    # Mullions on the vault's glazed ends.
    for sx in (-10.1, 10.1):
        for k in range(1, 6):
            zz = -9 + 18 * k / 6
            hh = math.sqrt(max(0.0, 81 - zz * zz)) * 0.5
            box(0.14, hh, 0.14, 11 + sx, H + hh / 2, 2 + zz, 'silver')
    # Stitch rotunda: ribbed drum, cone roof and lantern. Stays inside the
    # animated light band (r 10.6) the site adds.
    rx, rz = -9, 0
    cyl(10.5, 10, 5, 28, rx, H + 2.5, rz, 'white')
    for i in range(28):
        a = (i / 28) * math.pi * 2
        box(0.5, 5, 0.35, rx + math.cos(a) * 10.3, H + 2.5, rz + math.sin(a) * 10.3, 'silver', rot=-a)
    cyl(10.4, 10.4, 0.4, 28, rx, H + 5.1, rz, 'silver')
    cyl(10.2, 6, 2.4, 28, rx, H + 6.4, rz, 'roof')
    for i in range(14):
        a = (i / 14) * math.pi * 2
        r = 8.1
        rib = box(4.9, 0.25, 0.3, rx + math.cos(a) * r, H + 6.5, rz + math.sin(a) * r, 'silver')
        rib.rotation_euler = (0, math.atan2(2.4, 4.2), -a)
    cyl(5.8, 5.8, 0.4, 24, rx, H + 7.8, rz, 'silver')
    cyl(3.2, 2.6, 1.6, 16, rx, H + 8.6, rz, 'glass')
    cyl(3.4, 3.4, 0.25, 16, rx, H + 9.5, rz, 'silver')
    # Merchant of Venus: arched entry on the west side, toward the hub.
    storefront(6, 3.0, -W / 2 - 0.25, 0.9, 6, -math.pi / 2)
    arch_rib(3.4, 0.9, 0.35, 0.6, -W / 2 - 0.6, 3.9, 6, 0, 'silver', seg=12)
    # Back of house on the north side.
    for x in (-14, 0, 14):
        box(4.2, 4.4, 0.2, x, 3.1, -D / 2 - 0.12, 'dark')
        box(5.4, 0.3, 2.2, x, 5.6, -D / 2 - 1.1, 'silver', bev=0.05)
    for (x, z) in ((-17, -14), (-17, 10), (6, -14), (16, -14), (18, 14)):
        hvac(x, H + 0.5, z)
    finalize('north-building')


# ---------------------------------------------------------------------------
# Walt Disney's Carousel of Progress: a rotating theater. Local origin is the
# drum centre; drum radius 15. The site keeps its own entrance and turntable.
# ---------------------------------------------------------------------------
def carousel():
    start('carousel')
    R = 15
    cyl(R + 1.6, R + 1.4, 0.9, 48, 0, 0.45, 0, 'silver')
    cyl(R + 0.6, R, 9, 48, 0, 4.5, 0, 'white')
    # Six theater bays read as tall panels between ribbed fins.
    for i in range(24):
        a = (i / 24) * math.pi * 2
        box(1.4, 9.6, 0.5, math.cos(a) * (R + 0.9), 4.8, math.sin(a) * (R + 0.9), 'silver', rot=-a, bev=0.08)
    for i in range(6):
        a = (i / 6) * math.pi * 2 + math.pi / 12
        box(0.3, 3.0, 6.4, math.cos(a) * (R + 0.65), 3.0, math.sin(a) * (R + 0.65), 'glass', rot=-a)
    # Ring canopy with a fascia; the site adds the glowing band beneath it.
    cyl(R + 3.2, R + 3.2, 0.6, 48, 0, 8.2, 0, 'white')
    cyl(R + 3.3, R + 3.3, 0.25, 48, 0, 8.6, 0, 'silver', cap=False)
    cyl(R + 3.0, R + 3.0, 0.15, 48, 0, 7.85, 0, 'warmGlow', cap=False)
    # Stepped roof with radial ribs.
    cyl(R + 1.2, 9, 2.0, 48, 0, 9.5, 0, 'roof')
    cyl(9, 4, 2.4, 36, 0, 11.7, 0, 'roof')
    for i in range(18):
        a = (i / 18) * math.pi * 2
        r = (R + 1.2 + 4) / 2
        rb = box(math.hypot(R + 1.2 - 4, 4.4) + 0.3, 0.35, 0.35, math.cos(a) * r, 10.7 + 0.25, math.sin(a) * r, 'silver')
        rb.rotation_euler = (0, math.atan2(4.4, R + 1.2 - 4), -a)
    cyl(4.2, 4, 1.6, 24, 0, 13.1, 0, 'white')
    cyl(4.4, 4.4, 0.2, 24, 0, 13.95, 0, 'silver', cap=False)
    finalize('carousel')


# ---------------------------------------------------------------------------
# Tomorrowland Terrace: glass pavilion under a swept wing roof. Local origin
# at the pavilion centre; it runs north-south (z), 24 long.
# ---------------------------------------------------------------------------
def terrace():
    start('terrace')
    box(13.5, 0.6, 22, -0.5, 0.3, 0, 'silver', bev=0.08)
    box(10, 4, 18, 0, 2.6, 0, 'white')
    # Glazed long sides with mullions.
    storefront(16, 3.4, 5.1, 0.6, 0, math.pi / 2, mullion=2.0)
    storefront(16, 3.4, -5.1, 0.6, 0, -math.pi / 2, mullion=2.0)
    # Swept wing roof: a thin slab thicker at the spine, rising at both ends.
    bm = bmesh.new()
    nz, nx = 16, 6
    L_, Wd = 26, 18
    grid_top, grid_bot = [], []
    for i in range(nz + 1):
        t = i / nz
        z = -L_ / 2 + L_ * t
        lift = 1.2 * (2 * t - 1) ** 2
        rt, rb = [], []
        for j in range(nx + 1):
            s = j / nx
            x = -Wd / 2 + Wd * s
            wing = 1.3 * abs(2 * s - 1) ** 1.5
            thick = 0.7 * (1 - abs(2 * s - 1)) + 0.12
            y = 6.4 + lift + wing
            rt.append(bm.verts.new((x, -z, y + thick / 2)))
            rb.append(bm.verts.new((x, -z, y - thick / 2)))
        grid_top.append(rt)
        grid_bot.append(rb)
    for i in range(nz):
        for j in range(nx):
            bm.faces.new((grid_top[i][j], grid_top[i][j + 1], grid_top[i + 1][j + 1], grid_top[i + 1][j]))
            bm.faces.new((grid_bot[i + 1][j], grid_bot[i + 1][j + 1], grid_bot[i][j + 1], grid_bot[i][j]))
    for i in range(nz):
        for g in ((0,), (nx,)):
            j = g[0]
            bm.faces.new((grid_top[i][j], grid_top[i + 1][j], grid_bot[i + 1][j], grid_bot[i][j]))
    for j in range(nx):
        for i in (0, nz):
            bm.faces.new((grid_top[i][j], grid_bot[i][j], grid_bot[i][j + 1], grid_top[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm('wing', bm, 'white')
    o.location = B(-0.5, 0, 0)
    # Glow strip along both wing edges.
    for s in (-1, 1):
        box(0.15, 0.12, 26, -0.5 + s * 9.05, 7.7, 0, 'blueSoft')
    # V columns.
    for z in (-9, -3, 3, 9):
        for s in (-1, 1):
            c = cyl(0.22, 0.22, 6.2, 8, -0.5 + s * 6.2, 3.4, z, 'silver')
            c.rotation_euler = (0, s * 0.18, 0)
    # Outdoor tables with umbrellas at both ends (the moat is close on the west).
    for (x, z) in ((-4, -14.8), (1.8, -14.8), (-4, 14.8), (1.8, 14.8)):
        cyl(0.9, 0.9, 0.12, 12, x, 1.4, z, 'white')
        cyl(0.12, 0.12, 1.3, 6, x, 0.65, z, 'silver')
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            cyl(0.32, 0.32, 0.12, 8, x + math.cos(a) * 1.3, 0.8, z + math.sin(a) * 1.3, 'coral')
        cyl(0.05, 0.05, 2.0, 5, x, 2.4, z, 'silver')
        cyl(2.0, 0.1, 0.8, 8, x, 3.6, z, 'white')
    finalize('terrace')


# ---------------------------------------------------------------------------
# Instanced pieces: trees, lamp post, bench, planter. Each piece is exported as
# one object per material, named <piece>_<material>.
# ---------------------------------------------------------------------------
def nature():
    start('nature')
    rnd = random.Random(7)
    groups = {}

    def piece(name, fn):
        before = set(COLL.objects)
        fn()
        groups[name] = [o for o in COLL.objects if o not in before]

    def palm():
        # Gently curved trunk built from tapered segments.
        segs = 7
        pts = []
        for i in range(segs + 1):
            t = i / segs
            pts.append((0.9 * t * t, 7.5 * t))
        for i in range(segs):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            r0 = 0.36 - 0.18 * i / segs
            r1 = 0.36 - 0.18 * (i + 1) / segs
            c = cyl(r0, r1 * 1.12, math.hypot(x1 - x0, y1 - y0), 6, (x0 + x1) / 2, (y0 + y1) / 2, 0, 'trunk')
            c.rotation_euler = (0, math.atan2(x1 - x0, y1 - y0), 0)
        top = Vector(B(pts[-1][0], pts[-1][1], 0))
        # Fronds: arched, tapered blades.
        for k in range(8):
            a = k / 8 * math.pi * 2 + rnd.uniform(-0.2, 0.2)
            bm = bmesh.new()
            n = 6
            length = 4.2 + rnd.uniform(-0.5, 0.5)
            spine = []
            for i in range(n + 1):
                t = i / n
                spine.append((t * length, 0.9 * math.sin(t * math.pi * 0.9) - 1.6 * t * t))
            left, right, mid = [], [], []
            for i, (u, v) in enumerate(spine):
                wdt = 0.75 * math.sin(math.pi * min(1, (i + 0.4) / n)) * (1 - i / (n + 1)) + 0.05
                left.append(bm.verts.new((u, wdt, v - 0.08)))
                right.append(bm.verts.new((u, -wdt, v - 0.08)))
                mid.append(bm.verts.new((u, 0, v + 0.12)))
            for i in range(n):
                bm.faces.new((mid[i], mid[i + 1], left[i + 1], left[i]))
                bm.faces.new((mid[i + 1], mid[i], right[i], right[i + 1]))
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Z'))
            bmesh.ops.translate(bm, verts=bm.verts, vec=top)
            obj_from_bm('frond', bm, 'palm')
        s = cyl(0.5, 0.2, 0.7, 6, pts[-1][0], pts[-1][1] - 0.1, 0, 'trunk')

    def oak():
        cyl(0.3, 0.2, 2.6, 6, 0, 1.3, 0, 'trunk')
        for (x, y, z, r) in ((0, 3.6, 0, 2.0), (1.2, 3.1, 0.6, 1.4), (-1.1, 3.2, -0.5, 1.5), (0.2, 4.6, -0.3, 1.3), (-0.4, 3.0, 1.1, 1.2)):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=B(x, y, z))
            o = link(bpy.context.active_object)
            o.data.materials.append(mat('foliage'))
            # Jitter vertices so the crowns read as leafy clumps, not balls.
            for v in o.data.vertices:
                v.co *= 1 + rnd.uniform(-0.12, 0.12)

    def pine():
        cyl(0.22, 0.16, 2.0, 6, 0, 1.0, 0, 'trunk')
        for i, (r, y) in enumerate(((2.3, 2.8), (1.8, 4.3), (1.25, 5.7), (0.7, 6.9))):
            c = cyl(r, 0.15, 2.4 - i * 0.25, 7, 0, y, 0, 'foliageDark')
            c.rotation_euler = (0, 0, i * 0.4)

    def shrub():
        for (x, z, r) in ((0, 0, 0.9), (0.7, 0.3, 0.6), (-0.6, 0.4, 0.7), (0.1, -0.7, 0.6)):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=B(x, r * 0.7, z))
            o = link(bpy.context.active_object)
            o.data.materials.append(mat('foliage'))

    def lamp():
        # Space-age lamp post: flared base, slim tapered pole, halo ring and globe.
        cyl(0.55, 0.35, 0.5, 10, 0, 0.25, 0, 'silver')
        cyl(0.2, 0.1, 4.6, 8, 0, 2.8, 0, 'silver')
        ring(0.85, 0.06, 0, 5.3, 0, 'silver', seg=20, tseg=4)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.5, location=B(0, 5.3, 0))
        o = link(bpy.context.active_object)
        o.data.materials.append(mat('warmGlow'))
        for k in range(3):
            a = k / 3 * math.pi * 2
            box(0.5, 1.0, 0.08, math.cos(a) * 0.3, 4.6, math.sin(a) * 0.3, 'silver', rot=-a)
        cyl(0.07, 0.02, 0.8, 6, 0, 6.15, 0, 'silver')

    def bench():
        # Curved-back bench, 3 long.
        box(3.0, 0.14, 0.9, 0, 0.9, 0, 'white', bev=0.05)
        b = box(3.0, 0.9, 0.12, 0, 1.4, 0.48, 'white', bev=0.04)
        b.rotation_euler = (-0.2, 0, 0)
        for x in (-1.3, 1.3):
            box(0.14, 0.85, 0.8, x, 0.42, 0.05, 'silver')
        box(2.6, 0.06, 0.06, 0, 0.82, -0.47, 'blueSoft')

    def planter():
        cyl(1.8, 2.1, 1.1, 16, 0, 0.55, 0, 'planter')
        cyl(1.9, 1.9, 0.12, 16, 0, 1.12, 0, 'silver', cap=False)
        for (x, z, r) in ((0, 0, 1.0), (0.8, 0.5, 0.65), (-0.7, 0.4, 0.7), (0.2, -0.8, 0.6)):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=B(x, 1.3 + r * 0.5, z))
            o = link(bpy.context.active_object)
            o.data.materials.append(mat('foliage'))

    for name, fn in (('palm', palm), ('oak', oak), ('pine', pine), ('shrub', shrub), ('lamp', lamp), ('bench', bench), ('planter', planter)):
        piece(name, fn)

    # Join each piece's parts per material: <piece>_<material>.
    bpy.ops.object.select_all(action='DESELECT')
    for name, objs in groups.items():
        by_mat = {}
        for o in objs:
            by_mat.setdefault(o.data.materials[0].name, []).append(o)
        for key, group in by_mat.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in group:
                o.select_set(True)
            bpy.context.view_layer.objects.active = group[0]
            bpy.ops.object.convert(target='MESH')
            if len(group) > 1:
                bpy.ops.object.join()
            j = bpy.context.view_layer.objects.active
            j.name = f'{name}_{key}'
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    tris = {}
    for o in COLL.objects:
        o.data.calc_loop_triangles()
        p = o.name.split('_')[0]
        tris[p] = tris.get(p, 0) + len(o.data.loop_triangles)
    bpy.ops.object.select_all(action='DESELECT')
    for o in COLL.objects:
        o.select_set(True)
    path = os.path.join(OUT, 'nature.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_texcoords=False, export_materials='EXPORT', export_animations=False)
    print('nature:', tris, f'{os.path.getsize(path) / 1024:.0f} KB')


if __name__ == '__main__':
    south_building()
    north_building()
    carousel()
    terrace()
    nature()
