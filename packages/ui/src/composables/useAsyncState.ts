import { type Ref, ref } from 'vue'

export interface AsyncState<T> {
  loading: Ref<boolean>
  error: Ref<string | null>
  execute: (fn: () => Promise<T>) => Promise<T | null>
}

/**
 * Encapsulates the loading/error state pattern for async operations.
 * Returns `null` and sets `error` if the operation throws.
 */
export function useAsyncState<T = void>(): AsyncState<T> {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function execute(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'An unexpected error occurred'
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, execute }
}
