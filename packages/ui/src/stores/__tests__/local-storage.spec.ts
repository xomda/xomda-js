import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { LOCAL_STORAGE_KEY, useLocalStorageStore } from '../local-storage'

// happy-dom does not expose `localStorage` as a global in the version
// pinned here, so we install a tiny in-memory polyfill before the store
// (which reads `localStorage` at import time) runs.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
          return store.size
        },
      } satisfies Storage,
    })
  }
})

describe('useLocalStorageStore card surface knobs', () => {
  beforeEach(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
    setActivePinia(createPinia())
  })

  it('defaults to the legacy frosted-glass values', () => {
    const store = useLocalStorageStore()
    expect(store.cardSurfaceAlpha).toBe(0.78)
    expect(store.cardSurfaceBlur).toBe(8)
  })

  it('clamps cardSurfaceAlpha to the 0..1 range on write', () => {
    const store = useLocalStorageStore()
    store.cardSurfaceAlpha = 5
    expect(store.cardSurfaceAlpha).toBe(1)
    store.cardSurfaceAlpha = -1
    expect(store.cardSurfaceAlpha).toBe(0)
    store.cardSurfaceAlpha = 0.42
    expect(store.cardSurfaceAlpha).toBe(0.42)
  })

  it('clamps cardSurfaceBlur to the 0..40 range on write', () => {
    const store = useLocalStorageStore()
    store.cardSurfaceBlur = 999
    expect(store.cardSurfaceBlur).toBe(40)
    store.cardSurfaceBlur = -5
    expect(store.cardSurfaceBlur).toBe(0)
    store.cardSurfaceBlur = 12
    expect(store.cardSurfaceBlur).toBe(12)
  })

  it('persists writes to localStorage so a reload keeps the values', async () => {
    const store = useLocalStorageStore()
    store.cardSurfaceAlpha = 0.5
    store.cardSurfaceBlur = 20
    // The persistence path goes through a `watch` on the underlying ref;
    // flush once so the debounced write lands before we read it back.
    await nextTick()
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as { cardSurfaceAlpha: number; cardSurfaceBlur: number }
    expect(parsed.cardSurfaceAlpha).toBe(0.5)
    expect(parsed.cardSurfaceBlur).toBe(20)
  })
})
