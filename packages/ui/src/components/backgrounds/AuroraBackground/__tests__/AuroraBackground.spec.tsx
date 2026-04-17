import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { AuroraBackground } from '../AuroraBackground'

const vuetify = createVuetify()

function makeMockCtx() {
  return {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '' as CanvasRenderingContext2D['fillStyle'],
    globalCompositeOperation: 'source-over' as CanvasRenderingContext2D['globalCompositeOperation'],
  } as unknown as CanvasRenderingContext2D
}

describe('AuroraBackground', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let mockCtx: ReturnType<typeof makeMockCtx>
  let rectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockCtx = makeMockCtx()
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockCtx as never)
    rectSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
    rectSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('mounts with defaults and paints at least once', () => {
    const wrapper = mount(AuroraBackground, {
      props: { paused: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(getContextSpy).toHaveBeenCalledWith('2d')
    expect(
      (mockCtx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it.each(['light', 'dark', 'auto'] as const)('mounts with mode=%s', (mode) => {
    const wrapper = mount(AuroraBackground, {
      props: { mode, paused: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it('cancels animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')
    const wrapper = mount(AuroraBackground, {
      global: { plugins: [vuetify] },
    })
    wrapper.unmount()
    expect(cancelSpy).toHaveBeenCalled()
    cancelSpy.mockRestore()
  })

  it('does not throw when seed and intensity change', async () => {
    const wrapper = mount(AuroraBackground, {
      props: { paused: true, seed: 0, intensity: 0.5 },
      global: { plugins: [vuetify] },
    })
    await wrapper.setProps({ seed: 3 })
    await wrapper.setProps({ seed: 7 })
    await wrapper.setProps({ intensity: 1.2 })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })
})
