import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

export interface UsePollOptions {
  /**
   * Pause polling when the document is hidden
   * (`document.visibilityState !== 'visible'`). Resume on the next visible
   * tick. Default `true` — polling a hidden tab burns CPU for invisible state.
   */
  pauseOnHidden?: boolean
  /**
   * Run `fn` once at mount before the first interval tick. Default `true`.
   * Set to `false` when the caller seeds `data` from outside (e.g. a tRPC
   * query result).
   */
  immediate?: boolean
}

export interface UsePollReturn<T> {
  /** Latest result of `fn`. `undefined` until the first call resolves. */
  data: Ref<T | undefined>
  /**
   * Run `fn` now (off-interval). Resolves with the same promise the next
   * automatic tick would have. Safe to call before the first interval fires
   * and safe to call after unmount — post-unmount calls are no-ops.
   */
  refresh: () => Promise<void>
}

/**
 * Poll a function on an interval, exposing its latest result as a `Ref`.
 *
 * Replaces the recurring inline pattern:
 *
 *     let handle: ReturnType<typeof setInterval> | undefined
 *     onMounted(() => { handle = setInterval(() => …, ms) })
 *     onUnmounted(() => { if (handle) clearInterval(handle) })
 *
 * with a single composable that adds:
 * - Document-visibility pause (default on) so hidden tabs stop polling.
 * - Async-safe `refresh()` for an off-interval refresh.
 * - Strict unmount guard — post-unmount results are dropped, not written
 *   onto a stale `Ref`.
 */
export function usePoll<T>(
  fn: () => Promise<T> | T,
  intervalMs: number,
  options?: UsePollOptions
): UsePollReturn<T> {
  const data = ref<T | undefined>(undefined) as Ref<T | undefined>
  const pauseOnHidden = options?.pauseOnHidden ?? true
  const immediate = options?.immediate ?? true

  let handle: ReturnType<typeof setInterval> | undefined
  let unmounted = false
  let inFlight: Promise<void> | null = null

  function isVisible(): boolean {
    if (!pauseOnHidden) return true
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  }

  function tick(): Promise<void> {
    if (unmounted) return Promise.resolve()
    // Coalesce: if a refresh is already running, await it instead of
    // starting a second concurrent fn() call.
    if (inFlight) return inFlight
    let result: Promise<T> | T
    try {
      result = fn()
    } catch (e) {
      return Promise.reject(e)
    }
    if (!(result instanceof Promise)) {
      // Synchronous fn — write immediately so the first paint sees the
      // initial value. (`logger`-style ring counts depend on this.)
      data.value = result
      return Promise.resolve()
    }
    const job = result
      .then((r) => {
        if (!unmounted) data.value = r
      })
      .finally(() => {
        inFlight = null
      })
    inFlight = job
    return job
  }

  function start(): void {
    if (handle !== undefined) return
    handle = setInterval(() => {
      if (isVisible()) void tick()
    }, intervalMs)
  }

  function stop(): void {
    if (handle === undefined) return
    clearInterval(handle)
    handle = undefined
  }

  function onVisibilityChange(): void {
    if (unmounted) return
    if (isVisible()) {
      // Refresh immediately on re-show so the user doesn't see stale data
      // for up to `intervalMs` after switching back.
      void tick()
      start()
    } else {
      stop()
    }
  }

  onMounted(() => {
    if (immediate) void tick()
    if (isVisible()) start()
    if (pauseOnHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  })

  onBeforeUnmount(() => {
    unmounted = true
    stop()
    if (pauseOnHidden && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return { data, refresh: tick }
}
