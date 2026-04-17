import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import type { EntityData } from '../../../types'
import { Entity } from '../Entity'

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

const entity: EntityData = {
  id: 'e1',
  name: 'User',
  attributes: [],
}

describe('Entity', () => {
  it('renders with absolute positioning when absolute=true', () => {
    const wrapper = mount(Entity, {
      props: { entity, absolute: true, layout: { x: 100, y: 80 } },
    })
    const root = wrapper.element as HTMLElement
    expect(root.style.position).toBe('absolute')
    expect(root.style.left).toBe('100px')
    expect(root.style.top).toBe('80px')
  })

  it('emits move with snapped delta-based coords on pointer drag', async () => {
    const wrapper = mount(Entity, {
      props: { entity, absolute: true, layout: { x: 48, y: 24 } },
    })

    const header = wrapper.find('.headerDraggable, [class*="header"]').element as HTMLElement
    // Stub pointer capture so happy-dom doesn't blow up
    ;(header as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}
    ;(header as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {}

    const down = new Event('pointerdown') as PointerEvent
    Object.assign(down, { button: 0, clientX: 200, clientY: 200, pointerId: 1 })
    header.dispatchEvent(down)

    const move = new Event('pointermove') as PointerEvent
    // Drag +50, +30 → new pos = (48+50, 24+30) = (98, 54) → snapped to grid (24): (96, 48)
    Object.assign(move, { clientX: 250, clientY: 230, pointerId: 1 })
    header.dispatchEvent(move)

    const events = wrapper.emitted('move')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual(['e1', 96, 48])
  })

  it('clamps x/y to non-negative when dragging upper-left', async () => {
    const wrapper = mount(Entity, {
      props: { entity, absolute: true, layout: { x: 24, y: 24 } },
    })
    const header = wrapper.find('[class*="header"]').element as HTMLElement
    ;(header as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {}

    const down = new Event('pointerdown') as PointerEvent
    Object.assign(down, { button: 0, clientX: 100, clientY: 100, pointerId: 1 })
    header.dispatchEvent(down)

    const move = new Event('pointermove') as PointerEvent
    // Drag −500, −500 → would be negative, clamp to (0, 0)
    Object.assign(move, { clientX: -400, clientY: -400, pointerId: 1 })
    header.dispatchEvent(move)

    expect(wrapper.emitted('move')![0]).toEqual(['e1', 0, 0])
  })
})
