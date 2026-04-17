import type { Layout, PackageData } from '@xomda/diagram'

/**
 * Pure shelf-pack geometry used by ModelView's "auto-layout" command.
 *
 * Lives outside the component so the algorithm is testable in isolation
 * (no Vue, no DOM, no buffer). DOM measurement is the consumer's
 * responsibility — pass it in as `sizeOf`.
 */

export interface ShelfPackOptions {
  /** Grid module size — all coordinates and sizes round up to this. */
  grid: number
  /** Gap between sibling items inside a shelf. */
  gap: number
  /** Padding inside a package container, around its children. */
  contentPadding: number
  /** Vertical chrome on top of a package (header). */
  headerOverhead: number
  /** Fallback width when nothing has been measured for an item yet. */
  defaultNodeWidth: number
  /** Fallback height when nothing has been measured for an item yet. */
  defaultNodeHeight: number
  /**
   * Aspect-ratio target the packer aims at — the derived row width is
   * `sqrt(totalArea * targetAspect)`. ~1.6 keeps the result a touch
   * wider than tall, which reads as a "normal" diagram canvas.
   */
  targetAspect?: number
}

export interface PackedItem {
  id: string
  width: number
  height: number
}

export interface PackResult {
  /** id → top-left coordinate (content-local for nested packs). */
  positions: Map<string, { x: number; y: number }>
  /** Tight bounding width of the packed content. */
  width: number
  /** Tight bounding height of the packed content. */
  height: number
}

/**
 * Size resolver. The recursive packer asks "how big is this node?";
 * the caller decides whether to look at the DOM, fall back to stored
 * dimensions, or stub for tests.
 *
 * The packer recomputes packages' sizes itself (it just packed their
 * children), so it will only ask `sizeOf` for `'entity'` / `'enum'`
 * during the recursive descent — but the call site at the top level
 * may ask for `'package'` to size things it hasn't visited.
 */
export type SizeOf = (
  id: string,
  kind: 'package' | 'entity' | 'enum'
) => {
  width: number
  height: number
}

/** Round up to a multiple of `grid`. */
export const ceilGrid = (v: number, grid: number): number => Math.ceil(v / grid) * grid

/**
 * Shelf-pack `items` into rows targeting a derived width that keeps
 * the aspect ratio roughly equal to `targetAspect` (default 1.6).
 * Items are placed in the given order; no reordering / bin-packing
 * optimisation. Items wider than the target width still get their own
 * row (no clipping).
 */
export function packShelves(items: readonly PackedItem[], opts: ShelfPackOptions): PackResult {
  const positions = new Map<string, { x: number; y: number }>()
  if (items.length === 0) return { positions, width: 0, height: 0 }
  const { gap, grid } = opts
  const targetAspect = opts.targetAspect ?? 1.6
  const totalArea = items.reduce((a, c) => a + (c.width + gap) * (c.height + gap), 0)
  const widest = Math.max(...items.map((c) => c.width))
  const targetW = ceilGrid(Math.max(widest, Math.sqrt(totalArea * targetAspect)), grid)
  let x = 0
  let y = 0
  let rowH = 0
  let maxX = 0
  for (const it of items) {
    if (x > 0 && x + it.width > targetW) {
      x = 0
      y += rowH + gap
      rowH = 0
    }
    positions.set(it.id, { x, y })
    x += it.width + gap
    rowH = Math.max(rowH, it.height)
    maxX = Math.max(maxX, x - gap)
  }
  return { positions, width: maxX, height: y + rowH }
}

/**
 * Recursively pack `pkg` and its descendants, writing positions and
 * sizes into `layoutOut` and recording each visited package's outer
 * size into `computedSize`. Returns the outer size of `pkg`.
 *
 * Children are placed content-local (relative to the owning package's
 * content origin); the package's own outer size accounts for header +
 * padding chrome.
 */
export function packPackageTree(
  pkg: PackageData,
  sizeOf: SizeOf,
  layoutOut: Layout,
  computedSize: Map<string, { width: number; height: number }>,
  opts: ShelfPackOptions
): { width: number; height: number } {
  for (const sub of pkg.packages) {
    packPackageTree(sub, sizeOf, layoutOut, computedSize, opts)
  }
  const cached = (id: string): { width: number; height: number } => {
    const c = computedSize.get(id)
    return c ?? sizeOf(id, 'package')
  }
  const items: PackedItem[] = [
    ...pkg.packages.map((p) => ({ id: p.id, ...cached(p.id) })),
    ...pkg.entities.map((e) => ({ id: e.id, ...sizeOf(e.id, 'entity') })),
    ...pkg.enums.map((e) => ({ id: e.id, ...sizeOf(e.id, 'enum') })),
  ]
  const { positions, width: contentW, height: contentH } = packShelves(items, opts)
  for (const [id, pos] of positions) {
    const cur = layoutOut[id] ?? { x: 0, y: 0 }
    layoutOut[id] = { ...cur, x: pos.x, y: pos.y }
  }
  const outerW = ceilGrid(contentW + opts.contentPadding * 2, opts.grid)
  const outerH = ceilGrid(contentH + opts.headerOverhead + opts.contentPadding, opts.grid)
  const pl = layoutOut[pkg.id] ?? { x: 0, y: 0 }
  layoutOut[pkg.id] = { ...pl, width: outerW, height: outerH }
  const size = { width: outerW, height: outerH }
  computedSize.set(pkg.id, size)
  return size
}

/**
 * Pack already-sized top-level packages onto the canvas using the
 * same shelf strategy. Writes only x/y into `layoutOut` — the outer
 * sizes are already there from `packPackageTree`.
 */
export function packTopLevel(
  tops: readonly PackedItem[],
  layoutOut: Layout,
  opts: ShelfPackOptions
): void {
  const { positions } = packShelves(tops, opts)
  for (const [id, pos] of positions) {
    const cur = layoutOut[id] ?? { x: 0, y: 0 }
    layoutOut[id] = { ...cur, x: pos.x, y: pos.y }
  }
}
