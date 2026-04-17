import { mount } from '@vue/test-utils'
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

  it('applies computed minWidth/minHeight on .content based on child layouts', () => {
    const layouts: Layout = { e1: { x: 200, y: 100 } }
    const wrapper = mount(Package, {
      props: { package: pkgWithEntity, absolute: true, layout: { x: 0, y: 0 }, layouts },
    })
    const content = wrapper.find('[class*="content"]').element as HTMLElement
    // Default child size is 240x120 + 16px padding → 200+240+16=456, 100+120+16=236
    expect(content.style.minWidth).toBe('456px')
    expect(content.style.minHeight).toBe('236px')
  })
})
