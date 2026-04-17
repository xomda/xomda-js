import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { useAsyncState } from '../useAsyncState'

describe('useAsyncState', () => {
  it('starts with loading=false and error=null', () => {
    const { loading, error } = useAsyncState()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('returns the resolved value on success', async () => {
    const { run } = useAsyncState<number>()
    const result = await run(async () => 42)
    expect(result).toBe(42)
  })

  it('sets loading=true while running and false after', async () => {
    const { loading, run } = useAsyncState<void>()
    let loadingWhileRunning = false
    await run(async () => {
      loadingWhileRunning = loading.value
    })
    expect(loadingWhileRunning).toBe(true)
    expect(loading.value).toBe(false)
  })

  it('sets error and returns null when the function throws', async () => {
    const { error, run } = useAsyncState()
    const result = await run(async () => {
      throw new Error('boom')
    })
    expect(result).toBeNull()
    expect(error.value).toBe('boom')
  })

  it('clears the previous error on a new run', async () => {
    const { error, run } = useAsyncState()
    await run(async () => {
      throw new Error('first')
    })
    expect(error.value).toBe('first')
    await run(async () => {})
    expect(error.value).toBeNull()
  })

  it('sets loading=false even when the function throws', async () => {
    const { loading, run } = useAsyncState()
    await run(async () => {
      throw new Error('err')
    })
    expect(loading.value).toBe(false)
  })

  it('handles non-Error throws by using a fallback message', async () => {
    const { error, run } = useAsyncState()
    await run(async () => {
      throw 'string error'
    })
    expect(error.value).toBe('An unexpected error occurred')
  })

  describe('concurrency (last-call-wins)', () => {
    it('drops the result of a stale slow run when a newer run has completed', async () => {
      const { loading, error, run } = useAsyncState<number>()
      // Slow run: resolves after the fast one.
      let resolveSlow!: (n: number) => void
      const slow = new Promise<number>((r) => {
        resolveSlow = r
      })

      const slowP = run(() => slow)
      const fastP = run(async () => 2)
      const fastResult = await fastP
      expect(fastResult).toBe(2)
      expect(loading.value).toBe(false)

      resolveSlow(1)
      const slowResult = await slowP
      // Slow run no longer the latest token — result dropped, no state stomp.
      expect(slowResult).toBeNull()
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('a stale rejection cannot stomp a newer success', async () => {
      const { error, run } = useAsyncState<number>()
      let rejectSlow!: (e: Error) => void
      const slow = new Promise<number>((_, reject) => {
        rejectSlow = reject
      })

      const slowP = run(() => slow)
      const fastP = run(async () => 7)
      const fastResult = await fastP
      expect(fastResult).toBe(7)

      rejectSlow(new Error('too late'))
      const slowResult = await slowP
      expect(slowResult).toBeNull()
      expect(error.value).toBeNull()
    })
  })

  describe('unmount safety', () => {
    it('pending run resolves to null after the owning scope is disposed', async () => {
      const scope = effectScope()
      let resolveFn!: (n: number) => void
      const p = new Promise<number>((r) => {
        resolveFn = r
      })

      const stateRef = { value: undefined as ReturnType<typeof useAsyncState<number>> | undefined }
      scope.run(() => {
        stateRef.value = useAsyncState<number>()
      })
      const state = stateRef.value!

      const runP = state.run(() => p)
      scope.stop()
      resolveFn(42)
      const result = await runP

      // The result is dropped after scope dispose — no late writes.
      expect(result).toBeNull()
    })

    it('pending rejection after scope dispose is silently swallowed', async () => {
      const scope = effectScope()
      let rejectFn!: (e: Error) => void
      const p = new Promise<number>((_, reject) => {
        rejectFn = reject
      })

      const stateRef = { value: undefined as ReturnType<typeof useAsyncState<number>> | undefined }
      scope.run(() => {
        stateRef.value = useAsyncState<number>()
      })
      const state = stateRef.value!

      const runP = state.run(() => p)
      scope.stop()
      rejectFn(new Error('after dispose'))
      const result = await runP

      expect(result).toBeNull()
      // error ref MAY still hold a stale value from before dispose, but
      // the post-dispose rejection must not have written to it.
      expect(state.error.value).toBeNull()
    })
  })
})
