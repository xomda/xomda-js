import { type Ref, ref, watch } from 'vue'

import type { Layout, LayoutEntry } from '../types'

export const GRID_SIZE = 24

/**
 * Snap a value to the world grid.
 *
 * `worldOffset` is the offset of the value's coord space origin from the
 * world grid origin (e.g. for a child of a package, the parent's content
 * area starts at `CONTENT_PADDING` inside the parent's outer box, so a
 * child's local x=0 sits at world_x=parent_world_x+16 — off the grid by
 * 16px). Passing that offset makes the snap target real grid lines in
 * world space instead of local-grid lines.
 *
 * Always returns a value >= 0. If the natural snap target would be
 * negative (only possible when `worldOffset > 0`), bumps up by one cell.
 */
export function snap(value: number, grid = GRID_SIZE, worldOffset = 0): number {
  const snapped = Math.round((value + worldOffset) / grid) * grid - worldOffset
  // Smallest valid (>=0) snap target in this coord space. With offset=16,
  // grid=24, that's 8 — anything snapping below it gets clamped up.
  const min = (grid - (((worldOffset % grid) + grid) % grid)) % grid
  return snapped < min ? min : snapped
}

/**
 * Snap every entry's `x`, `y`, `width`, `height` to a `GRID_SIZE` multiple.
 *
 * Used to normalise persisted layout data on load (or before save) so a
 * model authored on an older version — when padding was 16px and snapped
 * positions weren't grid multiples — can't carry sub-grid values through
 * to the canvas. Dimensions use `Math.ceil` so content never gets clipped;
 * positions use `snap` (round to nearest). Entries without a width/height
 * keep them undefined.
 */
export function normalizeLayoutToGrid(layout: Layout): Layout {
  const ceilToGrid = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE
  const out: Layout = {}
  for (const [id, entry] of Object.entries(layout)) {
    const next: LayoutEntry = {
      x: snap(Math.max(0, entry.x ?? 0)),
      y: snap(Math.max(0, entry.y ?? 0)),
    }
    if (entry.width != null) next.width = ceilToGrid(Math.max(GRID_SIZE * 4, entry.width))
    if (entry.height != null) next.height = ceilToGrid(Math.max(GRID_SIZE * 4, entry.height))
    out[id] = next
  }
  return out
}

export function useCanvasLayout(initialLayout: Ref<Layout>) {
  const layout = ref<Layout>({ ...initialLayout.value })

  watch(initialLayout, (val) => {
    layout.value = { ...val }
  })

  function get(id: string): LayoutEntry {
    return layout.value[id] ?? { x: 0, y: 0 }
  }

  function setPosition(id: string, x: number, y: number): void {
    const existing = layout.value[id] ?? {}
    layout.value = {
      ...layout.value,
      [id]: { ...existing, x: snap(Math.max(0, x)), y: snap(Math.max(0, y)) },
    }
  }

  function setSize(id: string, width: number, height: number): void {
    const existing = layout.value[id] ?? { x: 0, y: 0 }
    layout.value = {
      ...layout.value,
      [id]: {
        ...existing,
        width: snap(Math.max(GRID_SIZE * 4, width)),
        height: snap(Math.max(GRID_SIZE * 4, height)),
      },
    }
  }

  return { layout, get, setPosition, setSize }
}

export type UseCanvasLayoutReturn = ReturnType<typeof useCanvasLayout>
