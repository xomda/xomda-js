import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import { ParticleBackground } from '../ParticleBackground'
import { fields, resolveField } from '../particleField'
import { ParticleSystem } from '../particleSystem'
import { presets } from '../presets'
import { parseColor } from '../webglContext'

const vuetify = createVuetify()

describe('ParticleBackground', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    rectSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
  })

  afterEach(() => {
    rectSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('mounts with defaults without throwing when WebGL2 is unavailable', () => {
    // happy-dom doesn't provide webgl2 — component must degrade silently.
    const wrapper = mount(ParticleBackground, {
      props: { paused: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it.each(['light', 'dark', 'auto'] as const)('mounts with mode=%s', (mode) => {
    const wrapper = mount(ParticleBackground, {
      props: { mode, paused: true },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })

  it('cancels the animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const wrapper = mount(ParticleBackground, { global: { plugins: [vuetify] } })
    wrapper.unmount()
    expect(cancelSpy).toHaveBeenCalled()
    cancelSpy.mockRestore()
  })

  it('does not throw when particleCount, fieldFunction, or seed change', async () => {
    const wrapper = mount(ParticleBackground, {
      props: { paused: true, particleCount: 200 },
      global: { plugins: [vuetify] },
    })
    await wrapper.setProps({ particleCount: 500 })
    await wrapper.setProps({ fieldFunction: 'torus' })
    await wrapper.setProps({ seed: 42 })
    expect(wrapper.find('canvas').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('particleField', () => {
  it('exposes all named fields', () => {
    expect(Object.keys(fields).sort()).toEqual(
      ['galaxy', 'lattice', 'lorenz', 'noise', 'sphere', 'torus', 'wave'].sort()
    )
  })

  it('resolveField defaults to galaxy on unknown ids', () => {
    expect(resolveField(undefined)).toBe(fields.galaxy)
    expect(resolveField('sphere')).toBe(fields.sphere)
  })

  it('resolveField passes through custom functions', () => {
    const fn = () => [0, 0, 0] as const
    expect(resolveField(fn)).toBe(fn)
  })
})

describe('ParticleSystem', () => {
  it('seeds positions from the field generator', () => {
    const sys = new ParticleSystem(10, fields.sphere, { radius: 2 }, 0)
    expect(sys.positions.length).toBe(30)
    expect(sys.gpuData.length).toBe(50)
    // All positions should be on a sphere of radius ~2
    for (let i = 0; i < 10; i++) {
      const o = i * 3
      const r = Math.hypot(sys.positions[o], sys.positions[o + 1], sys.positions[o + 2])
      expect(r).toBeCloseTo(2, 1)
    }
  })

  it('keeps particles near rest with default spring', () => {
    const sys = new ParticleSystem(50, fields.sphere, { radius: 1 }, 0)
    const before = new Float32Array(sys.positions)
    for (let i = 0; i < 30; i++) {
      sys.step({
        dt: 1 / 60,
        gravity: [0, 0, 0],
        damping: 0.9,
        springStrength: 1,
        pointer: null,
        pointerStrength: 0,
        pointerRadius: 0,
        drops: [],
      })
    }
    let maxDrift = 0
    for (let i = 0; i < before.length; i++) {
      maxDrift = Math.max(maxDrift, Math.abs(sys.positions[i] - before[i]))
    }
    expect(maxDrift).toBeLessThan(0.5)
  })

  it('applies a drop impulse to nearby particles', () => {
    const sys = new ParticleSystem(20, fields.sphere, { radius: 1 }, 0)
    const beforeVel = new Float32Array(sys.velocities)
    sys.step({
      dt: 1 / 60,
      gravity: [0, 0, 0],
      damping: 1,
      springStrength: 0,
      pointer: null,
      pointerStrength: 0,
      pointerRadius: 0,
      drops: [{ worldPos: [0, 0, 0], mass: 5, velocity: 5, radius: 5 }],
    })
    let totalChange = 0
    for (let i = 0; i < beforeVel.length; i++) {
      totalChange += Math.abs(sys.velocities[i] - beforeVel[i])
    }
    expect(totalChange).toBeGreaterThan(0)
  })
})

describe('parseColor', () => {
  it('parses hex colors', () => {
    const [r, g, b] = parseColor('#ff8000')
    expect(r).toBeCloseTo(1, 2)
    expect(g).toBeCloseTo(0.502, 2)
    expect(b).toBeCloseTo(0, 2)
  })

  it('parses short hex colors', () => {
    const [r, g, b] = parseColor('#f80')
    expect(r).toBeCloseTo(1, 2)
    expect(g).toBeCloseTo(0.533, 2)
    expect(b).toBeCloseTo(0, 2)
  })

  it('parses rgb()', () => {
    const [r, g, b] = parseColor('rgb(255, 128, 0)')
    expect(r).toBeCloseTo(1, 2)
    expect(g).toBeCloseTo(0.502, 2)
    expect(b).toBeCloseTo(0, 2)
  })

  it('falls back to white for unknown input', () => {
    expect(parseColor('???')).toEqual([1, 1, 1])
  })
})

describe('presets', () => {
  it('every preset is shaped like a partial ParticleBackground props object', () => {
    for (const [name, preset] of Object.entries(presets)) {
      expect(typeof name).toBe('string')
      expect(typeof preset).toBe('object')
      if (preset.particleCount !== undefined) expect(preset.particleCount).toBeGreaterThan(0)
    }
  })
})
