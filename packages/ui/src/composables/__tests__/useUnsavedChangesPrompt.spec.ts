import { afterEach, describe, expect, it } from 'vitest'

import { __unsavedChangesInternals, useUnsavedChangesPrompt } from '../useUnsavedChangesPrompt'

afterEach(() => {
  __unsavedChangesInternals.state.open = false
  __unsavedChangesInternals.state.loading = false
})

describe('useUnsavedChangesPrompt', () => {
  it('opens the dialog with the configured strings', () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    promptUnsavedChanges({
      title: 'Close template?',
      message: 'You have changes.',
      saveLabel: 'Save now',
      discardLabel: 'Throw away',
      cancelLabel: 'Keep editing',
    })
    expect(__unsavedChangesInternals.state.open).toBe(true)
    expect(__unsavedChangesInternals.state.title).toBe('Close template?')
    expect(__unsavedChangesInternals.state.message).toBe('You have changes.')
    expect(__unsavedChangesInternals.state.saveLabel).toBe('Save now')
    expect(__unsavedChangesInternals.state.discardLabel).toBe('Throw away')
    expect(__unsavedChangesInternals.state.cancelLabel).toBe('Keep editing')
  })

  it('uses defaults when options are omitted', () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    promptUnsavedChanges()
    expect(__unsavedChangesInternals.state.title).toBe('Unsaved changes')
    expect(__unsavedChangesInternals.state.saveLabel).toBe('Save')
    expect(__unsavedChangesInternals.state.discardLabel).toBe('Discard')
    expect(__unsavedChangesInternals.state.cancelLabel).toBe('Cancel')
    expect(__unsavedChangesInternals.state.persistent).toBe(false)
  })

  it('resolves "save" when onSave is invoked without an action', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const promise = promptUnsavedChanges()
    await __unsavedChangesInternals.onSave()
    expect(await promise).toBe('save')
    expect(__unsavedChangesInternals.state.open).toBe(false)
  })

  it('resolves "discard" when onDiscard is invoked', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const promise = promptUnsavedChanges()
    __unsavedChangesInternals.onDiscard()
    expect(await promise).toBe('discard')
    expect(__unsavedChangesInternals.state.open).toBe(false)
  })

  it('resolves "cancel" when onCancel is invoked', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const promise = promptUnsavedChanges()
    __unsavedChangesInternals.onCancel()
    expect(await promise).toBe('cancel')
    expect(__unsavedChangesInternals.state.open).toBe(false)
  })

  it('resolves "cancel" when modelValue updates to false (Escape / backdrop)', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const promise = promptUnsavedChanges()
    __unsavedChangesInternals.onUpdateModelValue(false)
    expect(await promise).toBe('cancel')
  })

  it('runs saveAction with loading state and resolves "save" on success', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const calls: string[] = []
    const promise = promptUnsavedChanges({
      saveAction: async () => {
        calls.push(`loading=${__unsavedChangesInternals.state.loading}`)
      },
    })
    await __unsavedChangesInternals.onSave()
    expect(calls).toEqual(['loading=true'])
    expect(await promise).toBe('save')
    expect(__unsavedChangesInternals.state.open).toBe(false)
    expect(__unsavedChangesInternals.state.loading).toBe(false)
  })

  it('rejects the prompt promise and closes the dialog when saveAction throws', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const promise = promptUnsavedChanges({
      saveAction: async () => {
        throw new Error('boom')
      },
    })
    await expect(__unsavedChangesInternals.onSave()).rejects.toThrow('boom')
    await expect(promise).rejects.toThrow('boom')
    expect(__unsavedChangesInternals.state.open).toBe(false)
    expect(__unsavedChangesInternals.state.loading).toBe(false)
  })

  it('ignores cancel/discard while loading', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    let release!: () => void
    const promise = promptUnsavedChanges({
      saveAction: () => new Promise<void>((res) => (release = res)),
    })
    const running = __unsavedChangesInternals.onSave()
    expect(__unsavedChangesInternals.state.loading).toBe(true)
    __unsavedChangesInternals.onCancel()
    __unsavedChangesInternals.onDiscard()
    expect(__unsavedChangesInternals.state.open).toBe(true)
    release()
    await running
    expect(await promise).toBe('save')
  })

  it('cancels a pending prompt when a new one is opened', async () => {
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()
    const first = promptUnsavedChanges({ title: 'A' })
    promptUnsavedChanges({ title: 'B' })
    expect(await first).toBe('cancel')
    expect(__unsavedChangesInternals.state.title).toBe('B')
  })
})
