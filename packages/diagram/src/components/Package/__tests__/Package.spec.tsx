import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Layout, PackageData } from '../../../types'
import { Package } from '../Package'

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

const pkgWithEntity: PackageData = {
  id: 'p1',
  name: 'Root',
  packages: [],
  entities: [{ id: 'e1', name: 'User', attributes: [] }],
  enums: [],
}

const pkgWithSubpackage: PackageData = {
  id: 'p1',
  name: 'Root',
  packages: [
    {
      id: 'p2',
      name: 'Sub',
      packages: [],
      entities: [{ id: 'e2', name: 'Order', attributes: [] }],
      enums: [],
    },
  ],
  entities: [],
  enums: [],
}

describe('Package', () => {
  it('renders child entity at its layout position when layouts map provided', () => {
    const layouts: Layout = { e1: { x: 100, y: 80 } }
    const wrapper = mount(Package, {
      props: { package: pkgWithEntity, absolute: true, layout: { x: 0, y: 0 }, layouts },
    })
    const entityRoot = wrapper.findComponent({ name: 'XEntity' }).element as HTMLElement
    expect(entityRoot.style.left).toBe('100px')
    expect(entityRoot.style.top).toBe('80px')
  })

  it('propagates layouts map to nested sub-packages', () => {
    const layouts: Layout = {
      p2: { x: 50, y: 60 },
      e2: { x: 30, y: 20 },
    }
    const wrapper = mount(Package, {
      props: { package: pkgWithSubpackage, absolute: true, layout: { x: 0, y: 0 }, layouts },
    })
    // Both root and sub-package render with their own absolute positioning;
    // the sub-package's entity is positioned per the same layouts map (proves recursion).
    const entity = wrapper.findComponent({ name: 'XEntity' }).element as HTMLElement
    expect(entity.style.left).toBe('30px')
    expect(entity.style.top).toBe('20px')
  })

  it('bubbles move emit from a child entity up through Package', async () => {
    const wrapper = mount(Package, {
      props: { package: pkgWithEntity, absolute: true, layout: { x: 0, y: 0 }, layouts: {} },
    })
    const entity = wrapper.findComponent({ name: 'XEntity' })
    entity.vm.$emit('move', 'e1', 120, 60)
    expect(wrapper.emitted('move')).toBeTruthy()
    expect(wrapper.emitted('move')![0]).toEqual(['e1', 120, 60])
  })

  it('auto-grows its saved layout to fit a sub-package that overflows', async () => {
    // Outer starts comfortably enclosing the sub-package, then the sub-package
    // is "moved" to overflow — outer should emit a resize that grows width/
    // height to fit it.
    const initial: Layout = {
      p2: { x: 0, y: 0, width: 100, height: 100 },
    }
    const wrapper = mount(Package, {
      props: {
        package: pkgWithSubpackage,
        absolute: true,
        layout: { x: 0, y: 0, width: 300, height: 200 },
        layouts: initial,
      },
    })
    await flushPromises()
    await wrapper.setProps({
      layouts: { p2: { x: 200, y: 100, width: 300, height: 100 } },
    })
    await flushPromises()
    const resizeEvents = wrapper.emitted('resize') ?? []
    expect(resizeEvents.length).toBeGreaterThan(0)
    const [id, w, h] = resizeEvents.at(-1)!
    expect(id).toBe('p1')
    // Grown to enclose the sub-package, snapped up to the next GRID_SIZE (24).
    // wantedW = ceil((200+300+24+24)/24)*24 = 552
    // wantedH = ceil((100+100+24+48)/24)*24 = 288
    expect(w).toBe(552)
    expect(h).toBe(288)
  })

  it('auto-shifts left/up when a sub-package overflows the top/left edge', async () => {
    // Sub-package starts inside the outer's bounds, then moves to a negative
    // position — the outer should shift itself by the grid-snapped overflow,
    // grow its width/height, and emit a compensating move for every child so
    // each child stays at the same world position.
    const initial: Layout = {
      p2: { x: 0, y: 0, width: 100, height: 100 },
    }
    const wrapper = mount(Package, {
      props: {
        package: pkgWithSubpackage,
        absolute: true,
        layout: { x: 200, y: 150, width: 300, height: 200 },
        layouts: initial,
      },
    })
    await flushPromises()
    await wrapper.setProps({
      layouts: { p2: { x: -50, y: -30, width: 100, height: 100 } },
    })
    await flushPromises()
    const moves = (wrapper.emitted('move') ?? []).map((args) => args as [string, number, number])
    const resizes = (wrapper.emitted('resize') ?? []).map(
      (args) => args as [string, number, number]
    )
    // shiftX = ceil(50/24)*24 = 72; shiftY = ceil(30/24)*24 = 48.
    // Package shifts to (200-72, 150-48) = (128, 102).
    const pkgMove = moves.find(([id]) => id === 'p1')
    expect(pkgMove).toEqual(['p1', 128, 102])
    // Child p2 shifts to (-50+72, -30+48) = (22, 18).
    const childMove = moves.find(([id]) => id === 'p2')
    expect(childMove).toEqual(['p2', 22, 18])
    // Package grows to (300+72, 200+48) = (372, 248).
    const pkgResize = resizes.find(([id]) => id === 'p1')
    expect(pkgResize).toEqual(['p1', 372, 248])
  })

  it('does not auto-grow an unsized package (CSS handles it)', async () => {
    // Outer package has no saved width/height — auto-grow should stay
    // hands-off so CSS `fit-content` keeps the package flexible.
    const wrapper = mount(Package, {
      props: {
        package: pkgWithSubpackage,
        absolute: true,
        layout: { x: 0, y: 0 },
        layouts: { p2: { x: 0, y: 0, width: 100, height: 100 } },
      },
    })
    await flushPromises()
    await wrapper.setProps({
      layouts: { p2: { x: 200, y: 100, width: 300, height: 100 } },
    })
    await flushPromises()
    expect(wrapper.emitted('resize')).toBeUndefined()
  })

  it('selectedId={entity.id} lights the selected ring on the right child entity', () => {
    const wrapper = mount(Package, {
      props: {
        package: pkgWithEntity,
        absolute: true,
        layout: { x: 0, y: 0 },
        layouts: { e1: { x: 0, y: 0 } },
        selectedId: 'e1',
      },
    })
    const entity = wrapper.findComponent({ name: 'XEntity' })
    expect(entity.props('selected')).toBe(true)
  })

  it('non-matching selectedId leaves the entity unselected', () => {
    const wrapper = mount(Package, {
      props: {
        package: pkgWithEntity,
        absolute: true,
        layout: { x: 0, y: 0 },
        layouts: { e1: { x: 0, y: 0 } },
        selectedId: 'something-else',
      },
    })
    const entity = wrapper.findComponent({ name: 'XEntity' })
    expect(entity.props('selected')).toBe(false)
  })

  it('selectedId propagates through nested packages to deeply-nested entities', () => {
    const wrapper = mount(Package, {
      props: {
        package: pkgWithSubpackage,
        absolute: true,
        layout: { x: 0, y: 0 },
        layouts: {},
        selectedId: 'e2',
      },
    })
    // The entity 'e2' lives inside sub-package 'p2' inside root 'p1'.
    const entity = wrapper.findComponent({ name: 'XEntity' })
    expect(entity.props('selected')).toBe(true)
  })

  it('emits background-click when the empty content area is clicked', async () => {
    const wrapper = mount(Package, {
      props: {
        package: pkgWithEntity,
        absolute: true,
        layout: { x: 0, y: 0 },
        layouts: { e1: { x: 0, y: 0 } },
      },
    })
    const content = wrapper.find('[class*="content"]')
    await content.trigger('click')
    expect(wrapper.emitted('background-click')).toBeTruthy()
  })

  it('clicking on a child node inside the content area does NOT emit background-click', async () => {
    const wrapper = mount(Package, {
      props: {
        package: pkgWithEntity,
        absolute: true,
        layout: { x: 0, y: 0 },
        layouts: { e1: { x: 0, y: 0 } },
      },
    })
    const entity = wrapper.findComponent({ name: 'XEntity' })
    await entity.trigger('click')
    expect(wrapper.emitted('background-click')).toBeUndefined()
  })

  it('applies computed minWidth/minHeight on .content based on child layouts', () => {
    const layouts: Layout = { e1: { x: 200, y: 100 } }
    const wrapper = mount(Package, {
      props: { package: pkgWithEntity, absolute: true, layout: { x: 0, y: 0 }, layouts },
    })
    const content = wrapper.find('[class*="content"]').element as HTMLElement
    // contentMinSize is the tight bounding box of the children — the
    // .package CSS padding adds the breathing room on the sides/bottom.
    // Default child size is 240x120 → 200+240=440, 100+120=220.
    expect(content.style.minWidth).toBe('440px')
    expect(content.style.minHeight).toBe('220px')
  })
})
