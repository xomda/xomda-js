import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getEventBus,
  getModule,
  getRegisteredModules,
  initializeModules,
  registerModule,
  resetModuleRegistry,
} from '../registry'

afterEach(() => resetModuleRegistry())

describe('module registry', () => {
  it('register + getRegisteredModules round-trips', () => {
    registerModule({ id: 'a' })
    registerModule({ id: 'b' })
    expect(getRegisteredModules().map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('ignores duplicate ids', () => {
    registerModule({ id: 'a' })
    registerModule({ id: 'a' })
    expect(getRegisteredModules()).toHaveLength(1)
  })

  it('initializeModules fires setup() once', () => {
    const spy = vi.fn()
    registerModule({ id: 'a', setup: spy })
    initializeModules()
    initializeModules() // idempotent
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('exposes setup() return value via getModule()', () => {
    registerModule({ id: 'a', setup: () => ({ hello: 'world' }) })
    initializeModules()
    expect(getModule<{ hello: string }>('a')).toEqual({ hello: 'world' })
  })

  it('late registration runs setup if already initialized', () => {
    initializeModules()
    const spy = vi.fn(() => ({ ok: true }))
    registerModule({ id: 'late', setup: spy })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(getModule('late')).toEqual({ ok: true })
  })

  it('event bus is shared across modules', () => {
    const seen: unknown[] = []
    registerModule({
      id: 'consumer',
      setup: ({ bus }) => {
        bus.on('demo:event', (p) => seen.push(p))
      },
    })
    registerModule({
      id: 'producer',
      setup: ({ bus }) => ({ fire: () => bus.emit('demo:event', { hi: 1 }) }),
    })
    initializeModules()
    const producer = getModule<{ fire: () => void }>('producer')!
    producer.fire()
    expect(seen).toEqual([{ hi: 1 }])
    expect(getEventBus()).toBeDefined()
  })

  it('ctx.getModule resolves a sibling module', () => {
    registerModule({ id: 'foo', setup: () => ({ value: 42 }) })
    registerModule({
      id: 'bar',
      setup: (ctx) => ({ pull: () => ctx.getModule<{ value: number }>('foo')?.value }),
    })
    initializeModules()
    const bar = getModule<{ pull: () => number | undefined }>('bar')!
    expect(bar.pull()).toBe(42)
  })
})
