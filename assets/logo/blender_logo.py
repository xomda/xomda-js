"""Build the app-logo scene in Blender, save logo.blend, and render logo.png.

All three outputs land next to this file:
  - logo.blend   (the assembled scene, openable in Blender's UI for inspection)
  - logo.png     (the headless render)

Run headless:   blender -b -P blender_logo.py
Run in Blender: open Scripting tab -> Open -> blender_logo.py -> Run Script
Or:             ./render.sh

logo_params.py is the source of truth — re-running this script rebuilds
logo.blend from those parameters, so don't hand-edit the .blend expecting
the changes to survive a re-run.

Tested on Blender 4.x (Eevee Next). Falls back to legacy Eevee on older builds.
"""

import math
import os
import sys
from pathlib import Path

import bpy

# The script's own directory is on sys.path when run with `blender -P`,
# so a sibling module import works from both headless and GUI runs.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from logo_params import (
    BASE_SIZE,
    BRACKET_HALF_H, BRACKET_APEX_X, BRACKET_TIP_X,
    BRACKET_THICK, BRACKET_CORNER_R,
    DIAMOND_SIZE,
    BRACKET_L_COLOR, BRACKET_R_COLOR,
    DIAMOND_HOT, DIAMOND_MID, DIAMOND_EDGE,
    RES,
)

_HERE = Path(__file__).resolve().parent
OUTPUT_PATH = str(_HERE / "logo.png")
BLEND_PATH  = str(_HERE / "logo.blend")


# ---------------------------------------------------------------------------
# Scene reset
# ---------------------------------------------------------------------------

def reset_scene() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                 bpy.data.lights, bpy.data.cameras, bpy.data.images,
                 bpy.data.node_groups):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

