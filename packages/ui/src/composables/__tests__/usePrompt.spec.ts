import { afterEach, describe, expect, it } from 'vitest'

import { __promptInternals, usePrompt } from '../usePrompt'

afterEach(() => {
  __promptInternals.state.open = false
  __promptInternals.state.loading = false
  __promptInternals.state.error = ''
  __promptInternals.state.value = ''
})

describe('usePrompt', () => {
  it('opens the dialog with title/message/label/placeholder in state', () => {
    const { prompt } = usePrompt()
    prompt({
      title: 'Rename',
      message: 'Pick a new name',
      label: 'Name',
      placeholder: 'New name…',
      initialValue: 'foo',
    })
    expect(__promptInternals.state.open).toBe(true)
    expect(__promptInternals.state.title).toBe('Rename')
    expect(__promptInternals.state.message).toBe('Pick a new name')
    expect(__promptInternals.state.label).toBe('Name')
    expect(__promptInternals.state.placeholder).toBe('New name…')
    expect(__promptInternals.state.value).toBe('foo')
  })

  it('uses defaults when options omit them', () => {
    const { prompt } = usePrompt()
    prompt({ title: 'X' })
    expect(__promptInternals.state.confirmLabel).toBe('OK')
    expect(__promptInternals.state.cancelLabel).toBe('Cancel')
    expect(__promptInternals.state.confirmColor).toBe('primary')
    expect(__promptInternals.state.message).toBe('')
    expect(__promptInternals.state.value).toBe('')
  })

  it('resolves with the typed value when confirmed', async () => {
    const { prompt } = usePrompt()
    const promise = prompt({ title: 'X' })
    __promptInternals.onUpdateValue('hello')
    await __promptInternals.onConfirm()
    expect(await promise).toBe('hello')
    expect(__promptInternals.state.open).toBe(false)
  })

  it('resolves null when cancelled', async () => {
    const { prompt } = usePrompt()
    const promise = prompt({ title: 'X' })
    __promptInternals.onCancel()
    expect(await promise).toBe(null)
  })

  it('resolves null when modelValue is updated to false (esc / backdrop)', async () => {
    const { prompt } = usePrompt()
    const promise = prompt({ title: 'X' })
    __promptInternals.onUpdateModelValue(false)
    expect(await promise).toBe(null)
  })

  describe('validate', () => {
    it('blocks confirm when validate returns an error message', async () => {
      const { prompt } = usePrompt()
      prompt({ title: 'X', validate: (v) => (v ? null : 'required') })
      __promptInternals.onUpdateValue('')
      await __promptInternals.onConfirm()
      expect(__promptInternals.state.error).toBe('required')
      expect(__promptInternals.state.open).toBe(true)
    })

    it('clears the error when the user updates the value', async () => {
      const { prompt } = usePrompt()
      prompt({ title: 'X', validate: (v) => (v ? null : 'required') })
      await __promptInternals.onConfirm()
      expect(__promptInternals.state.error).toBe('required')
      __promptInternals.onUpdateValue('something')
      expect(__promptInternals.state.error).toBe('')
    })

    it('allows confirm to proceed when validate passes', async () => {
      const { prompt } = usePrompt()
      const promise = prompt({ title: 'X', validate: () => null })
      __promptInternals.onUpdateValue('value')
      await __promptInternals.onConfirm()
      expect(await promise).toBe('value')
    })
  })

  describe('action', () => {
    it('runs the action, shows loading state, and resolves on success', async () => {
      const { prompt } = usePrompt()
      const seen: boolean[] = []
      const promise = prompt({
        title: 'X',
        action: async () => {
          seen.push(__promptInternals.state.loading)
        },
      })
      __promptInternals.onUpdateValue('go')
      await __promptInternals.onConfirm()
      expect(seen).toEqual([true])
      expect(await promise).toBe('go')
      expect(__promptInternals.state.loading).toBe(false)
      expect(__promptInternals.state.open).toBe(false)
    })

    it('surfaces an Error message as state.error and keeps dialog open', async () => {
      const { prompt } = usePrompt()
      prompt({
        title: 'X',
        action: async () => {
          throw new Error('nope')
        },
      })
      __promptInternals.onUpdateValue('whatever')
      await __promptInternals.onConfirm()
      expect(__promptInternals.state.error).toBe('nope')
      expect(__promptInternals.state.open).toBe(true)
      expect(__promptInternals.state.loading).toBe(false)
    })

    it('stringifies non-Error throws', async () => {
      const { prompt } = usePrompt()
      prompt({
        title: 'X',
        action: async () => {
          throw 'string error'
        },
      })
      __promptInternals.onUpdateValue('x')
      await __promptInternals.onConfirm()
      expect(__promptInternals.state.error).toBe('string error')
    })

    it('ignores cancel while loading', async () => {
      const { prompt } = usePrompt()
      let release!: () => void
      const promise = prompt({
        title: 'X',
        action: () => new Promise<void>((res) => (release = res)),
      })
      __promptInternals.onUpdateValue('go')
      const running = __promptInternals.onConfirm()
      __promptInternals.onCancel()
      expect(__promptInternals.state.open).toBe(true)
      release()
      await running
      expect(await promise).toBe('go')
    })

    it('ignores re-confirm while already loading', async () => {
      const { prompt } = usePrompt()
      const calls: number[] = []
      let release!: () => void
      const promise = prompt({
        title: 'X',
        action: () => {
          calls.push(1)
          return new Promise<void>((res) => (release = res))
        },
      })
      __promptInternals.onUpdateValue('go')
      const first = __promptInternals.onConfirm()
      const second = __promptInternals.onConfirm()
      // second should not have triggered another action
      release()
      await Promise.all([first, second])
      await promise
      expect(calls).toHaveLength(1)
    })
  })

  it('auto-cancels the pending prompt when a new one is opened', async () => {
    const { prompt } = usePrompt()
    const first = prompt({ title: 'A' })
    prompt({ title: 'B' })
    expect(await first).toBe(null)
    expect(__promptInternals.state.title).toBe('B')
  })
})
