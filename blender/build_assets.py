"""
NVDA: Ascent — procedural asset pipeline.

Builds every 3D model used by the game from code and exports each one as a
self-contained .glb into public/models/. Also renders a turntable-style
showcase image of all assets into docs/assets_showcase.png.

Run headless (does not touch any open .blend):
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python blender/build_assets.py

Assets
------
player_core.glb   Goldberg-polyhedron "tensor core" orb (the player ball)
gpu_card.glb      Dual-fan consumer graphics card (GeForce-era pickups)
dc_module.glb     SXM-style data-center accelerator (Tesla / A100 / H100 / B200 pickups)
gate.glb          Milestone arch the player rolls through
server_rack.glb   Data-center rack used as AI-era set dressing
summit_spire.glb  Finish-line spire at the all-time high
"""

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "public", "models")
DOCS = os.path.join(ROOT, "docs")
os.makedirs(OUT, exist_ok=True)
os.makedirs(DOCS, exist_ok=True)

random.seed(7)
NV_GREEN = (0.463, 0.725, 0.0)  # #76B900 in sRGB-ish linear-friendly values


# --------------------------------------------------------------------------
# Scene helpers
# --------------------------------------------------------------------------

def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def srgb_to_linear(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


_mat_cache = {}


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0, alpha=1.0):
    """Principled material that round-trips cleanly through glTF."""
    key = name
    if key in _mat_cache and _mat_cache[key].name in bpy.data.materials:
        return _mat_cache[key]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    lin = srgb_to_linear(color)
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(emission), 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    m.diffuse_color = (*lin, alpha)
    _mat_cache[key] = m
    return m


