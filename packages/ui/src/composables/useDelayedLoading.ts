import { onScopeDispose, type Ref, ref, watch } from 'vue'

/**
 * Default delay before a loading state becomes visible. Operations that
 * complete faster than this never flash the indicator at all, avoiding
 * layout jumps from indicators that appear and immediately disappear.
 */
export const LOADING_DELAY_MS = 500

/**
 * Wrap a boolean loading ref so it only reports `true` after a small delay,
 * and falls back to `false` immediately. Use this to drive any "is there a
 * loading indicator on screen?" decision so fast operations never flash a
 * spinner or progress bar.
 *
 * Pass the delay in ms (default `LOADING_DELAY_MS`) for cases that need
 * different timing.
 */
export function useDelayedLoading(
  source: Ref<boolean>,
  delayMs: number = LOADING_DELAY_MS
): Ref<boolean> {
  const delayed = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = (): void => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  watch(
    source,
    (value) => {
      clear()
      if (value) {
        timer = setTimeout(() => {
          delayed.value = true
          timer = null
        }, delayMs)
      } else {
        delayed.value = false
      }
    },
    { immediate: true, flush: 'sync' }
  )

  onScopeDispose(clear)

  return delayed
}
