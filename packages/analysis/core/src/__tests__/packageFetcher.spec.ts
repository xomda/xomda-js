import { afterEach, describe, expect, it } from 'vitest'

import {
  getRegisteredPackageFetchers,
  registerPackageFetcher,
  resetPackageFetcherRegistry,
  runPackageFetchers,
} from '../packageFetcher'
import type { DetectedProject } from '../types'

const project = (pluginId: string): DetectedProject => ({
  path: '.',
  name: 'demo',
  kinds: [pluginId],
})

afterEach(() => resetPackageFetcherRegistry())

describe('packageFetcher registry', () => {
  it('register + getRegisteredPackageFetchers round-trips', () => {
    registerPackageFetcher({ pluginId: 'node', fetchPackageData: async () => [] })
    expect(getRegisteredPackageFetchers().map((f) => f.pluginId)).toEqual(['node'])
  })

  it('dispatches one task per (plugin × project match)', async () => {
    const calls: string[] = []
    registerPackageFetcher({
      pluginId: 'node',
      async fetchPackageData(ctx) {
        calls.push(`node:${ctx.project.name}`)
        return [{ name: 'foo', version: '1' }]
      },
    })
    registerPackageFetcher({
      pluginId: 'maven',
      async fetchPackageData() {
        return [{ groupId: 'g' }]
      },
    })
    const results = await runPackageFetchers([project('node'), project('maven')], '/repo', {
      maxConcurrent: 2,
    })
    expect(results).toHaveLength(2)
    expect(calls).toEqual(['node:demo'])
    expect(results.find((r) => r.pluginId === 'node')?.packages).toHaveLength(1)
  })

  it('captures fetcher errors as result.error without throwing', async () => {
    registerPackageFetcher({
      pluginId: 'node',
      async fetchPackageData() {
        throw new Error('upstream 503')
      },
    })
    const results = await runPackageFetchers([project('node')], '/repo')
    expect(results).toHaveLength(1)
    expect(results[0].error).toBe('upstream 503')
    expect(results[0].packages).toEqual([])
  })

  it('respects pluginIds filter', async () => {
    registerPackageFetcher({ pluginId: 'node', fetchPackageData: async () => [] })
    registerPackageFetcher({ pluginId: 'maven', fetchPackageData: async () => [] })
    const results = await runPackageFetchers([project('node'), project('maven')], '/repo', {
      pluginIds: ['maven'],
    })
    expect(results.map((r) => r.pluginId)).toEqual(['maven'])
  })
})
