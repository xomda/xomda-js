/**
 * Bounded-concurrency task queue. Lets callers fire as many async tasks
 * as they like; the queue runs at most `maxConcurrent` at a time, draining
 * the rest in FIFO order.
 *
 * Intended for I/O fan-out — e.g. fetching package metadata for every
 * detected analysis project in parallel without flooding the upstream
 * registry. CPU-bound work that needs real parallelism should use
 * `node:worker_threads` directly; this primitive is microtask-based.
 *
 * Usage:
 *   const q = createConcurrencyQueue(8)
 *   const results = await Promise.all(projects.map(p => q.run(() => fetchMetadata(p))))
 */
export interface ConcurrencyQueue {
  /** Schedule a task. Resolves with the task's return value (or rejects). */
  run<T>(task: () => Promise<T> | T): Promise<T>
  /** Tasks currently executing. */
  readonly active: number
  /** Tasks queued but not yet started. */
  readonly pending: number
  /** Wait for the queue to fully drain. */
  drain(): Promise<void>
}

type Pending = {
  task: () => Promise<unknown> | unknown
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

export function createConcurrencyQueue(maxConcurrent: number): ConcurrencyQueue {
  if (!Number.isFinite(maxConcurrent) || maxConcurrent < 1) {
    throw new RangeError(`maxConcurrent must be >= 1, got ${maxConcurrent}`)
  }
  const queue: Pending[] = []
  let active = 0
  const drainWaiters: Array<() => void> = []

  function notifyDrain() {
    if (active === 0 && queue.length === 0) {
      for (const w of drainWaiters.splice(0)) w()
    }
  }

  function next() {
    if (active >= maxConcurrent) return
    const job = queue.shift()
    if (!job) {
      notifyDrain()
      return
    }
    active++
    Promise.resolve()
      .then(job.task)
      .then(
        (value) => {
          job.resolve(value)
        },
        (err) => {
          job.reject(err)
        }
      )
      .finally(() => {
        active--
        // Each completion drains one more slot. Re-enter so the queue
        // keeps moving while capacity is available.
        next()
      })
  }

  return {
    run<T>(task: () => Promise<T> | T): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        queue.push({
          task: task as Pending['task'],
          resolve: resolve as Pending['resolve'],
          reject,
        })
        next()
      })
    },
    get active() {
      return active
    },
    get pending() {
      return queue.length
    },
    drain(): Promise<void> {
      if (active === 0 && queue.length === 0) return Promise.resolve()
      return new Promise((resolve) => drainWaiters.push(resolve))
    },
  }
}
