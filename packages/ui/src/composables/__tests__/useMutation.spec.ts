import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useNotificationsStore } from '../../stores/notifications'
import { useMutation } from '../useMutation'

describe('useMutation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts in idle state', () => {
    const m = useMutation(async () => 'ok')
    expect(m.loading.value).toBe(false)
    expect(m.error.value).toBeNull()
    expect(m.data.value).toBeNull()
  })

  it('toggles loading during the call and reports the result', async () => {
    let observedLoading = false
    const m = useMutation(async () => {
      observedLoading = m.loading.value
      return 42
    })
    const result = await m.run()
    expect(observedLoading).toBe(true)
    expect(result).toBe(42)
    expect(m.data.value).toBe(42)
    expect(m.loading.value).toBe(false)
  })

  it('passes args through to the wrapped function', async () => {
    const fn = vi.fn(async (a: number, b: number) => a + b)
    const m = useMutation(fn)
    const result = await m.run(2, 3)
    expect(fn).toHaveBeenCalledWith(2, 3)
    expect(result).toBe(5)
  })

  it('returns null on failure and parses the error', async () => {
    const m = useMutation(async () => {
      throw new Error('boom')
    })
    const result = await m.run()
    expect(result).toBeNull()
    expect(m.error.value).toEqual(
      expect.objectContaining({ message: 'boom', fields: [], transport: false })
    )
  })

  it('pushes an error notification by default', async () => {
    const m = useMutation(async () => {
      throw new Error('failed')
    })
    await m.run()
    const store = useNotificationsStore()
    expect(store.items).toHaveLength(1)
    expect(store.items[0].kind).toBe('error')
    expect(store.items[0].message).toBe('failed')
  })

  it('suppresses the notification when notify=false', async () => {
    const m = useMutation(
      async () => {
        throw new Error('quiet failure')
      },
      { notify: false }
    )
    await m.run()
    expect(useNotificationsStore().items).toHaveLength(0)
  })

  it('pushes a success notification when successMessage is a string', async () => {
    const m = useMutation(async () => 'value', { successMessage: 'Saved' })
    await m.run()
    const store = useNotificationsStore()
    expect(store.items.map((n) => n.kind)).toEqual(['success'])
    expect(store.items[0].message).toBe('Saved')
  })

  it('pushes a success notification when successMessage is a function', async () => {
    const m = useMutation(async (n: number) => n * 2, {
      successMessage: (r) => `Got ${r}`,
    })
    await m.run(5)
    expect(useNotificationsStore().items[0].message).toBe('Got 10')
  })

  it('skips the success notification when the success message function returns undefined', async () => {
    const m = useMutation(async () => 'x', { successMessage: () => undefined })
    await m.run()
    expect(useNotificationsStore().items).toHaveLength(0)
  })

  it('invokes onSuccess with the result and original args', async () => {
    const onSuccess = vi.fn()
    const m = useMutation(async (a: number) => a * 2, { onSuccess })
    await m.run(3)
    expect(onSuccess).toHaveBeenCalledWith(6, 3)
  })

  describe('onSuccess throwing must not report mutation as failed', () => {
    // The composable logs callback failures to console.error — silence them
    // here so the test output stays clean. The behavioural assertions below
    // are what we're really proving.
    let consoleSpy: ReturnType<typeof vi.spyOn>
    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('commits data, leaves error null, fires no error toast when onSuccess throws', async () => {
      // Scenario: the mutation itself succeeds; the consumer's onSuccess
      // callback (typically a follow-up reload / cache invalidate) throws.
      // That's a callback failure — the mutation result is correct and the
      // user should see "saved", not "save failed".
      const m = useMutation(async () => 'saved-value', {
        onSuccess: () => {
          throw new Error('reload after save crashed')
        },
      })
      const result = await m.run()
      expect(result).toBe('saved-value')
      expect(m.data.value).toBe('saved-value')
      expect(m.error.value).toBeNull()
      const errorToasts = useNotificationsStore().items.filter((n) => n.kind === 'error')
      expect(errorToasts).toEqual([])
      // The callback failure was logged for the developer.
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('still fires the configured success notification when onSuccess throws', async () => {
      const m = useMutation(async () => 'ok', {
        successMessage: 'Saved!',
        onSuccess: () => {
          throw new Error('boom')
        },
      })
      await m.run()
      const successToasts = useNotificationsStore()
        .items.filter((n) => n.kind === 'success')
        .map((n) => n.message)
      expect(successToasts).toContain('Saved!')
    })

    it('clears loading even when onSuccess rejects', async () => {
      const m = useMutation(async () => 1, {
        onSuccess: async () => {
          throw new Error('async failure')
        },
      })
      await m.run()
      expect(m.loading.value).toBe(false)
    })
  })

  it('invokes onError with the parsed error', async () => {
    const onError = vi.fn()
    const m = useMutation(
      async () => {
        throw new Error('nope')
      },
      { onError }
    )
    await m.run()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'nope' })
  })

  it('resets error and data via reset()', async () => {
    const m = useMutation(async () => 1)
    await m.run()
    expect(m.data.value).toBe(1)
    m.reset()
    expect(m.data.value).toBeNull()
    expect(m.error.value).toBeNull()
  })

  it('clears stale error before a fresh run', async () => {
    let shouldFail = true
    const m = useMutation(async () => {
      if (shouldFail) throw new Error('first')
      return 'ok'
    })
    await m.run()
    expect(m.error.value?.message).toBe('first')
    shouldFail = false
    await m.run()
    expect(m.error.value).toBeNull()
    expect(m.data.value).toBe('ok')
  })

  it('reset() between two runs clears prior error before the next run resolves', async () => {
    let shouldFail = true
    const m = useMutation(async () => {
      if (shouldFail) throw new Error('boom')
      return 'ok'
    })
    await m.run()
    expect(m.error.value?.message).toBe('boom')
    m.reset()
    expect(m.error.value).toBeNull()
    shouldFail = false
    await m.run()
    expect(m.error.value).toBeNull()
    expect(m.data.value).toBe('ok')
  })

  it('onSuccess that invokes run() again does not deadlock or double-load', async () => {
    const calls: number[] = []
    let i = 0
    const m = useMutation(
      async () => {
        const n = ++i
        calls.push(n)
        return n
      },
      {
        onSuccess: (result) => {
          // Re-entrant run on first success only; second success must not recurse.
          if (result === 1) void m.run()
        },
      }
    )
    await m.run()
    // Allow the re-entrant run to flush.
    await Promise.resolve()
    await Promise.resolve()
    expect(calls).toEqual([1, 2])
    expect(m.loading.value).toBe(false)
    expect(m.data.value).toBe(2)
  })

  it('onSuccess sees the committed result via data.value at the time of invocation', async () => {
    const seen: Array<number | null> = []
    const m = useMutation(async (n: number) => n * 10, {
      onSuccess: (_result, _args) => {
        seen.push(m.data.value)
      },
    })
    await m.run(3)
    await m.run(7)
    expect(seen).toEqual([30, 70])
  })

  describe('concurrency (last-call-wins)', () => {
    it('drops the result of an in-flight run when a newer run starts', async () => {
      const resolvers: Array<(v: string) => void> = []
      const m = useMutation(
        (label: string) =>
          new Promise<string>((res) => {
            resolvers.push(() => res(label))
          })
      )
      const first = m.run('first')
      const second = m.run('second')
      // Resolve the SECOND call's underlying promise first — its token is still
      // the latest, so its result must commit.
      resolvers[1]('second')
      expect(await second).toBe('second')
      expect(m.data.value).toBe('second')

      // Now resolve the first; it must be ignored.
      resolvers[0]('first')
      expect(await first).toBeNull()
      expect(m.data.value).toBe('second')
    })

    it('does not stomp data when a stale rejection resolves after a newer success', async () => {
      const resolvers: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = []
      const m = useMutation(
        () =>
          new Promise<string>((resolve, reject) => {
            resolvers.push({ resolve, reject })
          })
      )
      const first = m.run()
      const second = m.run()
      resolvers[1].resolve('second')
      expect(await second).toBe('second')
      // Stale rejection lands.
      resolvers[0].reject(new Error('first failure'))
      expect(await first).toBeNull()
      // error wasn't set, data still the newer success.
      expect(m.error.value).toBeNull()
      expect(m.data.value).toBe('second')
    })

    it('reset() cancels in-flight run: late resolution does not write data/error', async () => {
      let resolve!: (v: string) => void
      const m = useMutation(
        () =>
          new Promise<string>((r) => {
            resolve = r
          })
      )
      const pending = m.run()
      m.reset()
      resolve('late')
      expect(await pending).toBeNull()
      expect(m.data.value).toBeNull()
      expect(m.error.value).toBeNull()
      expect(m.loading.value).toBe(false)
    })

    it('does not push a notification on a stale failure', async () => {
      const resolvers: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = []
      const m = useMutation(
        () =>
          new Promise<string>((resolve, reject) => {
            resolvers.push({ resolve, reject })
          })
      )
      const first = m.run()
      const second = m.run()
      resolvers[1].resolve('ok')
      await second
      resolvers[0].reject(new Error('stale'))
      await first
      const errorToasts = useNotificationsStore().items.filter((n) => n.kind === 'error')
      expect(errorToasts).toEqual([])
    })
  })

  describe('unmount safety', () => {
    it('does not write data/error after the owning scope is disposed', async () => {
      let resolve!: (v: string) => void
      let m!: ReturnType<typeof useMutation<[], string>>
      const scope = effectScope()
      scope.run(() => {
        m = useMutation(
          () =>
            new Promise<string>((r) => {
              resolve = r
            })
        )
      })
      const pending = m.run()
      scope.stop()
      resolve('after-unmount')
      expect(await pending).toBeNull()
      expect(m.data.value).toBeNull()
    })

    it('does not push a notification on a rejection after unmount', async () => {
      let reject!: (e: Error) => void
      let m!: ReturnType<typeof useMutation<[], string>>
      const scope = effectScope()
      scope.run(() => {
        m = useMutation(
          () =>
            new Promise<string>((_r, rej) => {
              reject = rej
            })
        )
      })
      const pending = m.run()
      scope.stop()
      reject(new Error('post-unmount'))
      await pending
      const errorToasts = useNotificationsStore().items.filter((n) => n.kind === 'error')
      expect(errorToasts).toEqual([])
    })
  })
})
