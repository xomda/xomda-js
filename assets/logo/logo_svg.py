"""Export the app logo as a clean, scalable SVG.

Reads the same parameters as blender_logo.py from logo_params.py so the
SVG and the 3D render stay in sync. Pure Python — no Blender required.

Run:  python3 logo_svg.py            -> writes logo.svg next to this file
      python3 logo_svg.py out.svg    -> writes to a custom path
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from logo_params import (
    BASE_SIZE,
    BRACKET_HALF_H, BRACKET_APEX_X, BRACKET_TIP_X,
    BRACKET_THICK, BRACKET_CORNER_R,
    DIAMOND_SIZE,
    BRACKET_L_COLOR, BRACKET_R_COLOR,
    DIAMOND_HOT, DIAMOND_MID, DIAMOND_EDGE,
    RES,
)


def _srgb_byte(c: float) -> int:
    """Clamp a 0..1 linear-ish channel to a 0..255 sRGB byte.

    The Blender script feeds these same triples to a Principled BSDF that
    re-interprets them as sRGB on display, so for the SVG we round-trip
    the value as-is — the on-screen appearance ends up matching."""
    return max(0, min(255, int(round(c * 255))))


def rgb(c: tuple[float, float, float]) -> str:
    r, g, b = c
    return f"rgb({_srgb_byte(r)},{_srgb_byte(g)},{_srgb_byte(b)})"


def fmt(v: float) -> str:
    """Trim trailing zeros so the SVG stays readable."""
    return f"{v:.4f}".rstrip("0").rstrip(".")


def build_svg() -> str:
    h = BASE_SIZE / 2
    stroke_w = BRACKET_THICK * 2     # tube radius -> SVG stroke width
    d = DIAMOND_SIZE
    r_corner = BRACKET_CORNER_R

    # The viewBox uses world coordinates (Y up). SVG's native Y points down,
    # so all content is wrapped in a `scale(1 -1)` flip. The background is
    # transparent — no rect is emitted.

    lines: list[str] = []
    lines.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{RES}" height="{RES}" '
        f'viewBox="{fmt(-h)} {fmt(-h)} {fmt(BASE_SIZE)} {fmt(BASE_SIZE)}" '
        f'shape-rendering="geometricPrecision">'
    )

    lines.append("<defs>")
    lines.append(
        '<radialGradient id="diamondGrad" cx="50%" cy="50%" r="55%">'
        f'<stop offset="0%" stop-color="{rgb(DIAMOND_HOT)}"/>'
        f'<stop offset="55%" stop-color="{rgb(DIAMOND_MID)}"/>'
        f'<stop offset="100%" stop-color="{rgb(DIAMOND_EDGE)}"/>'
        '</radialGradient>'
    )
    # Soft halo around the diamond — proxy for the Blender bloom pass.
    lines.append(
        '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">'
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.025" result="blur"/>'
        '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
        '</filter>'
    )
    lines.append("</defs>")

    # ----- foreground (Y-up via flip group) -----
    lines.append('<g transform="scale(1 -1)">')

    def chevron(tip_x: float, apex_x: float, color: tuple[float, float, float]) -> str:
        # Split the apex into two near-apex points r_corner units back
        # along the arms, then connect them with a quadratic curve whose
        # control point is the original apex. The result is a smooth
        # rounded corner; the rest of the path is straight.
        arm_len = math.hypot(apex_x - tip_x, BRACKET_HALF_H)
        ux = (tip_x - apex_x) / arm_len
        uy_top = BRACKET_HALF_H / arm_len
        a_top = (apex_x + r_corner * ux,  r_corner * uy_top)
        a_bot = (apex_x + r_corner * ux, -r_corner * uy_top)
        return (
            f'<path d="M {fmt(tip_x)} {fmt(BRACKET_HALF_H)} '
            f'L {fmt(a_top[0])} {fmt(a_top[1])} '
            f'Q {fmt(apex_x)} 0 {fmt(a_bot[0])} {fmt(a_bot[1])} '
            f'L {fmt(tip_x)} {fmt(-BRACKET_HALF_H)}" '
            f'fill="none" stroke="{rgb(color)}" '
            f'stroke-width="{fmt(stroke_w)}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
        )

    # Left bracket  <   (apex at far left, arm tips closer to center)
    lines.append(chevron(-BRACKET_TIP_X, -BRACKET_APEX_X, BRACKET_L_COLOR))
    # Right bracket  >  (apex at far right, arm tips closer to center)
    lines.append(chevron(BRACKET_TIP_X, BRACKET_APEX_X, BRACKET_R_COLOR))

    # Center diamond — square rotated 45°, vertices on the axes.
    lines.append(
        f'<polygon points="0,{fmt(d)} {fmt(d)},0 0,{fmt(-d)} {fmt(-d)},0" '
        f'fill="url(#diamondGrad)" filter="url(#glow)"/>'
    )

    lines.append('</g>')
    lines.append('</svg>')
    return "\n".join(lines) + "\n"


def main() -> None:
    out_arg = sys.argv[1] if len(sys.argv) > 1 else None
    out_path = Path(out_arg) if out_arg else Path(__file__).resolve().parent / "logo.svg"
    out_path.write_text(build_svg())
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