def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_obj(name, bm, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    link(ob)
    if material:
        ob.data.materials.append(material)
    return ob


def box(name, size, loc=(0, 0, 0), material=None, bevel=0.0, segments=2, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = mesh_obj(name, bm, material)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    if bevel > 0:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
    return ob


def cylinder(name, r, depth, loc=(0, 0, 0), material=None, verts=32, rot=None, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    ob = mesh_obj(name, bm, material)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    return ob


def torus(name, R, r, loc=(0, 0, 0), material=None, rot=None, major=48, minor=12):
    bm = bmesh.new()
    verts = []
    for i in range(major):
        a = 2 * math.pi * i / major
        ring = []
        for j in range(minor):
            b = 2 * math.pi * j / minor
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            ring.append(bm.verts.new((x, y, z)))
        verts.append(ring)
    for i in range(major):
        for j in range(minor):
            a = verts[i][j]
            b = verts[(i + 1) % major][j]
            c = verts[(i + 1) % major][(j + 1) % minor]
            d = verts[i][(j + 1) % minor]
            bm.faces.new((a, b, c, d))
    ob = mesh_obj(name, bm, material)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    smooth(ob)
    return ob


def smooth(ob, angle=40):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(angle))
    except Exception:
        pass


def apply_all(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:  # pragma: no cover
            print("modifier apply failed", ob.name, m.name, e)


def join(objs, name):
    for o in objs:
        apply_all(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def export(objs, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    path = os.path.join(OUT, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_normals=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f"[export] {filename:<18} {os.path.getsize(path)/1024:7.1f} KB  objects={len(objs)}")
    return path


def tri_count(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


# --------------------------------------------------------------------------
# 1. Player — Goldberg "tensor core" orb
# --------------------------------------------------------------------------

def build_player_core():
    """Dual of a subdivided icosahedron → 12 pentagons + hexagons.
    Every cell becomes an inset, extruded armour panel; the gaps reveal a
    glowing inner core. A few panels are bright so rolling reads clearly."""
    R = 1.0
    ico = bmesh.new()
    bmesh.ops.create_icosphere(ico, subdivisions=2, radius=R)
    ico.verts.ensure_lookup_table()
    ico.faces.ensure_lookup_table()

    panel_dark = mat("Core Panel Dark", (0.10, 0.11, 0.12), metallic=0.95, roughness=0.28)
    panel_lite = mat("Core Panel Silver", (0.78, 0.80, 0.82), metallic=1.0, roughness=0.18)
    panel_glow = mat("Core Panel Accent", NV_GREEN, metallic=0.2, roughness=0.35,
                     emission=NV_GREEN, strength=6.0)

    out = bmesh.new()
    mat_index = []
    for v in ico.verts:
        n = v.co.normalized()
        centers = [f.calc_center_median().normalized() * R for f in v.link_faces]
        # order the face centres around the vertex normal
        ref = (centers[0] - n * centers[0].dot(n)).normalized()
        side = n.cross(ref)

        def ang(c):
            d = c - n * c.dot(n)
            return math.atan2(d.dot(side), d.dot(ref))

        centers.sort(key=ang)
        centre = sum(centers, Vector()) / len(centers)
        inset = 0.86
        outer = [centre.lerp(c, inset).normalized() * R for c in centers]
        inner = [p * 0.90 for p in outer]
        vo = [out.verts.new(p) for p in outer]
        vi = [out.verts.new(p) for p in inner]
        faces = [out.faces.new(vo)]
        k = len(vo)
        for i in range(k):
            faces.append(out.faces.new((vo[i], vi[i], vi[(i + 1) % k], vo[(i + 1) % k])))
        is_pent = len(centers) == 5
        idx = 2 if is_pent else (1 if random.random() < 0.18 else 0)
        for f in faces:
            f.material_index = idx
    bmesh.ops.recalc_face_normals(out, faces=out.faces)
    shell = mesh_obj("PlayerCore_Shell", out)
    for m in (panel_dark, panel_lite, panel_glow):
        shell.data.materials.append(m)
    bev = shell.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.012
    bev.segments = 2
    bev.limit_method = "ANGLE"
    smooth(shell, 30)

    # Inner energy core visible through the seams
    core_mat = mat("Core Energy", NV_GREEN, emission=(0.55, 1.0, 0.1), strength=9.0)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.86)
    core = mesh_obj("PlayerCore_Energy", bm, core_mat)
    smooth(core)

    # Equatorial gyro band — makes spin direction readable
    band_mat = mat("Core Band", (0.06, 0.06, 0.07), metallic=1.0, roughness=0.22)
    band = torus("PlayerCore_Band", 1.035, 0.055, material=band_mat, major=96, minor=16)
    stripe_mat = mat("Core Band Glow", NV_GREEN, emission=NV_GREEN, strength=12.0)
    stripe = torus("PlayerCore_BandGlow", 1.07, 0.018, material=stripe_mat, major=96, minor=8)

    objs = [shell, core, band, stripe]
    for o in objs:
        apply_all(o)
    print("  player tris:", sum(tri_count(o) for o in objs))
    return objs


# --------------------------------------------------------------------------
# 2. Graphics card — dual-fan consumer GPU
# --------------------------------------------------------------------------

def fan(name, loc, radius, material_blade, material_hub, material_ring, blades=11):
    parts = []
    hub = cylinder(name + "_Hub", radius * 0.32, 0.06, loc=loc, material=material_hub,
                   verts=32, rot=(math.radians(90), 0, 0))
    parts.append(hub)
    for i in range(blades):
        a = 2 * math.pi * i / blades
        bm = bmesh.new()
        # swept, twisted blade: a thin quad strip curved along its length
        steps = 6
        w0, w1 = 0.10 * radius, 0.24 * radius
        rows = []
        for s in range(steps + 1):
            t = s / steps
            r = radius * (0.30 + 0.66 * t)
            sweep = a + 0.55 * t
            w = w0 + (w1 - w0) * t
            twist = math.radians(28)
            cx, cz = r * math.cos(sweep), r * math.sin(sweep)
            tx, tz = -math.sin(sweep), math.cos(sweep)
            a1 = Vector((cx - tx * w * 0.5, -math.sin(twist) * w * 0.5, cz - tz * w * 0.5))
            a2 = Vector((cx + tx * w * 0.5, math.sin(twist) * w * 0.5, cz + tz * w * 0.5))
            rows.append((bm.verts.new(a1), bm.verts.new(a2)))
        for s in range(steps):
            bm.faces.new((rows[s][0], rows[s + 1][0], rows[s + 1][1], rows[s][1]))
        blade = mesh_obj(f"{name}_Blade{i}", bm, material_blade)
        sol = blade.modifiers.new("Solid", "SOLIDIFY")
        sol.thickness = 0.018
        blade.location = loc
        parts.append(blade)
    ring = torus(name + "_Ring", radius * 1.04, 0.035, loc=loc, material=material_ring,
                 rot=(math.radians(90), 0, 0), major=64, minor=10)
    parts.append(ring)
    return parts


def build_gpu_card():
    L, H = 2.8, 1.15  # length (x), height (z); thickness along y
    pcb_m = mat("PCB", (0.04, 0.09, 0.05), metallic=0.1, roughness=0.6)
    shroud_m = mat("Shroud", (0.16, 0.165, 0.175), metallic=0.65, roughness=0.34)
    shroud_dark = mat("Shroud Dark", (0.035, 0.035, 0.04), metallic=0.6, roughness=0.45)
    accent = mat("GPU Accent Glow", NV_GREEN, emission=NV_GREEN, strength=10.0)
    fin_m = mat("Heatsink Fins", (0.72, 0.73, 0.75), metallic=1.0, roughness=0.3)
    gold = mat("Gold Contacts", (1.0, 0.77, 0.34), metallic=1.0, roughness=0.25)
    bracket_m = mat("Bracket Steel", (0.62, 0.63, 0.65), metallic=1.0, roughness=0.4)
    blade_m = mat("Fan Blade", (0.05, 0.05, 0.055), metallic=0.2, roughness=0.5)
    hub_m = mat("Fan Hub", (0.18, 0.18, 0.19), metallic=0.9, roughness=0.25)

    parts = []
    parts.append(box("PCB", (L, 0.05, H * 0.92), loc=(0, 0.17, -0.02), material=pcb_m))
    parts.append(box("Backplate", (L, 0.03, H * 0.92), loc=(0, 0.215, -0.02), material=shroud_m, bevel=0.01))

    # Shroud: chamfered main body
    sh = box("Shroud", (L * 0.98, 0.16, H), loc=(0, 0.05, 0), material=shroud_m, bevel=0.05, segments=3)
    parts.append(sh)
    # Front faceplate with recessed fan wells
    parts.append(box("Faceplate", (L * 0.94, 0.04, H * 0.9), loc=(0, -0.05, 0), material=shroud_dark, bevel=0.03))

    # Angular accent strips (emissive)
    parts.append(box("Accent Top", (L * 0.86, 0.02, 0.035), loc=(0, -0.075, H * 0.43), material=accent))
    parts.append(box("Accent Diag L", (0.5, 0.02, 0.03), loc=(-0.02, -0.075, -H * 0.38), material=accent,
                     rot=(0, math.radians(-18), 0)))
    parts.append(box("Accent Edge", (0.03, 0.18, H * 0.7), loc=(L * 0.495, 0.05, 0), material=accent))

    # Heatsink fins visible along the top edge
    for i in range(42):
        x = -L * 0.44 + i * (L * 0.88 / 41)
        parts.append(box(f"Fin{i}", (0.012, 0.14, 0.08), loc=(x, 0.05, H * 0.5 + 0.03), material=fin_m))

    # Fans
    for fx in (-0.62, 0.62):
        parts += fan(f"Fan{'L' if fx < 0 else 'R'}", (fx, -0.08, 0.0), 0.44, blade_m, hub_m, shroud_m)

    # PCIe bracket + vents
    br = box("Bracket", (0.03, 0.34, H * 1.05), loc=(-L * 0.5 - 0.02, 0.08, 0.02), material=bracket_m)
    parts.append(br)
    parts.append(box("Bracket Tab", (0.12, 0.34, 0.03), loc=(-L * 0.5 + 0.04, 0.08, H * 0.55), material=bracket_m))
    for i in range(6):
        parts.append(box(f"Vent{i}", (0.035, 0.24, 0.05), loc=(-L * 0.5 - 0.025, 0.08, -0.32 + i * 0.12),
                         material=shroud_dark))
    # Display outputs
    for i in range(3):
        parts.append(box(f"Port{i}", (0.04, 0.13, 0.07), loc=(-L * 0.5 - 0.03, 0.12, -0.42 + i * 0.13),
                         material=shroud_dark))

    # Gold PCIe fingers
    parts.append(box("PCIe Edge", (1.4, 0.045, 0.1), loc=(-0.35, 0.17, -H * 0.5 - 0.06), material=pcb_m))
    for i in range(38):
        parts.append(box(f"Pin{i}", (0.022, 0.05, 0.08), loc=(-1.0 + i * 0.035, 0.17, -H * 0.5 - 0.065),
                         material=gold))
    # Power connector
    parts.append(box("Power", (0.22, 0.12, 0.08), loc=(0.85, 0.12, H * 0.5 + 0.04), material=shroud_dark, bevel=0.01))

    for o in parts:
        apply_all(o)
        smooth(o, 35)
    # centre the model on origin
    bb = [o.matrix_world @ Vector(c) for o in parts for c in o.bound_box]
    centre = sum(bb, Vector()) / len(bb)
    for o in parts:
        o.location -= centre
    print("  gpu tris:", sum(tri_count(o) for o in parts))
    return parts


# --------------------------------------------------------------------------
# 3. Data-center accelerator module (SXM-style)
# --------------------------------------------------------------------------

def build_dc_module():
    pcb_m = mat("DC PCB", (0.03, 0.07, 0.045), metallic=0.15, roughness=0.55)
    sub_m = mat("Substrate", (0.32, 0.27, 0.16), metallic=0.3, roughness=0.5)
    die_m = mat("Silicon Die", (0.16, 0.17, 0.22), metallic=1.0, roughness=0.08)
    hbm_m = mat("HBM Stack", (0.06, 0.06, 0.07), metallic=0.7, roughness=0.3)
    gold = mat("Gold Contacts", (1.0, 0.77, 0.34), metallic=1.0, roughness=0.25)
    cap_m = mat("Capacitor", (0.55, 0.45, 0.32), metallic=0.2, roughness=0.5)
    vrm_m = mat("Inductor", (0.12, 0.12, 0.13), metallic=0.5, roughness=0.4)
    accent = mat("GPU Accent Glow", NV_GREEN, emission=NV_GREEN, strength=10.0)
    screw = mat("Screw", (0.7, 0.7, 0.72), metallic=1.0, roughness=0.3)

    W, D = 2.4, 1.6  # x, y on board plane (board lies in XY, faces +Z)
    parts = [box("Board", (W, D, 0.06), material=pcb_m, bevel=0.02)]
    parts.append(box("Interposer", (1.15, 0.95, 0.05), loc=(0, 0, 0.055), material=sub_m, bevel=0.01))
    # Two reticle-sized compute dies (Blackwell-style dual die)
    for dx in (-0.21, 0.21):
        parts.append(box(f"Die{dx}", (0.38, 0.5, 0.035), loc=(dx, 0, 0.098), material=die_m, bevel=0.004))
    # Glowing die-to-die interconnect
    parts.append(box("NV-HBI", (0.03, 0.42, 0.012), loc=(0, 0, 0.12), material=accent))
    # HBM stacks around the dies
    for sx in (-0.48, 0.48):
        for sy in (-0.3, -0.1, 0.1, 0.3):
            parts.append(box(f"HBM{sx}{sy}", (0.11, 0.16, 0.05), loc=(sx * 0.98, sy * 1.15, 0.105), material=hbm_m,
                             bevel=0.004))
    # Glow ring around package
    for (sx, sy, lx, ly) in ((0, 0.52, 1.2, 0.02), (0, -0.52, 1.2, 0.02), (0.62, 0, 0.02, 1.06), (-0.62, 0, 0.02, 1.06)):
        parts.append(box(f"Ring{sx}{sy}", (lx, ly, 0.012), loc=(sx, sy, 0.04), material=accent))
    # VRM inductors & caps
    for i in range(10):
        x = -0.95 + i * 0.21
        parts.append(box(f"VRM{i}", (0.14, 0.14, 0.09), loc=(x, 0.68, 0.075), material=vrm_m, bevel=0.01))
        parts.append(box(f"VRMb{i}", (0.14, 0.14, 0.09), loc=(x, -0.68, 0.075), material=vrm_m, bevel=0.01))
    for i in range(24):
        x = -1.0 + (i % 12) * 0.17
        y = 0.52 if i < 12 else -0.52
        if abs(x) < 0.68:
            continue
        parts.append(cylinder(f"Cap{i}", 0.035, 0.08, loc=(x, y, 0.07), material=cap_m, verts=12))
    # Mezzanine connectors (gold)
    for sx in (-1.0, 1.0):
        parts.append(box(f"Mezz{sx}", (0.16, 0.9, 0.08), loc=(sx, 0, 0.07), material=vrm_m, bevel=0.01))
        for i in range(16):
            parts.append(box(f"MezzPin{sx}{i}", (0.1, 0.02, 0.01), loc=(sx, -0.4 + i * 0.053, 0.115), material=gold))
    # Mounting screws
    for sx in (-1.1, 1.1):
        for sy in (-0.7, 0.7):
            parts.append(cylinder(f"Screw{sx}{sy}", 0.05, 0.05, loc=(sx, sy, 0.05), material=screw, verts=16))

    for o in parts:
        apply_all(o)
        smooth(o, 35)
    print("  dc tris:", sum(tri_count(o) for o in parts))
    return parts


# --------------------------------------------------------------------------
# 4. Milestone gate
# --------------------------------------------------------------------------

def tapered_prism(name, base, top, height, loc, material, sides=6, twist=0.0):
    bm = bmesh.new()
    bot = [bm.verts.new((base * math.cos(2 * math.pi * i / sides + math.pi / sides),
                          base * math.sin(2 * math.pi * i / sides + math.pi / sides), 0)) for i in range(sides)]
    tp = [bm.verts.new((top * math.cos(2 * math.pi * i / sides + math.pi / sides + twist),
                         top * math.sin(2 * math.pi * i / sides + math.pi / sides + twist), height))
          for i in range(sides)]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(tp)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new((bot[i], bot[j], tp[j], tp[i]))
    ob = mesh_obj(name, bm, material)
    ob.location = loc
    bev = ob.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.06
    bev.segments = 2
    bev.limit_method = "ANGLE"
    return ob


def build_gate():
    """Arch spans a 20 m-wide opening, 13 m tall. Origin at road level, centred.
    Z-up in Blender → Y-up in glTF. Opening runs along X (glTF Z after export)."""
    frame = mat("Gate Frame", (0.07, 0.075, 0.085), metallic=0.9, roughness=0.3)
    trim = mat("Gate Trim", (0.55, 0.57, 0.6), metallic=1.0, roughness=0.25)
    glow = mat("Gate Glow", NV_GREEN, emission=NV_GREEN, strength=14.0)
    parts = []
    half = 11.0
    for s in (-1, 1):
        y = s * half
        parts.append(box(f"Plinth{s}", (3.2, 3.2, 1.0), loc=(0, y, 0.5), material=frame, bevel=0.15))
        parts.append(box(f"PlinthTrim{s}", (3.4, 3.4, 0.12), loc=(0, y, 1.02), material=trim, bevel=0.04))
        parts.append(tapered_prism(f"Pillar{s}", 1.25, 0.8, 12.5, (0, y, 1.0), frame, sides=6))
        # vertical light strips on the inner face
        parts.append(box(f"Strip{s}", (0.18, 0.12, 10.5), loc=(0, y - s * 0.95, 6.5), material=glow,
                         rot=(math.radians(s * 2.0), 0, 0)))
        for k in range(5):
            parts.append(box(f"Rib{s}{k}", (1.9, 1.9, 0.12), loc=(0, y, 3.0 + k * 2.0), material=trim, bevel=0.03))
    # Lintel — angular beam with a chevron profile
    parts.append(box("Lintel", (2.2, half * 2 + 3.0, 1.4), loc=(0, 0, 13.6), material=frame, bevel=0.2, segments=3))
    parts.append(box("LintelTrim", (2.4, half * 2 + 3.4, 0.14), loc=(0, 0, 12.85), material=trim, bevel=0.04))
    parts.append(box("LintelGlow", (0.12, half * 2 + 1.0, 0.16), loc=(-1.12, 0, 13.6), material=glow))
    parts.append(box("LintelGlowB", (0.12, half * 2 + 1.0, 0.16), loc=(1.12, 0, 13.6), material=glow))
    # Crown chevron
    for s in (-1, 1):
        parts.append(box(f"Chevron{s}", (0.5, 4.0, 0.4), loc=(0, s * 1.8, 14.7), material=glow,
                         rot=(math.radians(-s * 22), 0, 0)))
    for o in parts:
        apply_all(o)
        smooth(o, 30)
    print("  gate tris:", sum(tri_count(o) for o in parts))
    return parts


# --------------------------------------------------------------------------
# 5. Server rack (AI-era set dressing)
# --------------------------------------------------------------------------

def build_server_rack():
    body = mat("Rack Body", (0.045, 0.048, 0.055), metallic=0.85, roughness=0.35)
    face = mat("Rack Face", (0.09, 0.095, 0.105), metallic=0.8, roughness=0.4)
    led = mat("Rack LED", NV_GREEN, emission=NV_GREEN, strength=16.0)
    led2 = mat("Rack LED White", (0.8, 0.95, 1.0), emission=(0.8, 0.95, 1.0), strength=8.0)
    W, D, H = 1.2, 2.0, 4.2
    parts = [box("Rack", (W, D, H), loc=(0, 0, H / 2), material=body, bevel=0.04)]
    trays = 14
    for i in range(trays):
        z = 0.35 + i * (H - 0.6) / trays
        parts.append(box(f"Tray{i}", (0.06, D * 0.9, 0.2), loc=(-W / 2 - 0.02, 0, z), material=face, bevel=0.01))
        parts.append(box(f"Led{i}", (0.03, D * 0.6, 0.025), loc=(-W / 2 - 0.06, -0.1, z + 0.04),
                         material=led if i % 3 else led2))
        for k in range(4):
            parts.append(box(f"Dot{i}{k}", (0.03, 0.04, 0.04), loc=(-W / 2 - 0.06, D * 0.36 + k * 0.06, z - 0.03),
                             material=led))
    parts.append(box("TopGlow", (W * 1.02, D * 1.02, 0.05), loc=(0, 0, H + 0.02), material=led))
    for o in parts:
        apply_all(o)
    print("  rack tris:", sum(tri_count(o) for o in parts))
    return parts


# --------------------------------------------------------------------------
# 6. Summit spire (finish line)
# --------------------------------------------------------------------------

def build_summit_spire():
    frame = mat("Spire Body", (0.07, 0.075, 0.085), metallic=0.9, roughness=0.25)
    chrome = mat("Spire Chrome", (0.85, 0.87, 0.9), metallic=1.0, roughness=0.08)
    glow = mat("Gate Glow", NV_GREEN, emission=NV_GREEN, strength=14.0)
    parts = [
        tapered_prism("SpireBase", 5.0, 3.4, 3.0, (0, 0, 0), frame, sides=8),
        tapered_prism("SpireMid", 2.6, 0.9, 26.0, (0, 0, 3.0), frame, sides=8, twist=math.radians(22.5)),
        tapered_prism("SpireTip", 0.9, 0.02, 8.0, (0, 0, 29.0), chrome, sides=8),
    ]
    for k, z in enumerate((8.0, 15.0, 21.0, 26.5)):
        R = 4.2 - k * 0.8
        parts.append(torus(f"Halo{k}", R, 0.12, loc=(0, 0, z), material=glow, rot=(math.radians(8 * (k % 2 * 2 - 1)), 0, 0)))
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 8
        parts.append(box(f"Rib{i}", (0.16, 0.16, 24), loc=(math.cos(a) * 1.85, math.sin(a) * 1.85, 15.0), material=glow,
                         rot=(-math.sin(a) * math.radians(3.6), math.cos(a) * math.radians(3.6), 0)))
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.1)
    orb = mesh_obj("Beacon", bm, mat("Beacon", (0.9, 1.0, 0.7), emission=(0.75, 1.0, 0.3), strength=30.0))
    orb.location = (0, 0, 38.5)
    smooth(orb)
    parts.append(orb)
    for o in parts:
        apply_all(o)
    print("  spire tris:", sum(tri_count(o) for o in parts))
    return parts


# --------------------------------------------------------------------------
# Showcase render
# --------------------------------------------------------------------------

def render_showcase(groups):
    """Hero shot of every asset, auto-framed, composited into a 3x2 contact sheet."""
    import numpy as np

    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("Showcase")
    scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    outn = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tex.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], outn.inputs[0])
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = (0.004, 0.006, 0.008, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (0.20, 0.24, 0.26, 1)
    bg.inputs["Strength"].default_value = 0.9

    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else engines[0]
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.film_transparent = False
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Punchy"
    except Exception:
        pass

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 50
    cam = bpy.data.objects.new("Cam", cam_d)
    link(cam)
    scene.camera = cam

    def light(name, kind, color):
        ld = bpy.data.lights.new(name, kind)
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        link(lo)
        return lo

    key = light("Key", "AREA", (1, 0.96, 0.9))
    rim = light("Rim", "AREA", (0.55, 1.0, 0.25))
    fill = light("Fill", "AREA", (0.55, 0.7, 1.0))
    floor = box("Floor", (1, 1, 1), material=mat("Floor", (0.015, 0.017, 0.02), metallic=0.7, roughness=0.18))

    # (asset, view direction from target to camera, extra yaw)
    shots = [
        ("player_core", Vector((-0.6, -1.0, 0.45)), 0.0),
        ("gpu_card", Vector((0.55, -1.0, 0.35)), 0.0),
        ("dc_module", Vector((0.35, -0.8, 1.0)), 0.0),
        ("gate", Vector((1.0, -0.75, 0.32)), 0.0),
        ("server_rack", Vector((-1.0, -0.8, 0.35)), 0.0),
        ("summit_spire", Vector((0.4, -1.0, 0.18)), 0.0),
    ]
    tiles = []
    for name, d, _ in shots:
        for k, objs in groups.items():
            for o in objs:
                o.hide_render = (k != name)
        objs = groups[name]
        pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        centre = (lo + hi) / 2
        r = (hi - lo).length / 2
        d = d.normalized()
        fov = 2 * math.atan(18 / cam_d.lens)  # vertical-ish fov for 36mm sensor
        dist = r / math.sin(fov / 2) * 0.95
        cam.location = centre + d * dist
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam_d.clip_end = dist * 10
        floor.location = (centre.x, centre.y, lo.z - 0.002)
        floor.scale = (r * 30, r * 30, 0.001)
        right = d.cross(Vector((0, 0, 1))).normalized()
        for lobj, pos, energy, size in (
            (key, centre + (d + right * 0.9 + Vector((0, 0, 1.2))).normalized() * r * 4, 900, 1.6),
            (rim, centre + (-d - right * 0.6 + Vector((0, 0, 0.9))).normalized() * r * 4, 1100, 1.2),
            (fill, centre + (d - right * 1.4 + Vector((0, 0, 0.1))).normalized() * r * 4, 260, 2.0),
        ):
            lobj.location = pos
            lobj.rotation_euler = (centre - pos).to_track_quat("-Z", "Y").to_euler()
            lobj.data.energy = energy * r * r
            lobj.data.size = size * r
        path = os.path.join(DOCS, f"asset_{name}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(path)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
        tiles.append(px)
        print("[render]", path)

    h, w = tiles[0].shape[:2]
    sheet = np.zeros((h * 2, w * 3, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        row, col = divmod(i, 3)
        # Blender images are bottom-up: first row goes to the top half
        sheet[(1 - row) * h:(2 - row) * h, col * w:(col + 1) * w] = t
    out = bpy.data.images.new("sheet", w * 3, h * 2, alpha=True)
    out.pixels = sheet.ravel()
    out.filepath_raw = os.path.join(DOCS, "assets_showcase.png")
    out.file_format = "PNG"
    out.save()
    print("[render] docs/assets_showcase.png")


# --------------------------------------------------------------------------

def main():
    reset_scene()
    groups = {}
    builders = [
        ("player_core", build_player_core),
        ("gpu_card", build_gpu_card),
        ("dc_module", build_dc_module),
        ("gate", build_gate),
        ("server_rack", build_server_rack),
        ("summit_spire", build_summit_spire),
    ]
    for key, fn in builders:
        print(f"[build] {key}")
        # Each asset is built in isolation at the origin, exported, then hidden
        before = set(bpy.data.objects)
        objs = fn()
        objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
        merged = join(objs, key)  # one mesh, one primitive per material -> few draw calls
        export([merged], f"{key}.glb")
        groups[key] = [merged]

    if "--no-render" not in sys.argv:
        render_showcase(groups)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "nvda_ascent_assets.blend"))
    print("[done]")


main()
