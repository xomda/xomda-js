import { afterEach, describe, expect, it } from 'vitest'

import { __confirmInternals, useConfirm } from '../useConfirm'

afterEach(() => {
  // reset singleton state between tests
  __confirmInternals.state.open = false
  __confirmInternals.state.loading = false
})

describe('useConfirm', () => {
  it('opens the dialog and exposes title/message in singleton state', () => {
    const { confirm } = useConfirm()
    confirm({ title: 'Hi', message: 'Body' })
    expect(__confirmInternals.state.open).toBe(true)
    expect(__confirmInternals.state.title).toBe('Hi')
    expect(__confirmInternals.state.message).toBe('Body')
  })

  it('resolves true and closes when confirm is invoked without an action', async () => {
    const { confirm } = useConfirm()
    const promise = confirm({ title: 'Hi' })
    await __confirmInternals.onConfirm()
    const result = await promise
    expect(result).toBe(true)
    expect(__confirmInternals.state.open).toBe(false)
  })

  it('resolves false when cancel is invoked', async () => {
    const { confirm } = useConfirm()
    const promise = confirm({ title: 'Hi' })
    __confirmInternals.onCancel()
    const result = await promise
    expect(result).toBe(false)
    expect(__confirmInternals.state.open).toBe(false)
  })

  it('resolves false when modelValue is updated to false (esc / outside click)', async () => {
    const { confirm } = useConfirm()
    const promise = confirm({ title: 'Hi' })
    __confirmInternals.onUpdateModelValue(false)
    expect(await promise).toBe(false)
  })

  it('runs the action with loading state and resolves true on success', async () => {
    const { confirm } = useConfirm()
    const calls: string[] = []
    const promise = confirm({
      title: 'Delete',
      action: async () => {
        calls.push(`loading=${__confirmInternals.state.loading}`)
      },
    })
    const onConfirmPromise = __confirmInternals.onConfirm()
    await onConfirmPromise
    const result = await promise
    expect(calls).toEqual(['loading=true'])
    expect(result).toBe(true)
    expect(__confirmInternals.state.open).toBe(false)
    expect(__confirmInternals.state.loading).toBe(false)
  })

  it('keeps dialog open and clears loading when action throws', async () => {
    const { confirm } = useConfirm()
    confirm({
      title: 'Delete',
      action: async () => {
        throw new Error('boom')
      },
    })
    await expect(__confirmInternals.onConfirm()).rejects.toThrow('boom')
    expect(__confirmInternals.state.open).toBe(true)
    expect(__confirmInternals.state.loading).toBe(false)
  })

  it('cancels a pending confirm when a new one is opened', async () => {
    const { confirm } = useConfirm()
    const first = confirm({ title: 'A' })
    confirm({ title: 'B' })
    expect(await first).toBe(false)
    expect(__confirmInternals.state.title).toBe('B')
  })

  it('ignores cancel while loading', async () => {
    const { confirm } = useConfirm()
    let release!: () => void
    const promise = confirm({
      title: 'Delete',
      action: () => new Promise<void>((res) => (release = res)),
    })
    const running = __confirmInternals.onConfirm()
    expect(__confirmInternals.state.loading).toBe(true)
    __confirmInternals.onCancel()
    expect(__confirmInternals.state.open).toBe(true)
    release()
    await running
    expect(await promise).toBe(true)
  })

  it('uses defaults when options omit them', () => {
    const { confirm } = useConfirm()
    confirm({ title: 'Hi' })
    expect(__confirmInternals.state.confirmLabel).toBe('Confirm')
    expect(__confirmInternals.state.cancelLabel).toBe('Cancel')
    expect(__confirmInternals.state.confirmColor).toBe('primary')
    expect(__confirmInternals.state.confirmVariant).toBe('tonal')
    expect(__confirmInternals.state.persistent).toBe(false)
  })
})
