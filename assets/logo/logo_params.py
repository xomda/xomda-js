"""Shared logo parameters.

Single source of truth for the logo's geometry and colors. Both
blender_logo.py (3D render) and logo_svg.py (vector export) import from
here so the two outputs stay in sync.

Coordinates use math convention (Y up). The canvas spans
[-BASE_SIZE/2, +BASE_SIZE/2] in both X and Y. The logo is drawn on a
transparent background; BASE_SIZE only defines the viewBox / camera frame.
Colors are linear sRGB 0..1 triples — both consumers convert as needed.
"""

# --- canvas ---------------------------------------------------------------

BASE_SIZE        = 2.0     # canvas extent (viewBox / camera frame)

# --- brackets -------------------------------------------------------------
#
# The bracket arms are at 45° so they sit parallel to the diamond's edges.
# That requires |APEX_X - TIP_X| == HALF_H. Keep this invariant if you tune
# the proportions.

BRACKET_HALF_H   = 0.55    # vertical reach of each arm from center
BRACKET_APEX_X   = 0.65    # apex distance from center (outer point of < or >)
BRACKET_TIP_X    = 0.10    # arm-tip distance from center (near the diamond)
BRACKET_THICK    = 0.09    # tube radius (Blender) / half stroke-width (SVG)
BRACKET_CORNER_R = 0.10    # rounding radius at the apex (centerline arc)

# --- diamond --------------------------------------------------------------

DIAMOND_SIZE     = 0.30    # half-diagonal of the center diamond

# --- colors (linear sRGB 0..1) -------------------------------------------

BRACKET_L_COLOR  = (0.330, 0.330, 0.880)   # blue-violet
BRACKET_R_COLOR  = (0.620, 0.290, 0.780)   # magenta-violet
DIAMOND_HOT      = (0.900, 0.820, 1.000)   # near-white lavender center
DIAMOND_MID      = (0.550, 0.420, 0.920)   # midpoint between hot and edge
DIAMOND_EDGE     = (0.300, 0.150, 0.600)   # deep purple edge

# --- output ---------------------------------------------------------------

RES = 1024                 # pixel size for both PNG and SVG raster previews
