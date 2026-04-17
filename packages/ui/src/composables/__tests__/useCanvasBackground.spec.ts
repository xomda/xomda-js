import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { useCanvasBackground } from '../useCanvasBackground'

describe('useCanvasBackground', () => {
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
    vi.restoreAllMocks()
  })

  function makeHost(opts: {
    paused?: () => boolean
    onResize?: (w: number, h: number, dpr: number, canvas: HTMLCanvasElement) => void
    onFrame?: (phaseT: number, dtScaled: number) => void
  }) {
    return defineComponent({
      setup() {
        const { canvasRef } = useCanvasBackground({
          paused: opts.paused ?? (() => false),
          onResize: opts.onResize ?? (() => {}),
          onFrame: opts.onFrame ?? (() => {}),
        })
        return () => h('canvas', { ref: canvasRef })
      },
    })
  }

  it('calls onResize once on mount with the measured size', () => {
    const onResize = vi.fn()
    const wrapper = mount(makeHost({ paused: () => true, onResize }))
    expect(onResize).toHaveBeenCalledTimes(1)
    const [w, h, dpr, canvas] = onResize.mock.calls[0]
    expect(w).toBe(200)
    expect(h).toBe(100)
    expect(dpr).toBeGreaterThan(0)
    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
    wrapper.unmount()
  })

  it('renders one frame on mount when paused (no animation loop)', () => {
    const onFrame = vi.fn()
    const wrapper = mount(makeHost({ paused: () => true, onFrame }))
    expect(onFrame).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('starts the RAF loop when not paused', () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
    const wrapper = mount(makeHost({ paused: () => false }))
    expect(rafSpy).toHaveBeenCalled()
    wrapper.unmount()
    rafSpy.mockRestore()
  })

  it('cancels the animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const wrapper = mount(makeHost({ paused: () => false }))
    wrapper.unmount()
    expect(cancelSpy).toHaveBeenCalled()
    cancelSpy.mockRestore()
  })

  it('reacts to paused becoming true by stopping the loop', async () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const paused = ref(false)
    const Host = defineComponent({
      setup() {
        const { canvasRef } = useCanvasBackground({
          paused: () => paused.value,
          onResize: vi.fn(),
          onFrame: vi.fn(),
        })
        return () => h('canvas', { ref: canvasRef })
      },
    })
    const wrapper = mount(Host)
    paused.value = true
    await wrapper.vm.$nextTick()
    expect(cancelSpy).toHaveBeenCalled()
    wrapper.unmount()
    cancelSpy.mockRestore()
  })
})
