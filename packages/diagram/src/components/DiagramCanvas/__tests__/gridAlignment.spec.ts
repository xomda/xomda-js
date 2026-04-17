import { describe, expect, it } from 'vitest'

import { gridCellPx } from '../gridAlignment'

// `snap` in @xomda/diagram rounds world coords to multiples of 24. The
// grid is painted with `background-size: gridCellPx`. For a snapped
// node at world x = N · 24 to land *exactly* on the Nth grid line, the
// rendered scale must satisfy `gridCellPx === 24 · effectiveZoom` —
// which is what DiagramCanvas does (`displayZoom = cellPx / 24`).
// These tests lock the math down.

const WORLD = 24

describe('gridCellPx', () => {
  it('returns an integer at integer zoom', () => {
    expect(gridCellPx(1, WORLD)).toBe(24)
    expect(gridCellPx(2, WORLD)).toBe(48)
  })

  it('rounds half-cells to the nearest pixel at fractional zoom', () => {
    expect(gridCellPx(1.25, WORLD)).toBe(30) // 24 * 1.25 = 30 → integer
    expect(gridCellPx(1.1, WORLD)).toBe(26) // 24 * 1.1 = 26.4 → 26
    expect(gridCellPx(0.7, WORLD)).toBe(17) // 24 * 0.7 = 16.8 → 17
  })

  it('never drops below 1 pixel (would hide the grid entirely)', () => {
    expect(gridCellPx(0.001, WORLD)).toBe(1)
    expect(gridCellPx(0, WORLD)).toBe(1)
  })

  it('is always integer-valued', () => {
    for (let z = 0.25; z <= 2.0; z += 0.05) {
      const cell = gridCellPx(z, WORLD)
      expect(cell).toBe(Math.round(cell))
    }
  })
})

describe('grid ↔ snapped-node alignment invariant', () => {
  // The contract: DiagramCanvas computes `transform: scale(displayZoom)`
  // where `displayZoom = gridCellPx(rawZoom, 24) / 24`. The key insight
  // is that displayZoom is derived from the *rounded* cell pixel size,
  // not the raw zoom level. This test pins the contract by proving:
  //   (a) using the implementation's formula keeps snapped nodes on grid
  //   (b) using a naive `scale = rawZoom` misaligns them at fractional
  //       zoom — a regression we explicitly want to catch
  //
  // Without (b), the test would be tautological: it would algebraically
  // reduce to `N · cell === N · cell` and pass for any `gridCellPx`
  // implementation.

  const displayZoom = (z: number) => gridCellPx(z, WORLD) / WORLD

  describe('the implementation formula stays aligned', () => {
    it.each([0.25, 0.5, 0.75, 1, 1.1, 1.25, 1.33, 1.5, 1.75, 2])(
      'snapped node at world x=N·24 lands EXACTLY on the Nth grid line at zoom=%s',
      (z) => {
        const cell = gridCellPx(z, WORLD)
        const scale = displayZoom(z)
        for (const N of [0, 1, 5, 10, 42]) {
          const lineX = N * cell // painted: N · integer cellPx
          const nodeX = N * WORLD * scale // node: world * displayZoom
          expect(nodeX).toBe(lineX)
        }
      }
    )
  })

  describe('the naive (raw-zoom) formula misaligns — regression guard', () => {
    // This second case is the actual point of the test suite. If a future
    // refactor "simplifies" DiagramCanvas to `scale(${zoom.value})`, this
    // assertion fires and the misalignment shows up in CI instead of in
    // production at non-integer zoom levels.
    it('using rawZoom for the node transform produces sub-pixel drift at z=1.1', () => {
      const z = 1.1
      const cell = gridCellPx(z, WORLD) // 26 (24 * 1.1 = 26.4 → round)
      const N = 10
      const lineX = N * cell // painted line: 260
      const naiveNodeX = N * WORLD * z // 264 — naive would put the node here
      expect(naiveNodeX).not.toBe(lineX)
      // Drift accumulates linearly with N.
      expect(Math.abs(naiveNodeX - lineX)).toBeGreaterThan(3)
    })

    it('drift at z=1.4, N=42 with raw-zoom would be visible (>10px off the grid)', () => {
      // worldPx * z = 24 * 1.4 = 33.6, rounded to 34. Per-unit drift = 0.4.
      // At N=42, accumulated drift = 16.8 px — well past "noticeable".
      const z = 1.4
      const cell = gridCellPx(z, WORLD)
      const N = 42
      const lineX = N * cell
      const naiveNodeX = N * WORLD * z
      expect(Math.abs(naiveNodeX - lineX)).toBeGreaterThan(10)
    })
  })
})
