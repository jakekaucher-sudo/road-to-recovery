"""Build a game-ready LA fire hydrant in Blender 5.x (headless).
Course habits: metric units, lathe (spin) for the body, quads only, apply scale,
small bevels, Smooth by Angle, origin at the base, glb export, tri count check."""
import bpy, bmesh, math, os, sys

out_dir = sys.argv[sys.argv.index("--") + 1]
os.makedirs(out_dir, exist_ok=True)

# ---- clean scene, metric
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = "METRIC"; sc.unit_settings.scale_length = 1.0

SEG = 16  # radial segments: enough for a round silhouette at street distance

def lathe(name, profile, seg=SEG, cap_top=True, cap_bottom=True):
    """Revolve an (r, z) profile around Z. profile runs bottom -> top."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    if cap_bottom:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top:
        bm.faces.new(rings[-1])
    # caps are ngons: split them into quads via a centre vertex (poke)
    caps = [f for f in bm.faces if len(f.verts) > 4]
    bmesh.ops.poke(bm, faces=caps)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    return ob

# ---- body: base flange, barrel with a ring, bonnet, finial (all in metres)
body = lathe("Hydrant_Body", [
    (0.19, 0.00), (0.19, 0.03), (0.16, 0.05),       # base flange
    (0.12, 0.05), (0.12, 0.42),                      # lower barrel
    (0.14, 0.42), (0.14, 0.47), (0.12, 0.47),        # mid ring
    (0.12, 0.72), (0.15, 0.74), (0.15, 0.78),        # bonnet flange
    (0.12, 0.80), (0.09, 0.86), (0.05, 0.90),        # bonnet dome
    (0.05, 0.92), (0.045, 0.98), (0.03, 1.00),       # finial stem / cap
], cap_bottom=False)   # bottom face never seen: deleted

# ---- side nozzles (two small, one big front) built from cylinders along their axis
def nozzle(name, radius, length, z, yaw_deg, cap_r):
    bm = bmesh.new()
    prof = [(radius, 0.0), (radius, length - 0.04), (cap_r, length - 0.04), (cap_r, length), (cap_r * 0.7, length)]
    rings = []
    for r, x in prof:
        rings.append([bm.verts.new((x, r * math.cos(2 * math.pi * i / SEG), r * math.sin(2 * math.pi * i / SEG))) for i in range(SEG)])
    for a, b in zip(rings, rings[1:]):
        for i in range(SEG):
            bm.faces.new((a[i], b[i], b[(i + 1) % SEG], a[(i + 1) % SEG]))
    end = bm.faces.new(rings[-1]); bmesh.ops.poke(bm, faces=[end])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    ob.location = (0.10, 0, z); ob.rotation_euler = (0, 0, math.radians(yaw_deg))
    # rotate about the hydrant axis, not the nozzle's own origin
    ob.location = (0.10 * math.cos(math.radians(yaw_deg)), 0.10 * math.sin(math.radians(yaw_deg)), z)
    return ob

parts = [body,
         nozzle("Nozzle_L", 0.045, 0.10, 0.55, 90, 0.06),
         nozzle("Nozzle_R", 0.045, 0.10, 0.55, -90, 0.06),
         nozzle("Nozzle_Front", 0.06, 0.11, 0.50, 0, 0.075)]

# ---- bonnet bolt nut (pentagon operating nut, like a real US hydrant)
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.035, radius2=0.035, depth=0.05)
bmesh.ops.poke(bm, faces=[f for f in bm.faces if len(f.verts) > 4])  # pentagon caps -> tris, no ngons
me = bpy.data.meshes.new("Nut"); bm.to_mesh(me); bm.free()
nut = bpy.data.objects.new("Nut", me); sc.collection.objects.link(nut); nut.location = (0, 0, 1.025)
parts.append(nut)

# ---- join (body active so the name and origin win), apply transforms
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
hyd = bpy.context.active_object
hyd.name = "FireHydrant_LA"; hyd.data.name = "FireHydrant_LA"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# origin at base centre (it already is: profile starts at z=0, x=y=0) -> set explicitly anyway
sc.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# merge by distance, recalc normals, in edit mode
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

# ---- shading: smooth by angle (4.1+ replacement for Auto Smooth) + tiny bevel
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
bev = hyd.modifiers.new("Bevel", "BEVEL")
bev.width = 0.006; bev.segments = 1; bev.limit_method = "ANGLE"; bev.angle_limit = math.radians(40)
bev.harden_normals = True; bev.use_clamp_overlap = True
# bevel must come before the smooth-by-angle modifier in the stack
bpy.ops.object.modifier_move_to_index(modifier="Bevel", index=0)

# ---- material: LA hydrant yellow-ish safety red? Downtown LA hydrants are mostly red/yellow; use red body
mat = bpy.data.materials.new("Hydrant_Red"); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.70, 0.08, 0.05, 1); b.inputs["Roughness"].default_value = 0.45
hyd.data.materials.append(mat)

# ---- UVs: simple smart project so the glb is textureable
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
bpy.ops.object.mode_set(mode="OBJECT")

# ---- stats (with modifiers)
dg = bpy.context.evaluated_depsgraph_get(); ev = hyd.evaluated_get(dg); m = ev.to_mesh()
tris = sum(len(p.vertices) - 2 for p in m.polygons)
ngons = sum(1 for p in hyd.data.polygons if len(p.vertices) > 4)
dims = tuple(round(d, 3) for d in hyd.dimensions)

# ---- export glb for three.js
glb = os.path.join(out_dir, "fire_hydrant_la.glb")
bpy.ops.object.select_all(action="DESELECT"); hyd.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, use_selection=True, export_apply=True, export_yup=True, export_format="GLB")

# ---- render: ground, sun, camera 3/4 low, plus a 2 m "door" slab for scale
bpy.ops.mesh.primitive_plane_add(size=6); ground = bpy.context.active_object; ground.name = "Ground"
gm = bpy.data.materials.new("Ground"); gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.35, 0.36, 1)
ground.data.materials.append(gm)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.9, 0.6, 1.0)); door = bpy.context.active_object
door.scale = (0.05, 0.9, 1.0); door.name = "ScaleRef_Door_2m"
dm = bpy.data.materials.new("Door"); dm.use_nodes = True
dm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.6, 0.6, 0.6, 1); door.data.materials.append(dm)
bpy.ops.object.light_add(type="SUN", location=(2, -2, 4)); sun = bpy.context.active_object
sun.rotation_euler = (math.radians(50), 0, math.radians(35)); sun.data.energy = 4
world = bpy.data.worlds.new("W"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.6, 0.7, 0.85, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
bpy.ops.object.camera_add(location=(2.2, -2.4, 1.1)); cam = bpy.context.active_object
cam.rotation_euler = (math.radians(78), 0, math.radians(42)); cam.data.lens = 45; sc.camera = cam
sc.render.engine = "BLENDER_EEVEE" if hasattr(bpy.types, "SCENE_OT_render") else "BLENDER_EEVEE"
try: sc.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError: sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 1280; sc.render.resolution_y = 900
sc.render.filepath = os.path.join(out_dir, "fire_hydrant_render.png")
bpy.ops.render.render(write_still=True)

# wireframe shot: viewport-style via freestyle-free trick = render with wire modifier copy
wire = hyd.copy(); wire.data = hyd.data.copy(); sc.collection.objects.link(wire); wire.name = "wire"
wm = wire.modifiers.new("Wire", "WIREFRAME"); wm.thickness = 0.002; wm.use_replace = True
wmat = bpy.data.materials.new("Wire"); wmat.use_nodes = True
wmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0, 0, 0, 1); wire.data.materials.clear(); wire.data.materials.append(wmat)
hyd.hide_render = True; door.hide_render = True
sc.render.filepath = os.path.join(out_dir, "fire_hydrant_wire.png"); bpy.ops.render.render(write_still=True)
hyd.hide_render = False; bpy.data.objects.remove(wire)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "fire_hydrant_la.blend"))
print("RESULT", {"tris": tris, "verts": len(hyd.data.vertices), "ngons": ngons, "dims_m": dims, "glb_kb": round(os.path.getsize(glb) / 1024, 1)})
