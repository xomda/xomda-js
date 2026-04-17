/**
 * Round the world-space grid step to an integer pixel size for the
 * current zoom. Keeping the CSS `background-size` whole-pixel
 * eliminates the per-tile subpixel drift the browser otherwise
 * introduces, and gives nodes (drawn inside a `transform: scale(cell /
 * worldPx)` container) the same pixel grid to land on.
 *
 * Floored to at least 1 so a tiny zoom never produces a 0-sized tile
 * (which CSS would render as a no-op, hiding the grid entirely).
 */
export function gridCellPx(zoom: number, worldPx: number): number {
  return Math.max(1, Math.round(worldPx * zoom))
}
