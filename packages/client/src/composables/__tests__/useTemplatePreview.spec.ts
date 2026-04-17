import { flushPromises } from '@vue/test-utils'
import type * as TemplatePkg from '@xomda/template'
import type { Template } from '@xomda/template'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const modelQueryMock = vi.fn()
const executeTemplateMock = vi.fn()

vi.mock('../../trpc', () => ({
  trpc: {
    model: {
      get: {
        query: () => modelQueryMock(),
      },
    },
  },
}))

vi.mock('@xomda/template', async () => {
  // Re-export the real module via passthrough; only stub `executeTemplate`.
  const actual = await vi.importActual<typeof TemplatePkg>('@xomda/template')
  return {
    ...actual,
    executeTemplate: (...args: unknown[]) => executeTemplateMock(...args),
  }
})

import { useTemplatePreview } from '../useTemplatePreview'

const baseModel = (version: string) => ({
  id: '00000000-0000-0000-0000-000000000000',
  name: 'M',
  version,
  packages: [],
})

const makeTemplate = (overrides: Partial<Template> = {}): Template => ({
  uuid: 't-1',
  name: 'Demo',
  version: '1.0.0',
  cells: [{ uuid: 'c-1', type: 'logic', content: '' }],
  ...overrides,
})

beforeEach(() => {
  modelQueryMock.mockReset()
  executeTemplateMock.mockReset()
  modelQueryMock.mockResolvedValue(baseModel('1.0.0'))
  executeTemplateMock.mockResolvedValue({ files: [], cellOutputs: [] })
  vi.useFakeTimers()
})

describe('useTemplatePreview model freshness', () => {
  it('refetches the model on every preview run so the preview reflects the current schema', async () => {
    const tpl = ref<Template | null>(makeTemplate({ name: 'first' }))
    const scope = effectScope()
    scope.run(() => useTemplatePreview(tpl))

    // First run (immediate watcher fire).
    await vi.runAllTimersAsync()
    await flushPromises()
    expect(modelQueryMock).toHaveBeenCalledTimes(1)

    // Simulate the user editing the template; the watcher's deep:true sees
    // the change and the debounce fires a fresh preview.
    tpl.value = makeTemplate({ name: 'second' })
    await vi.runAllTimersAsync()
    await flushPromises()

    // The bug: model is cached forever after the first call, so a second
    // preview run reuses yesterday's schema even though the user may have
    // edited entities/enums in ModelView in between.
    // Contract: each preview run fetches the latest model.
    expect(modelQueryMock).toHaveBeenCalledTimes(2)

    scope.stop()
  })

  it('passes the latest model into executeTemplate on each run', async () => {
    const tpl = ref<Template | null>(makeTemplate())
    modelQueryMock.mockResolvedValueOnce(baseModel('1.0.0'))
    modelQueryMock.mockResolvedValueOnce(baseModel('2.0.0'))

    const scope = effectScope()
    scope.run(() => useTemplatePreview(tpl))

    await vi.runAllTimersAsync()
    await flushPromises()
    expect(executeTemplateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ uuid: 't-1' }),
      expect.objectContaining({ version: '1.0.0' })
    )

    // Trigger another run (template edit).
    tpl.value = makeTemplate({ name: 'edited' })
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(executeTemplateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ uuid: 't-1' }),
      expect.objectContaining({ version: '2.0.0' })
    )

    scope.stop()
  })
})
