import { describe, expect, it } from 'vitest'

import { createConcurrencyQueue } from '../concurrencyQueue'

function defer<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

async function flushMicrotasks(n = 10): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

describe('createConcurrencyQueue', () => {
  it('runs at most maxConcurrent tasks in parallel', async () => {
    const q = createConcurrencyQueue(2)
    const gates = [defer(), defer(), defer(), defer()] as const
    const started: number[] = []

    const results = Promise.all(
      gates.map((g, i) =>
        q.run(async () => {
          started.push(i)
          await g.promise
          return i
        })
      )
    )

    // Microtask flush so the queue can dispatch.
    await flushMicrotasks()
    expect(started).toEqual([0, 1])

    gates[0].resolve()
    await flushMicrotasks()
    expect(started.includes(2)).toBe(true)

    gates[1].resolve()
    gates[2].resolve()
    gates[3].resolve()
    await expect(results).resolves.toEqual([0, 1, 2, 3])
  })

  it('propagates task errors as rejections', async () => {
    const q = createConcurrencyQueue(1)
    await expect(
      q.run(() => {
        throw new Error('nope')
      })
    ).rejects.toThrow('nope')
  })

  it('drain() resolves once everything finishes', async () => {
    const q = createConcurrencyQueue(2)
    const tasks = Array.from({ length: 5 }, () => q.run(async () => Promise.resolve(42)))
    await q.drain()
    await Promise.all(tasks)
    expect(q.active).toBe(0)
    expect(q.pending).toBe(0)
  })

  it('rejects maxConcurrent < 1', () => {
    expect(() => createConcurrencyQueue(0)).toThrow(RangeError)
    expect(() => createConcurrencyQueue(-3)).toThrow(RangeError)
  })
})
