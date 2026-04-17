import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { GlassBackground } from '../GlassBackground'

const vuetify = createVuetify()

function makeMockCtx() {
  return {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D
}

describe('GlassBackground', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let mockCtx: ReturnType<typeof makeMockCtx>
  let rectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockCtx = makeMockCtx()
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as never)
    rectSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
    rectSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('mounts with defaults and paints at least once', () => {
    const wrapper = mount(GlassBackground, {
      props: { paused: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(getContextSpy).toHaveBeenCalledWith('2d')
    expect((mockCtx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it.each(['light', 'dark', 'auto'] as const)('mounts with mode=%s', (mode) => {
    const wrapper = mount(GlassBackground, {
      props: { mode, paused: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it('cancels animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame')
    const wrapper = mount(GlassBackground, {
      global: { plugins: [vuetify] },
    })
    wrapper.unmount()
    expect(cancelSpy).toHaveBeenCalled()
    cancelSpy.mockRestore()
  })

  it('does not throw when intensity, density, and seed change', async () => {
    const wrapper = mount(GlassBackground, {
      props: { paused: true, intensity: 0.5, density: 0.3, seed: 0 },
      global: { plugins: [vuetify] },
    })
    await wrapper.setProps({ intensity: 0.9 })
    await wrapper.setProps({ density: 0.7 })
    await wrapper.setProps({ seed: 42 })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })
})
