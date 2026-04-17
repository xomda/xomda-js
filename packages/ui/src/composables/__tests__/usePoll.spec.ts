import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent } from 'vue'

import type { UsePollReturn } from '../usePoll'
import { usePoll } from '../usePoll'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Mount a tiny component that calls `usePoll` and exposes the return so
 * the test can drive the source `fn` and assert on `data` / `refresh`.
 */
function mountPoller<T>(
  fn: () => Promise<T> | T,
  intervalMs: number,
  options?: Parameters<typeof usePoll<T>>[2]
) {
  const captured: { ret: UsePollReturn<T> | null } = { ret: null }
  const Host = defineComponent({
    setup() {
      captured.ret = usePoll(fn, intervalMs, options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  if (!captured.ret) throw new Error('usePoll did not capture')
  return {
    wrapper,
    ret: captured.ret as { data: Ref<T | undefined>; refresh: () => Promise<void> },
  }
}

describe('usePoll', () => {
  it('runs fn at mount when immediate (default) and exposes its result', async () => {
    const fn = vi.fn(() => 42)
    const { ret } = mountPoller(fn, 1_000_000)
    // Synchronous fn → data is set in the same microtask as mount.
    expect(fn).toHaveBeenCalledOnce()
    expect(ret.data.value).toBe(42)
  })

  it('writes the initial value synchronously when fn is synchronous', () => {
    // AppNav and LogsView depend on this: the badge needs the initial
    // count on first paint, not after the next microtask. Pinning the
    // contract here so a refactor cannot regress it.
    const fn = vi.fn(() => ['a', 'b', 'c'])
    const { ret } = mountPoller(fn, 1_000_000)
    expect(ret.data.value).toEqual(['a', 'b', 'c'])
  })

  it('skips the immediate call when { immediate: false }', async () => {
    const fn = vi.fn(() => 'x')
    const { ret } = mountPoller(fn, 1_000_000, { immediate: false })
    await flushPromises()
    expect(fn).not.toHaveBeenCalled()
    expect(ret.data.value).toBeUndefined()
  })

  it('polls on the interval, updating data each tick', async () => {
    let n = 0
    const fn = vi.fn(() => ++n)
    const { ret } = mountPoller(fn, 100)
    await flushPromises()
    expect(ret.data.value).toBe(1) // immediate
    await vi.advanceTimersByTimeAsync(100)
    expect(ret.data.value).toBe(2)
    await vi.advanceTimersByTimeAsync(300)
    expect(ret.data.value).toBe(5)
  })

  it('awaits async fn — data only flips after the promise resolves', async () => {
    let resolveFn!: (v: number) => void
    const fn = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFn = resolve
        })
    )
    const { ret } = mountPoller(fn, 1_000_000)
    await flushPromises()
    expect(fn).toHaveBeenCalledOnce()
    expect(ret.data.value).toBeUndefined()
    resolveFn(7)
    await flushPromises()
    expect(ret.data.value).toBe(7)
  })

  it('refresh() runs fn off-interval', async () => {
    let n = 0
    const fn = vi.fn(() => ++n)
    const { ret } = mountPoller(fn, 1_000_000)
    await flushPromises()
    expect(ret.data.value).toBe(1)
    await ret.refresh()
    expect(ret.data.value).toBe(2)
    await ret.refresh()
    expect(ret.data.value).toBe(3)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('coalesces concurrent refresh() calls into a single inflight fn() run', async () => {
    let resolveFn!: (v: number) => void
    const fn = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFn = resolve
        })
    )
    const { ret } = mountPoller(fn, 1_000_000, { immediate: false })
    const a = ret.refresh()
    const b = ret.refresh()
    const c = ret.refresh()
    expect(fn).toHaveBeenCalledOnce()
    resolveFn(99)
    await Promise.all([a, b, c])
    expect(ret.data.value).toBe(99)
  })

  it('stops polling after unmount and drops any in-flight result', async () => {
    let resolveFn!: (v: number) => void
    const fn = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolveFn = resolve
        })
    )
    const { wrapper, ret } = mountPoller(fn, 100)
    expect(fn).toHaveBeenCalledOnce() // immediate call (in-flight)
    wrapper.unmount()
    // Resolve the post-unmount promise; data must not change.
    resolveFn(123)
    await flushPromises()
    expect(ret.data.value).toBeUndefined()
    // Subsequent intervals must not fire either.
    await vi.advanceTimersByTimeAsync(500)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('pauses while document.visibilityState !== "visible" and refreshes on resume', async () => {
    const visibility = { value: 'visible' as DocumentVisibilityState }
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility.value,
    })
    const fn = vi.fn(() => 'x')
    mountPoller(fn, 100)
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(1) // immediate
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(2)
    // Hide → the composable stops its interval.
    visibility.value = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(500)
    expect(fn).toHaveBeenCalledTimes(2) // no new calls while hidden
    // Show again → immediate refresh + interval resumes.
    visibility.value = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(3) // refresh on resume
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('honours { pauseOnHidden: false } and keeps polling while hidden', async () => {
    const visibility = { value: 'visible' as DocumentVisibilityState }
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility.value,
    })
    const fn = vi.fn(() => 1)
    mountPoller(fn, 100, { pauseOnHidden: false })
    await flushPromises()
    expect(fn).toHaveBeenCalledTimes(1) // immediate
    visibility.value = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(300)
    // Three more ticks even while hidden.
    expect(fn).toHaveBeenCalledTimes(4)
  })
})
