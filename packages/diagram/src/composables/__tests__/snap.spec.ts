import { describe, expect, it } from 'vitest'

import type { Layout } from '../../types'
import { GRID_SIZE, normalizeLayoutToGrid, snap } from '../useCanvasLayout'

describe('snap (no offset — top-level nodes)', () => {
  it('rounds to the nearest grid multiple', () => {
    expect(snap(0)).toBe(0)
    expect(snap(11)).toBe(0)
    expect(snap(12)).toBe(24)
    expect(snap(23)).toBe(24)
    expect(snap(36)).toBe(48)
  })
})

describe('snap with worldOffset — nested nodes', () => {
  // A child of a top-level package has its local-coord origin at
  // world_x = parent.x + CONTENT_PADDING (16). For the child's screen
  // position to land on a world-grid line, the snapped local value plus
  // the offset must be a multiple of GRID_SIZE.
  it('snap targets land on the world grid when offset is applied', () => {
    for (const offset of [0, 8, 12, 16]) {
      for (const value of [-5, 0, 7, 13, 24, 41, 100]) {
        const result = snap(value, GRID_SIZE, offset)
        expect((result + offset) % GRID_SIZE).toBe(0)
      }
    }
  })

  it('with offset=16 snaps to {8, 32, 56, ...} (24·k − 16)', () => {
    expect(snap(0, GRID_SIZE, 16)).toBe(8) // raw target -16; clamped up to 8
    expect(snap(7, GRID_SIZE, 16)).toBe(8)
    expect(snap(19, GRID_SIZE, 16)).toBe(8) // (19+16)/24=1.46 → 1 → 8
    expect(snap(20, GRID_SIZE, 16)).toBe(32) // (20+16)/24=1.5 → 2 → 32
    expect(snap(32, GRID_SIZE, 16)).toBe(32)
    expect(snap(45, GRID_SIZE, 16)).toBe(56)
  })

  it('never returns a negative value', () => {
    for (const offset of [0, 8, 16, 20]) {
      for (const value of [-100, -16, -1, 0]) {
        expect(snap(value, GRID_SIZE, offset)).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('normalizeLayoutToGrid', () => {
  it('snaps x/y to grid multiples (round) and width/height to grid multiples (ceil)', () => {
    const input: Layout = {
      a: { x: 13, y: 11, width: 250, height: 130 },
      b: { x: 0, y: 0 },
      c: { x: 7, y: 17, width: 96 },
    }
    const out = normalizeLayoutToGrid(input)
    expect(out.a).toEqual({ x: 24, y: 0, width: 264, height: 144 })
    expect(out.b).toEqual({ x: 0, y: 0 })
    expect(out.c).toEqual({ x: 0, y: 24, width: 96 })
    expect(out.c.height).toBeUndefined()
  })

  it('clamps negatives to zero and dimensions to minimum 4 cells', () => {
    const input: Layout = { a: { x: -50, y: -10, width: 20, height: 1 } }
    const out = normalizeLayoutToGrid(input)
    expect(out.a.x).toBe(0)
    expect(out.a.y).toBe(0)
    expect(out.a.width).toBe(GRID_SIZE * 4)
    expect(out.a.height).toBe(GRID_SIZE * 4)
  })

  it('is idempotent on already-grid-aligned data', () => {
    const input: Layout = {
      a: { x: 48, y: 72, width: 240, height: 120 },
      b: { x: 0, y: 0 },
    }
    expect(normalizeLayoutToGrid(input)).toEqual(input)
  })
})
