import { getCurrentScope, onScopeDispose, type Ref, ref } from 'vue'

export interface AsyncState<T> {
  /** True while the most recent run is in flight. */
  loading: Ref<boolean>
  /**
   * Error message from the most recent run, or null. Stringly-typed by
   * design — `useAsyncState` is the no-Pinia primitive; `useMutation`
   * is the typed-error layer for tRPC.
   */
  error: Ref<string | null>
  /**
   * Run the wrapped function. Returns the result on success, `null` on
   * failure (caller can branch on the return). When a previous run is
   * still in flight, its resolution is dropped (last-call-wins);
   * concurrent callers do not race over `loading`/`error`.
   *
   * If the owning effect scope is disposed (e.g. component unmounts)
   * while a run is pending, the result is silently dropped — no late
   * writes to `loading` or `error`.
   */
  run: (fn: () => Promise<T>) => Promise<T | null>
}

/**
 * Loading/error state for a one-shot async operation without notifications.
 *
 * **When to use which:**
 *
 * | Need | Composable |
 * |---|---|
 * | Wrap a `trpc.*.mutate()` / `trpc.*.query()` call | `useMutation` |
 * | Local async with custom inline error UI, no toast | `useAsyncState` |
 * | One-shot read with parsed error and toast | `useMutation` (parsed error is useful even for queries) |
 *
 * Structural difference: `useMutation` parses tRPC errors into typed
 * `ParsedTrpcError`, pushes notifications by default, and gives the same
 * concurrency/unmount safety. `useAsyncState` is the primitive — pure,
 * Pinia-free, error is a plain string. Prefer `useMutation` for anything
 * that talks to the server; reach for `useAsyncState` for client-only
 * promises (decoding a file, awaiting an animation, etc.).
 */
export function useAsyncState<T = void>(): AsyncState<T> {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // `callToken` advances on every `run()`. A pending call only commits
  // its result if its token still matches when it resolves — i.e. it's
  // the latest run AND the owning scope hasn't been torn down.
  let callToken = 0
  let alive = true

  if (getCurrentScope()) {
    onScopeDispose(() => {
      alive = false
      callToken++
    })
  }

  async function run(fn: () => Promise<T>): Promise<T | null> {
    const token = ++callToken
    const isLatest = () => alive && token === callToken
    loading.value = true
    error.value = null
    try {
      const result = await fn()
      if (!isLatest()) return null
      return result
    } catch (e) {
      if (!isLatest()) return null
      error.value = e instanceof Error ? e.message : 'An unexpected error occurred'
      return null
    } finally {
      if (isLatest()) loading.value = false
    }
  }

  return { loading, error, run }
}
