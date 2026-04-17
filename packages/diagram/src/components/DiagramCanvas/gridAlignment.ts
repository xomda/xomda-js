/**
 * Painted grid cell size in screen pixels at a given zoom.
 *
 * Returns a *continuous* (un-rounded) value so the CSS
 * `background-size` glides smoothly with wheel/pinch zoom and the
 * scaled inner-element transform (which also uses raw zoom) stays
 * locked to the grid — a node at world x = N·worldPx renders at
 * screen x = N · `gridCellPx`, exactly on the Nth painted line.
 *
 * Floored to at least 1 so a tiny zoom never produces a 0-sized tile
 * (which CSS would render as a no-op, hiding the grid entirely).
 *
 * The previous implementation rounded to an integer pixel size to
 * avoid sub-pixel tile-edge shimmer, but that snapped the rendered
 * scale to ~4% steps and made wheel zoom feel like a bad frame rate.
 * Shimmer is the lesser evil.
 */
export function gridCellPx(zoom: number, worldPx: number): number {
  return Math.max(1, zoom * worldPx)
}