def _set_emission(bsdf, color, strength):
    # Blender 4.x renamed 'Emission' -> 'Emission Color'.
    for key in ("Emission Color", "Emission"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = (*color, 1.0)
            break
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = strength


def make_bracket_material(name, color) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.28
    if "Subsurface Weight" in bsdf.inputs:           # Blender 4.x
        bsdf.inputs["Subsurface Weight"].default_value = 0.15
        bsdf.inputs["Subsurface Radius"].default_value = (0.3, 0.2, 0.5)
    elif "Subsurface" in bsdf.inputs:                # Blender 3.x
        bsdf.inputs["Subsurface"].default_value = 0.15
    _set_emission(bsdf, color, 0.4)
    return mat


def make_diamond_material() -> bpy.types.Material:
    mat = bpy.data.materials.new("Diamond")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 3.0

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    elems = ramp.color_ramp.elements
    elems[0].position = 0.0
    elems[0].color = (*DIAMOND_EDGE, 1.0)
    elems[1].position = 1.0
    elems[1].color = (*DIAMOND_HOT, 1.0)
    # Insert a midpoint for a smoother core->edge falloff
    mid = ramp.color_ramp.elements.new(0.55)
    mid.color = (*DIAMOND_MID, 1.0)

    nt.links.new(tex_coord.outputs["Generated"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    for i, n in enumerate((tex_coord, grad, ramp, emit, out)):
        n.location = (-800 + i * 200, 0)
    return mat


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def make_bracket(name, side, thickness):
    """Draw a '<' (side='left') or '>' (side='right') chevron with a rounded apex.

    Four control points: the two arm tips stay sharp (vector handles) and
    the apex is split into two close points joined by a cubic bezier
    approximating a quarter-circle arc of radius BRACKET_CORNER_R.
    """
    curve = bpy.data.curves.new(name + "Curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = thickness
    curve.bevel_resolution = 12
    curve.use_fill_caps = True

    sign = -1 if side == "left" else 1
    apex_x = sign * BRACKET_APEX_X
    tip_x  = sign * BRACKET_TIP_X
    half_h = BRACKET_HALF_H
    r      = BRACKET_CORNER_R
    z = 0.0

    # Unit vectors from the apex toward the two arm tips. The arms are at
    # 45° by construction (HALF_H == APEX_X - TIP_X), so u_top and u_bot
    # are perpendicular and the apex angle is 90°.
    arm_len = math.hypot(apex_x - tip_x, half_h)
    u_top = ((tip_x - apex_x) / arm_len,  half_h / arm_len)
    u_bot = ((tip_x - apex_x) / arm_len, -half_h / arm_len)

    # The two near-apex points sit r units back along each arm.
    a_top = (apex_x + r * u_top[0], r * u_top[1])
    a_bot = (apex_x + r * u_bot[0], r * u_bot[1])

    # Cubic-bezier handle length for a quarter-circle: r * 4/3 * tan(π/8).
    h_mag = r * (4.0 / 3.0) * math.tan(math.pi / 8.0)

    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(3)   # 4 points total
    pts = spline.bezier_points

    # Top arm tip — straight segment to a_top.
    pts[0].co = (tip_x, half_h, z)
    pts[0].handle_left_type = "VECTOR"
    pts[0].handle_right_type = "VECTOR"

    # Near-apex (top side). Left handle stays VECTOR (keeps arm straight);
    # right handle pushes along the arm toward the true apex to start the arc.
    pts[1].co = (a_top[0], a_top[1], z)
    pts[1].handle_left_type = "VECTOR"
    pts[1].handle_right_type = "FREE"
    pts[1].handle_right = (
        a_top[0] - h_mag * u_top[0],
        a_top[1] - h_mag * u_top[1],
        z,
    )

    # Near-apex (bottom side). Mirror of the above.
    pts[2].co = (a_bot[0], a_bot[1], z)
    pts[2].handle_left_type = "FREE"
    pts[2].handle_right_type = "VECTOR"
    pts[2].handle_left = (
        a_bot[0] - h_mag * u_bot[0],
        a_bot[1] - h_mag * u_bot[1],
        z,
    )

    # Bottom arm tip — straight segment from a_bot.
    pts[3].co = (tip_x, -half_h, z)
    pts[3].handle_left_type = "VECTOR"
    pts[3].handle_right_type = "VECTOR"

    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return obj


def make_diamond(name, half_diag):
    mesh = bpy.data.meshes.new(name + "Mesh")
    z = 0.0
    verts = [
        ( 0,            half_diag,  z),
        ( half_diag,    0,          z),
        ( 0,           -half_diag,  z),
        (-half_diag,    0,          z),
    ]
    faces = [(0, 1, 2, 3)]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    # Slight depth + bevel for a softer edge
    solidify = obj.modifiers.new("Solidify", "SOLIDIFY")
    solidify.thickness = 0.06
    solidify.offset = 0
    bevel = obj.modifiers.new("Bevel", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 4
    return obj


# ---------------------------------------------------------------------------
# Camera, light, world
# ---------------------------------------------------------------------------

def setup_camera():
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = BASE_SIZE * 1.02
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0, 0, 5)
    cam.rotation_euler = (0, 0, 0)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam


def setup_lights():
    key_data = bpy.data.lights.new("Key", "AREA")
    key_data.energy = 80
    key_data.size = 3.0
    key_data.color = (1.0, 0.95, 1.0)
    key = bpy.data.objects.new("Key", key_data)
    key.location = (-1.5, 1.8, 3.0)
    key.rotation_euler = (math.radians(-25), math.radians(-18), 0)
    bpy.context.collection.objects.link(key)

    fill_data = bpy.data.lights.new("Fill", "AREA")
    fill_data.energy = 30
    fill_data.size = 4.0
    fill_data.color = (0.75, 0.7, 1.0)
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.location = (2.0, -1.5, 2.5)
    fill.rotation_euler = (math.radians(28), math.radians(20), 0)
    bpy.context.collection.objects.link(fill)


def setup_world():
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0, 0, 0, 1)
        bg.inputs["Strength"].default_value = 0.0


# ---------------------------------------------------------------------------
# Compositor: subtle bloom via Glare node (Eevee Next removed built-in bloom)
# ---------------------------------------------------------------------------

def setup_compositor_bloom():
    """Best-effort Fog-Glow bloom via the compositor. The API moves between
    Blender versions; any failure here is non-fatal — the render still
    succeeds without the extra glow."""
    try:
        _setup_compositor_bloom_inner()
    except Exception as exc:
        print(f"Compositor bloom skipped ({exc.__class__.__name__}: {exc}).")


def _setup_compositor_bloom_inner():
    scene = bpy.context.scene
    nt = None
    try:
        scene.use_nodes = True
        nt = getattr(scene, "node_tree", None)
    except Exception:
        nt = None

    if nt is None:
        ng = bpy.data.node_groups.new("CompositorNodes", "CompositorNodeTree")
        if hasattr(scene, "compositing_node_group"):
            scene.compositing_node_group = ng
        nt = ng

    nt.nodes.clear()
    rlayers = nt.nodes.new("CompositorNodeRLayers")
    glare = nt.nodes.new("CompositorNodeGlare")
    # Attribute names drift across Blender versions; set defensively.
    for attr, value in (
        ("glare_type", "FOG_GLOW"),
        ("type", "FOG_GLOW"),
        ("quality", "HIGH"),
        ("size", 7),
        ("threshold", 0.6),
        ("mix", 0.0),
    ):
        if hasattr(glare, attr):
            try:
                setattr(glare, attr, value)
            except Exception:
                pass
    # Output node name changed in Blender 5.x; try both.
    composite = None
    for node_id in ("CompositorNodeComposite", "CompositorNodeOutputFile"):
        try:
            composite = nt.nodes.new(node_id)
            break
        except Exception:
            continue

    nt.links.new(rlayers.outputs["Image"], glare.inputs["Image"])
    if composite is not None:
        nt.links.new(glare.outputs["Image"], composite.inputs["Image"])
        for i, n in enumerate((rlayers, glare, composite)):
            n.location = (i * 250, 0)


# ---------------------------------------------------------------------------
# Render settings
# ---------------------------------------------------------------------------

def configure_render():
    scene = bpy.context.scene
    # Prefer Eevee Next (Blender 4.2+); fall back to legacy Eevee.
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue

    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True   # transparent PNG; the logo is the only content
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = OUTPUT_PATH

    # Color management: Filmic crushes the deep navy a bit; Standard reads closer
    # to the reference for a flat logo look.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    # Eevee quality knobs (names differ slightly across versions; guard each).
    eevee = scene.eevee
    for attr, value in (
        ("taa_render_samples", 64),
        ("use_gtao", True),
        ("use_ssr", True),
        ("use_bloom", True),       # legacy Eevee only; ignored on Eevee Next
        ("bloom_intensity", 0.15),
    ):
        if hasattr(eevee, attr):
            try:
                setattr(eevee, attr, value)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build():
    reset_scene()

    bracket_l = make_bracket("BracketLeft", "left", BRACKET_THICK)
    bracket_l.data.materials.append(
        make_bracket_material("BracketLeftMat", BRACKET_L_COLOR)
    )
    bracket_r = make_bracket("BracketRight", "right", BRACKET_THICK)
    bracket_r.data.materials.append(
        make_bracket_material("BracketRightMat", BRACKET_R_COLOR)
    )

    diamond = make_diamond("Diamond", DIAMOND_SIZE)
    diamond.data.materials.append(make_diamond_material())

    setup_camera()
    setup_lights()
    setup_world()
    setup_compositor_bloom()
    configure_render()

    # Save the .blend alongside the script so it can be opened in Blender's
    # UI for inspection. The parametric .py remains the source of truth —
    # re-running this script overwrites the .blend.
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, check_existing=False)


def main():
    build()
    if "--no-render" in sys.argv:
        print("Scene built; skipping render (--no-render).")
        return
    print(f"Rendering to {OUTPUT_PATH} ...")
    bpy.ops.render.render(write_still=True)
    print("Done.")


if __name__ == "__main__":
    main()
