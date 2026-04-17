import { describe, expect, it, vi } from 'vitest'

import { createEventBus } from '../eventBus'

type TestEvents = {
  ping: { n: number }
  pong: string
}

describe('createEventBus', () => {
  it('delivers payload to registered handler', () => {
    const bus = createEventBus<TestEvents>()
    const spy = vi.fn()
    bus.on('ping', spy)
    bus.emit('ping', { n: 1 })
    expect(spy).toHaveBeenCalledWith({ n: 1 })
  })

  it('does not deliver to other events', () => {
    const bus = createEventBus<TestEvents>()
    const spy = vi.fn()
    bus.on('ping', spy)
    bus.emit('pong', 'hi')
    expect(spy).not.toHaveBeenCalled()
  })

  it('off() removes the handler', () => {
    const bus = createEventBus<TestEvents>()
    const spy = vi.fn()
    const off = bus.on('ping', spy)
    off()
    bus.emit('ping', { n: 1 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('once() fires exactly once', () => {
    const bus = createEventBus<TestEvents>()
    const spy = vi.fn()
    bus.once('ping', spy)
    bus.emit('ping', { n: 1 })
    bus.emit('ping', { n: 2 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('continues delivery when one handler throws', () => {
    const bus = createEventBus<TestEvents>()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const good = vi.fn()
    bus.on('ping', () => {
      throw new Error('boom')
    })
    bus.on('ping', good)
    bus.emit('ping', { n: 1 })
    expect(good).toHaveBeenCalledWith({ n: 1 })
    errSpy.mockRestore()
  })

  it('allows unsubscribe during emit without skipping siblings', () => {
    const bus = createEventBus<TestEvents>()
    const a = vi.fn()
    const offA = bus.on('ping', () => {
      offA()
      a()
    })
    const b = vi.fn()
    bus.on('ping', b)
    bus.emit('ping', { n: 1 })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    bus.emit('ping', { n: 2 })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('clear() removes everything', () => {
    const bus = createEventBus<TestEvents>()
    const spy = vi.fn()
    bus.on('ping', spy)
    bus.clear()
    bus.emit('ping', { n: 1 })
    expect(spy).not.toHaveBeenCalled()
  })
})
