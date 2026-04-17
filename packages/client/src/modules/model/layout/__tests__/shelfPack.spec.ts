import type { Layout, PackageData } from '@xomda/diagram'
import { describe, expect, it } from 'vitest'

import type { ShelfPackOptions, SizeOf } from '../shelfPack'
import { ceilGrid, packPackageTree, packShelves, packTopLevel } from '../shelfPack'

const OPTS: ShelfPackOptions = {
  grid: 20,
  gap: 40,
  contentPadding: 20,
  headerOverhead: 40,
  defaultNodeWidth: 240,
  defaultNodeHeight: 120,
}

describe('ceilGrid', () => {
  it('rounds up to the nearest multiple of `grid`', () => {
    expect(ceilGrid(0, 20)).toBe(0)
    expect(ceilGrid(1, 20)).toBe(20)
    expect(ceilGrid(20, 20)).toBe(20)
    expect(ceilGrid(21, 20)).toBe(40)
    expect(ceilGrid(141, 20)).toBe(160)
  })
})

describe('packShelves', () => {
  it('returns the empty result for an empty input', () => {
    const r = packShelves([], OPTS)
    expect(r.positions.size).toBe(0)
    expect(r.width).toBe(0)
    expect(r.height).toBe(0)
  })

  it('packs a single item at the origin and reports its bounding box', () => {
    const r = packShelves([{ id: 'a', width: 100, height: 80 }], OPTS)
    expect(r.positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(r.width).toBe(100)
    expect(r.height).toBe(80)
  })

  it('wraps to a new row when the target width would be exceeded', () => {
    // Two ~200×100 items with a 40px gap → totalArea ≈ (240·140)·2 = 67200.
    // target ≈ sqrt(67200·1.6) ≈ 327 → wraps after the first.
    const items = [
      { id: 'a', width: 200, height: 100 },
      { id: 'b', width: 200, height: 100 },
    ]
    const r = packShelves(items, OPTS)
    expect(r.positions.get('a')).toEqual({ x: 0, y: 0 })
    expect(r.positions.get('b')).toEqual({ x: 0, y: 140 }) // wrapped: y = rowH + gap
    expect(r.width).toBe(200)
    expect(r.height).toBe(240) // 100 + gap(40) + 100
  })

  it('places items wider than the target on their own row anyway', () => {
    // Wider-than-target items can not be made to fit, so they get their
    // own row without clipping.
    const items = [
      { id: 'wide', width: 600, height: 80 },
      { id: 'small', width: 50, height: 50 },
    ]
    const r = packShelves(items, OPTS)
    expect(r.positions.get('wide')).toEqual({ x: 0, y: 0 })
    expect(r.positions.get('small')?.y).toBe(120) // wraps after the wide one
    expect(r.width).toBe(600)
  })

  it('keeps placement deterministic (preserves input order)', () => {
    // The packer never reorders — useful invariant: regenerating layout
    // for the same model should produce stable positions for git diffs.
    const items = [
      { id: 'a', width: 100, height: 100 },
      { id: 'b', width: 100, height: 100 },
      { id: 'c', width: 100, height: 100 },
    ]
    const r = packShelves(items, OPTS)
    const order = [...r.positions.keys()]
    expect(order).toEqual(['a', 'b', 'c'])
  })
})

describe('packPackageTree', () => {
  const fixedSize: SizeOf = () => ({ width: 200, height: 100 })

  it('positions entities, enums, and nested packages content-local under their parent', () => {
    const pkg: PackageData = {
      id: 'pkg-1',
      name: 'p1',
      packages: [],
      entities: [
        { id: 'e1', name: 'E1', attributes: [] },
        { id: 'e2', name: 'E2', attributes: [] },
      ],
      enums: [],
    } as unknown as PackageData
    const layout: Layout = {}
    const computed = new Map<string, { width: number; height: number }>()
    const outer = packPackageTree(pkg, fixedSize, layout, computed, OPTS)
    // Children placed at content-local origin.
    expect(layout['e1']).toMatchObject({ x: 0, y: 0 })
    // Outer size includes header (40) + content padding (20·2) overhead.
    expect(outer.width).toBeGreaterThan(200)
    expect(outer.height).toBeGreaterThan(100)
    expect(computed.get('pkg-1')).toEqual(outer)
    // The package gets its own size stored too.
    expect(layout['pkg-1']?.width).toBe(outer.width)
  })

  it('recurses into nested packages, computing their sizes bottom-up', () => {
    const inner: PackageData = {
      id: 'inner',
      name: 'inner',
      packages: [],
      entities: [{ id: 'ie1', name: 'IE1', attributes: [] }],
      enums: [],
    } as unknown as PackageData
    const outer: PackageData = {
      id: 'outer',
      name: 'outer',
      packages: [inner],
      entities: [],
      enums: [],
    } as unknown as PackageData
    const layout: Layout = {}
    const computed = new Map<string, { width: number; height: number }>()
    const result = packPackageTree(outer, fixedSize, layout, computed, OPTS)
    expect(computed.has('inner')).toBe(true)
    expect(computed.has('outer')).toBe(true)
    expect(result.width).toBeGreaterThan(computed.get('inner')!.width)
  })

  it('preserves a stored x/y on the package itself (only writes width/height)', () => {
    const pkg: PackageData = {
      id: 'kept',
      name: 'k',
      packages: [],
      entities: [{ id: 'k1', name: 'K1', attributes: [] }],
      enums: [],
    } as unknown as PackageData
    const layout: Layout = { kept: { x: 1234, y: 5678 } }
    const computed = new Map<string, { width: number; height: number }>()
    packPackageTree(pkg, fixedSize, layout, computed, OPTS)
    expect(layout['kept']?.x).toBe(1234)
    expect(layout['kept']?.y).toBe(5678)
  })
})

describe('packTopLevel', () => {
  it('places already-sized packages onto a top-level shelf', () => {
    const layout: Layout = {}
    packTopLevel(
      [
        { id: 'a', width: 200, height: 100 },
        { id: 'b', width: 200, height: 100 },
      ],
      layout,
      OPTS
    )
    expect(layout['a']?.x).toBe(0)
    expect(layout['b']?.y).toBeGreaterThanOrEqual(0)
  })

  it('preserves stored width/height (only writes x/y)', () => {
    const layout: Layout = { a: { x: 99, y: 99, width: 500, height: 400 } }
    packTopLevel([{ id: 'a', width: 200, height: 100 }], layout, OPTS)
    expect(layout['a']?.width).toBe(500) // unchanged
    expect(layout['a']?.height).toBe(400) // unchanged
    expect(layout['a']?.x).toBe(0) // rewritten
  })
})
