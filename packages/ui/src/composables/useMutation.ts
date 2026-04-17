import { createLogger } from '@xomda/util'
import { getCurrentScope, onScopeDispose, type Ref, ref } from 'vue'

import { useNotificationsStore } from '../stores/notifications'
import { type ParsedTrpcError, parseTrpcError } from './parseTrpcError'

const mutationLogger = createLogger('useMutation')

export interface MutationState<TArgs extends unknown[], TResult> {
  /** True while the most recent run is in flight. */
  loading: Ref<boolean>
  /** Parsed error from the most recent run, or null. */
  error: Ref<ParsedTrpcError | null>
  /** Result of the most recent successful run, or null. */
  data: Ref<TResult | null>
  /**
   * Run the mutation. Returns the result on success, `null` on failure
   * (parsed error and notification handled internally — callers branch on the
   * return). When a previous run is still in flight, its result is dropped
   * (last-call-wins); concurrent callers do not race over `data`/`error`.
   *
   * If the owning effect scope is disposed (e.g. component unmounts) while a
   * run is pending, the result is silently dropped — no notification, no
   * state writes.
   */
  run: (...args: TArgs) => Promise<TResult | null>
  /**
   * Cancel the in-flight run (its result is dropped on resolve) and clear
   * `error` + `data`. Useful before reopening a dialog or resetting a form.
   */
  reset: () => void
}

export interface UseMutationOptions<TArgs extends unknown[], TResult> {
  /**
   * Push a notification on failure. Default `true`. Set `false` when the
   * caller wants to render the error inline next to the form field instead.
   */
  notify?: boolean
  /** Push a success notification with this message. Omit for silent success. */
  successMessage?: string | ((result: TResult, ...args: TArgs) => string | undefined)
  /**
   * Called after a successful run. Return value is ignored. An exception
   * here is treated as a follow-up side-effect failure (a reload that
   * crashed, an invalidation that threw) — it is logged to the console
   * but does NOT mark the mutation as failed: `data` stays committed,
   * `error` stays null, and the success notification still fires.
   */
  onSuccess?: (result: TResult, ...args: TArgs) => unknown | Promise<unknown>
  /**
   * Called after a failed run. Return value is ignored. An exception here
   * is logged to the console; the original mutation error stays as the
   * reported failure.
   */
  onError?: (error: ParsedTrpcError, ...args: TArgs) => unknown | Promise<unknown>
}

/**
 * Wrap an async function (typically a tRPC mutation) with loading state,
 * structured error parsing, and optional toast surface.
 *
 * The four big wins versus inline `try/catch + loading.value = …`:
 * 1. **Failures cannot be silent.** A notification fires by default — opt out
 *    only when you're surfacing the error inline.
 * 2. **Errors are parsed consistently.** Callers get `ParsedTrpcError` with
 *    field-level Zod issues already split out, so per-field UI is trivial.
 * 3. **Last-call-wins.** Out-of-order resolutions from concurrent `run()`
 *    invocations do not stomp the latest call's `data`/`error`.
 * 4. **Unmount safety.** When the owning effect scope tears down, pending
 *    runs become no-ops — no late writes, no late notifications.
 *
 * Returns `null` from `run()` instead of re-throwing so call sites read
 * linearly (no nested try blocks).
 */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: UseMutationOptions<TArgs, TResult> = {}
): MutationState<TArgs, TResult> {
  const loading = ref(false)
  const error = ref<ParsedTrpcError | null>(null)
  const data = ref<TResult | null>(null) as Ref<TResult | null>
  const notify = options.notify ?? true

  // `callToken` advances on every `run()` and `reset()`. A pending call only
  // commits its result if its token still matches when it resolves — i.e.
  // it's the latest run AND `reset()` hasn't intervened.
  let callToken = 0
  let alive = true

  // Tear down: pending runs see a fresh token + alive=false and short-circuit.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      alive = false
      callToken++
    })
  }

  async function run(...args: TArgs): Promise<TResult | null> {
    const token = ++callToken
    /** This call is the latest one AND the owning scope is still alive. */
    const isLatest = () => alive && token === callToken
    const finishLoading = () => {
      if (isLatest()) loading.value = false
    }

    loading.value = true
    error.value = null

    // Phase 1: run the mutation. A throw here means the *mutation* failed.
    let result: TResult
    try {
      result = await fn(...args)
    } catch (e) {
      if (!isLatest()) return null
      const parsed = parseTrpcError(e)
      error.value = parsed
      if (notify) useNotificationsStore().error(parsed.message)
      await safeCallback('onError', () => options.onError?.(parsed, ...args))
      finishLoading()
      return null
    }

    if (!isLatest()) {
      finishLoading()
      return null
    }

    // Phase 2: commit success state, then run onSuccess as a post-success
    // side effect. An onSuccess exception is the consumer's problem (a
    // follow-up reload crashed), NOT a mutation failure — so it must NOT
    // flip `error.value`, push an error toast, or undo `data.value`.
    data.value = result
    if (options.successMessage) {
      const msg =
        typeof options.successMessage === 'function'
          ? options.successMessage(result, ...args)
          : options.successMessage
      if (msg) useNotificationsStore().success(msg)
    }
    await safeCallback('onSuccess', () => options.onSuccess?.(result, ...args))

    finishLoading()
    return result
  }

  /**
   * Invoke a user callback (`onSuccess` / `onError`) while isolating its
   * exceptions from the mutation's success/failure semantics — see the
   * JSDoc on {@link UseMutationOptions.onSuccess}.
   *
   * The log here is intentional and NOT subject to the AGENTS.md ban on
   * silent tRPC failures. By the time we reach this branch the mutation
   * itself has succeeded (or already failed and notified): the user's
   * callback is a developer-bug surface — a follow-up reload that
   * crashed, a stale invalidation, etc. The toast is already up; we log
   * here so the underlying bug surfaces in DevTools and the LogsView.
   */
  async function safeCallback(
    phase: 'onSuccess' | 'onError',
    invoke: () => unknown
  ): Promise<void> {
    try {
      await invoke()
    } catch (callbackErr) {
      mutationLogger.error(`${phase} callback threw`, { data: callbackErr })
    }
  }

  function reset() {
    callToken++
    error.value = null
    data.value = null
    loading.value = false
  }

  return { loading, error, data, run, reset }
}
