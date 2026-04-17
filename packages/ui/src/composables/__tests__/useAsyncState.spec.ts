import { describe, expect, it } from 'vitest'

import { useAsyncState } from '../useAsyncState'

describe('useAsyncState', () => {
  it('starts with loading=false and error=null', () => {
    const { loading, error } = useAsyncState()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('returns the resolved value on success', async () => {
    const { execute } = useAsyncState<number>()
    const result = await execute(async () => 42)
    expect(result).toBe(42)
  })

  it('sets loading=true while executing and false after', async () => {
    const { loading, execute } = useAsyncState<void>()
    let duringExecution = false
    await execute(async () => {
      duringExecution = loading.value
    })
    expect(duringExecution).toBe(true)
    expect(loading.value).toBe(false)
  })

  it('sets error and returns null when the function throws', async () => {
    const { error, execute } = useAsyncState()
    const result = await execute(async () => {
      throw new Error('boom')
    })
    expect(result).toBeNull()
    expect(error.value).toBe('boom')
    expect(error.value).not.toBeNull()
  })

  it('clears the previous error on a new execute', async () => {
    const { error, execute } = useAsyncState()
    await execute(async () => {
      throw new Error('first')
    })
    expect(error.value).toBe('first')
    await execute(async () => {})
    expect(error.value).toBeNull()
  })

  it('sets loading=false even when the function throws', async () => {
    const { loading, execute } = useAsyncState()
    await execute(async () => {
      throw new Error('err')
    })
    expect(loading.value).toBe(false)
  })

  it('handles non-Error throws by using a fallback message', async () => {
    const { error, execute } = useAsyncState()
    await execute(async () => {
      throw 'string error'
    })
    expect(error.value).toBe('An unexpected error occurred')
  })
})
