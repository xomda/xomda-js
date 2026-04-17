import { flushPromises } from '@vue/test-utils'
import { registerAnalysisPluginClient, resetAnalysisClientRegistry } from '@xomda/analysis-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const fileTypesForMock = vi.fn()

vi.mock('../../trpc', () => ({
  trpc: {
    project: {
      fileTypesFor: {
        query: (args: { path: string }) => fileTypesForMock(args),
      },
    },
  },
}))

import { usePluginIcons } from '../usePluginIcons'

const TS_ICON = 'M0 0 L1 1'
const VITE_ICON = 'M2 2 L3 3'

beforeEach(() => {
  fileTypesForMock.mockReset()
  resetAnalysisClientRegistry()
  registerAnalysisPluginClient({ id: 'typescript', icon: TS_ICON })
  registerAnalysisPluginClient({ id: 'vite', icon: VITE_ICON })
})

afterEach(() => {
  resetAnalysisClientRegistry()
})

describe('usePluginIcons', () => {
  it('resolves icons for each path via fileTypesFor + the client registry', async () => {
    fileTypesForMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === 'src/a.ts')
        return {
          matches: [
            { pluginId: 'typescript', fileType: { id: 'ts', label: 'TypeScript' } },
            { pluginId: 'vite', fileType: { id: 'vite-overlay', label: 'Vite' } },
          ],
        }
      return { matches: [] }
    })
    const paths = ref(['src/a.ts', 'README.md'])
    const { getIcons } = usePluginIcons(paths)
    await flushPromises()
    expect(getIcons('src/a.ts')?.map((i) => i.icon)).toEqual([TS_ICON, VITE_ICON])
    expect(getIcons('README.md')).toEqual([])
  })

  it('skips plugins that do not have a client icon registered', async () => {
    fileTypesForMock.mockResolvedValue({
      matches: [
        { pluginId: 'typescript', fileType: { id: 'ts', label: 'TypeScript' } },
        { pluginId: 'unregistered', fileType: { id: 'x', label: 'Unknown' } },
      ],
    })
    const paths = ref(['src/a.ts'])
    const { getIcons } = usePluginIcons(paths)
    await flushPromises()
    expect(getIcons('src/a.ts')?.map((i) => i.icon)).toEqual([TS_ICON])
  })

  it('caches results — re-querying the same path does not hit fileTypesFor again', async () => {
    fileTypesForMock.mockResolvedValue({ matches: [] })
    const paths = ref(['src/a.ts'])
    usePluginIcons(paths)
    await flushPromises()
    expect(fileTypesForMock).toHaveBeenCalledTimes(1)

    paths.value = ['src/a.ts', 'src/b.ts']
    await nextTick()
    await flushPromises()
    // a.ts cached → only b.ts triggers a new call.
    expect(fileTypesForMock).toHaveBeenCalledTimes(2)
    expect(fileTypesForMock.mock.calls[1][0]).toEqual({ path: 'src/b.ts' })
  })

  it('swallows fileTypesFor errors so one bad path does not poison the batch', async () => {
    fileTypesForMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === 'bad') throw new Error('boom')
      return {
        matches: [{ pluginId: 'typescript', fileType: { id: 'ts', label: 'TypeScript' } }],
      }
    })
    const paths = ref(['bad', 'src/a.ts'])
    const { getIcons } = usePluginIcons(paths)
    await flushPromises()
    expect(getIcons('bad')).toBeUndefined()
    expect(getIcons('src/a.ts')?.map((i) => i.icon)).toEqual([TS_ICON])
  })

  it('dedupes matches that share a pluginId across multiple fileTypes', async () => {
    fileTypesForMock.mockResolvedValue({
      matches: [
        { pluginId: 'typescript', fileType: { id: 'ts', label: 'TypeScript' } },
        { pluginId: 'typescript', fileType: { id: 'dts', label: '.d.ts' } },
      ],
    })
    const paths = ref(['src/a.ts'])
    const { getIcons } = usePluginIcons(paths)
    await flushPromises()
    expect(getIcons('src/a.ts')).toHaveLength(1)
  })
})
