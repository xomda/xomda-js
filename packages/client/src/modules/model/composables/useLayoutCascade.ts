import type { Model } from '@xomda/core'
import type { Layout, PackageData } from '@xomda/diagram'
import type { Ref } from 'vue'
import { onBeforeUnmount } from 'vue'

export interface UseLayoutCascadeOptions {
  /** Grid module — all cascade outputs round up to this. */
  grid: number
  /** Padding inside a package's content area. */
  contentPadding: number
  /** Vertical chrome on top of a package (header). */
  headerOverhead: number
  /** Fallback width when nothing has been measured for an item yet. */
  defaultNodeWidth: number
  /** Fallback height when nothing has been measured for an item yet. */
  defaultNodeHeight: number
}

export interface UseLayoutCascadeReturn {
  /**
   * Run one cascade pass — walks the package tree post-order and grows
   * each *sized* package's saved width/height so it always encloses
   * its children. Returns true when something changed (the caller may
   * schedule a follow-up pass).
   */
  cascade: () => boolean
  /**
   * Coalesce cascade work onto the next animation frame; if the first
   * pass changed anything, run a second pass on the following frame to
   * pick up cascade-driven size changes the DOM hadn't reflowed yet.
   *
   * Idempotent within a frame — repeated calls before the RAF fires
   * are no-ops. Cleaned up on unmount.
   */
  scheduleCascade: () => void
}

/**
 * Cascading auto-grow for a nested package diagram.
 *
 * Lives outside the host component because it pairs a recursive
 * geometric operation with a tiny RAF lifecycle that needs unmount-safe
 * cleanup. The host injects:
 *   - \`model\` — the current model (we read \`packages\` only).
 *   - \`layout\` — current saved layout map (read).
 *   - \`writeLayout\` — atomic writer for the next layout (used when
 *     the cascade actually changed something).
 *   - \`findEl\` — DOM resolver for `data-package-id` / `-entity-id` /
 *     `-enum-id` so we can read each child's actual rendered size off
 *     \`offsetWidth\`/\`offsetHeight\` (unaffected by canvas scale).
 *
 * Per-package watchers would miss two cases this single-pass walk
 * handles natively: (1) a child CSS-grew past its saved size — its
 * parent's \`contentMinSize\` watch would fire off the saved size, not
 * the rendered one; (2) nested deeper than one level, where one tick
 * of reactivity hasn't propagated to the grandparent yet.
 */
export function useLayoutCascade(
  model: Ref<Model | null | undefined>,
  layout: Ref<Layout>,
  writeLayout: (next: Layout) => void,
  findEl: (id: string) => HTMLElement | null,
  opts: UseLayoutCascadeOptions
): UseLayoutCascadeReturn {
  const ceilGrid = (v: number): number => Math.ceil(v / opts.grid) * opts.grid

  function cascade(): boolean {
    const m = model.value
    if (!m) return false
    const cur = layout.value
    const next: Layout = { ...cur }
    let changed = false
    const visit = (pkg: PackageData): void => {
      for (const child of pkg.packages) visit(child)
      const allChildren: { id: string }[] = [...pkg.packages, ...pkg.entities, ...pkg.enums]
      let maxX = 0
      let maxY = 0
      for (const child of allChildren) {
        const cl = next[child.id] ?? { x: 0, y: 0 }
        const el = findEl(child.id)
        const observedW = el?.offsetWidth ?? 0
        const observedH = el?.offsetHeight ?? 0
        const w = Math.max(cl.width ?? 0, observedW) || opts.defaultNodeWidth
        const h = Math.max(cl.height ?? 0, observedH) || opts.defaultNodeHeight
        maxX = Math.max(maxX, cl.x + w)
        maxY = Math.max(maxY, cl.y + h)
      }
      const pl = next[pkg.id]
      if (!pl) return
      // Unsized packages let CSS handle growth — no need to materialise
      // a saved size.
      if (pl.width == null && pl.height == null) return
      const wantedW = ceilGrid(maxX + opts.contentPadding * 2)
      const wantedH = ceilGrid(maxY + opts.headerOverhead + opts.contentPadding)
      const newW = pl.width != null ? Math.max(pl.width, wantedW) : pl.width
      const newH = pl.height != null ? Math.max(pl.height, wantedH) : pl.height
      if (newW !== pl.width || newH !== pl.height) {
        next[pkg.id] = { ...pl, width: newW, height: newH }
        changed = true
      }
    }
    for (const top of (m as { packages: PackageData[] }).packages) visit(top)
    if (changed) writeLayout(next)
    return changed
  }

  let raf = 0
  function scheduleCascade(): void {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      // One pass is usually enough (post-order visits children first), but
      // if the DOM hasn't reflowed yet for the new layout we may need a
      // follow-up tick to pick up cascade-driven size changes.
      if (cascade()) requestAnimationFrame(() => cascade())
    })
  }

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
  })

  return { cascade, scheduleCascade }
}
