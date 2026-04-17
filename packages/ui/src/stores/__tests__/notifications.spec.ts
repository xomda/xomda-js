import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useNotificationsStore } from '../notifications'

describe('useNotificationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('pushes notifications with auto-assigned ids', () => {
    const store = useNotificationsStore()
    const id1 = store.info('hello')
    const id2 = store.success('saved')
    expect(store.items).toHaveLength(2)
    expect(id1).not.toBe(id2)
  })

  it('pushes each kind via the named helper', () => {
    const store = useNotificationsStore()
    store.info('a')
    store.success('b')
    store.warning('c')
    store.error('d')
    expect(store.items.map((n) => n.kind)).toEqual(['info', 'success', 'warning', 'error'])
  })

  it('uses kind-specific default timeouts (info/success 4s, warning 6s, error 8s)', () => {
    const store = useNotificationsStore()
    store.info('a')
    store.success('b')
    store.warning('c')
    store.error('d')
    expect(store.items.map((n) => n.timeout)).toEqual([4000, 4000, 6000, 8000])
  })

  it('honors an explicit timeout override (including 0 for sticky)', () => {
    const store = useNotificationsStore()
    store.error('sticky', { timeout: 0 })
    expect(store.items[0].timeout).toBe(0)
    store.success('quick', { timeout: 250 })
    expect(store.items[1].timeout).toBe(250)
  })

  it('preserves an action callback on the notification', () => {
    const store = useNotificationsStore()
    const run = () => {}
    store.error('retryable', { action: { label: 'Retry', run } })
    expect(store.items[0].action?.label).toBe('Retry')
    expect(store.items[0].action?.run).toBe(run)
  })

  it('dismiss removes the notification with the given id', () => {
    const store = useNotificationsStore()
    const a = store.info('a')
    const b = store.info('b')
    store.dismiss(a)
    expect(store.items.map((n) => n.id)).toEqual([b])
  })

  it('dismiss is a no-op for unknown ids', () => {
    const store = useNotificationsStore()
    store.info('a')
    expect(() => store.dismiss(99999)).not.toThrow()
    expect(store.items).toHaveLength(1)
  })

  it('clear removes every notification', () => {
    const store = useNotificationsStore()
    store.info('a')
    store.error('b')
    store.clear()
    expect(store.items).toEqual([])
  })

  describe('deduplication', () => {
    it('coalesces identical (kind, message) pushes into one item with count++', () => {
      const store = useNotificationsStore()
      const id1 = store.error('Save failed')
      const id2 = store.error('Save failed')
      const id3 = store.error('Save failed')
      expect(store.items).toHaveLength(1)
      expect(id1).toBe(id2)
      expect(id2).toBe(id3)
      expect(store.items[0].count).toBe(3)
    })

    it('resets the dismiss timer on a dedup hit', () => {
      const store = useNotificationsStore()
      store.error('Save failed', { timeout: 1000 })
      // Advance the wall clock conceptually — we cannot fake here; the store
      // does not run timers itself. The contract is: a second push refreshes
      // the timeout value back to the kind default (or override).
      store.items[0].timeout = 250 // pretend the host counted down
      store.error('Save failed')
      expect(store.items[0].timeout).toBe(8000) // back to the error default
    })

    it('honours a fresh timeout override on a dedup hit', () => {
      const store = useNotificationsStore()
      store.error('boom')
      store.error('boom', { timeout: 1500 })
      expect(store.items[0].timeout).toBe(1500)
    })

    it('does NOT coalesce across different kinds', () => {
      const store = useNotificationsStore()
      store.error('Save failed')
      store.warning('Save failed')
      expect(store.items).toHaveLength(2)
      expect(store.items.map((n) => n.count)).toEqual([1, 1])
    })

    it('does NOT coalesce when dedupe is explicitly off', () => {
      const store = useNotificationsStore()
      store.info('Progress', { dedupe: false })
      store.info('Progress', { dedupe: false })
      expect(store.items).toHaveLength(2)
    })

    it('adopts the latest action callback on dedup', () => {
      const store = useNotificationsStore()
      const first = () => {}
      const second = () => {}
      store.error('retryable', { action: { label: 'Retry', run: first } })
      store.error('retryable', { action: { label: 'Try again', run: second } })
      expect(store.items[0].action?.label).toBe('Try again')
      expect(store.items[0].action?.run).toBe(second)
    })
  })

  describe('id counter', () => {
    it('starts at 1 in a fresh pinia (no cross-test bleed)', () => {
      const store = useNotificationsStore()
      const id = store.info('first ever')
      expect(id).toBe(1)
    })

    it('resets after createPinia() in a new test', () => {
      // beforeEach already calls setActivePinia(createPinia()) — this asserts
      // that the nextId counter is per-instance, not module-scoped.
      const store = useNotificationsStore()
      expect(store.info('first ever')).toBe(1)
    })
  })
})
