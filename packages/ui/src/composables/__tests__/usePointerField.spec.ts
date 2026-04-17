import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { usePointerField, type UsePointerFieldReturn } from '../usePointerField'

describe('usePointerField', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    rectSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    rectSpy.mockRestore()
  })

  function makeHost() {
    let api: UsePointerFieldReturn | null = null
    const Host = defineComponent({
      setup() {
        const canvasRef = ref<HTMLCanvasElement | null>(null)
        api = usePointerField(canvasRef)
        return () => h('canvas', { ref: canvasRef })
      },
    })
    const wrapper = mount(Host)
    return { wrapper, get: () => api! }
  }

  it('updates ndcX/ndcY on pointermove inside the canvas', () => {
    const { wrapper, get } = makeHost()
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 50 }))
    expect(get().state.ndcX).toBeCloseTo(0, 5)
    expect(get().state.ndcY).toBeCloseTo(0, 5)
    expect(get().state.active).toBe(true)
    wrapper.unmount()
  })

  it('marks pointer inactive when outside the canvas', () => {
    const { wrapper, get } = makeHost()
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, clientY: 500 }))
    expect(get().state.active).toBe(false)
    wrapper.unmount()
  })

  it('queues a drop on pointerdown inside the canvas', () => {
    const { wrapper, get } = makeHost()
    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 0 }))
    const drops = get().consumeDrops()
    expect(drops).toHaveLength(1)
    expect(drops[0].ndcX).toBeCloseTo(1, 5)
    expect(drops[0].ndcY).toBeCloseTo(1, 5)
    wrapper.unmount()
  })

  it('does not queue a drop when pointerdown is outside the canvas', () => {
    const { wrapper, get } = makeHost()
    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: -10, clientY: -10 }))
    expect(get().consumeDrops()).toHaveLength(0)
    wrapper.unmount()
  })

  it('drains the queue on consumeDrops', () => {
    const { wrapper, get } = makeHost()
    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 50 }))
    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 50 }))
    expect(get().consumeDrops()).toHaveLength(2)
    expect(get().consumeDrops()).toHaveLength(0)
    wrapper.unmount()
  })
})
