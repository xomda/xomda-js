import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { LOADING_DELAY_MS, useDelayedLoading } from '../useDelayedLoading'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDelayedLoading', () => {
  it('starts false when source is false', () => {
    const source = ref(false)
    const delayed = useDelayedLoading(source)
    expect(delayed.value).toBe(false)
  })

  it('does not flip to true if source clears within the delay', () => {
    const source = ref(false)
    const delayed = useDelayedLoading(source, 500)
    source.value = true
    vi.advanceTimersByTime(200)
    expect(delayed.value).toBe(false)
    source.value = false
    vi.advanceTimersByTime(1_000)
    expect(delayed.value).toBe(false)
  })

  it('flips to true after the delay if source stays true', () => {
    const source = ref(false)
    const delayed = useDelayedLoading(source, 500)
    source.value = true
    vi.advanceTimersByTime(499)
    expect(delayed.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(delayed.value).toBe(true)
  })

  it('flips back to false immediately when source clears', () => {
    const source = ref(false)
    const delayed = useDelayedLoading(source, 500)
    source.value = true
    vi.advanceTimersByTime(500)
    expect(delayed.value).toBe(true)
    source.value = false
    expect(delayed.value).toBe(false)
  })

  it('uses the default delay when none is provided', () => {
    const source = ref(false)
    const delayed = useDelayedLoading(source)
    source.value = true
    vi.advanceTimersByTime(LOADING_DELAY_MS - 1)
    expect(delayed.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(delayed.value).toBe(true)
  })

  it('clears its timer when the owning scope is disposed', () => {
    const source = ref(false)
    const scope = effectScope()
    let delayed!: ReturnType<typeof useDelayedLoading>
    scope.run(() => {
      delayed = useDelayedLoading(source, 500)
    })
    source.value = true
    scope.stop()
    vi.advanceTimersByTime(1_000)
    expect(delayed.value).toBe(false)
  })
})
