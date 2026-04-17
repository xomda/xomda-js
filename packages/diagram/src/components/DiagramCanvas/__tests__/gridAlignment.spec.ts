import { describe, expect, it } from 'vitest'

import { gridCellPx } from '../gridAlignment'

// DiagramCanvas applies `transform: scale(zoom)` to the inner element
// and sets the painted grid's `background-size` to `gridCellPx(zoom,
// 24)` on the viewport. For a node at world x = N · 24 to land
// exactly on the Nth painted grid line, both must use the *same*
// continuous `zoom` factor — no rounding. These tests pin that
// contract.
//
// History: an earlier version rounded `gridCellPx` to an integer
// pixel and derived the inner-scale from the rounded value, which
// kept tile edges crisp but turned wheel/pinch zoom into a visible
// ~4% staircase. The continuous formulation trades that crispness
// for a smooth zoom glide.

const WORLD = 24

describe('gridCellPx', () => {
  it('scales linearly with zoom (no rounding)', () => {
    expect(gridCellPx(1, WORLD)).toBe(24)
    expect(gridCellPx(2, WORLD)).toBe(48)
    expect(gridCellPx(1.1, WORLD)).toBeCloseTo(26.4, 10)
    expect(gridCellPx(0.7, WORLD)).toBeCloseTo(16.8, 10)
  })

  it('is strictly monotonic over small deltas — no stair-stepping', () => {
    // The whole point: a tiny zoom delta must produce a tiny
    // gridCellPx delta, not zero (which is what Math.round did).
    const a = gridCellPx(1.001, WORLD)
    const b = gridCellPx(1.002, WORLD)
    const c = gridCellPx(1.003, WORLD)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  it('never drops below 1 pixel (would hide the grid entirely)', () => {
    expect(gridCellPx(0.001, WORLD)).toBe(1)
    expect(gridCellPx(0, WORLD)).toBe(1)
  })
})

describe('grid ↔ snapped-node alignment invariant', () => {
  // Contract: with both the inner-scale and the painted cell size
  // driven by raw `zoom`, a snapped world position renders exactly
  // on the corresponding painted grid line at any zoom level —
  // including fractional ones that previously caused a 4% snap.

  it.each([0.25, 0.5, 0.7, 1, 1.1, 1.234, 1.5, 1.75, 2])(
    'snapped node at world x=N·24 lands exactly on the Nth grid line at zoom=%s',
    (z) => {
      const cell = gridCellPx(z, WORLD)
      const scale = z // displayZoom in DiagramCanvas
      for (const N of [0, 1, 5, 10, 42]) {
        const lineX = N * cell
        const nodeX = N * WORLD * scale
        expect(nodeX).toBeCloseTo(lineX, 10)
      }
    }
  )
})
