import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { DetectedProject } from '@xomda/analysis-core'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchPackageData } from '../npm-fetcher'

const tmp = mkdtempSync(join(tmpdir(), 'xomda-npm-fetcher-'))

afterAll(() => rmSync(tmp, { recursive: true, force: true }))
afterEach(() => vi.restoreAllMocks())

function writePkg(contents: object) {
  writeFileSync(join(tmp, 'package.json'), JSON.stringify(contents))
}

const project: DetectedProject = { path: '.', name: 'demo', kinds: ['node'] }

beforeEach(() => {
  // jsdom and Node both expose `fetch` globally now; spy on it.
  globalThis.fetch = vi.fn() as typeof fetch
})

describe('node npm-fetcher', () => {
  it('returns one record per declared dependency', async () => {
    writePkg({
      name: 'demo',
      dependencies: { lodash: '^4.17.0', zod: '3.22.0' },
      devDependencies: { vitest: '^1.0.0' },
    })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        const name = decodeURIComponent(url.split('/').slice(-2, -1)[0])
        return new Response(JSON.stringify({ version: `${name}-LATEST`, license: 'MIT' }), {
          status: 200,
        })
      }
    )
    const results = await fetchPackageData({ rootPath: tmp, project })
    const byName = Object.fromEntries(results.map((r) => [r.name as string, r]))
    expect(Object.keys(byName).sort()).toEqual(['lodash', 'vitest', 'zod'])
    expect(byName.lodash).toMatchObject({ range: '^4.17.0', scope: 'dep', latest: 'lodash-LATEST' })
    expect(byName.vitest).toMatchObject({ scope: 'devDep' })
  })

  it('captures per-package errors without aborting the batch', async () => {
    writePkg({ dependencies: { good: '^1', bad: '^2' } })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url.includes('bad'))
          return new Response('boom', { status: 500, statusText: 'Server Error' })
        return new Response(JSON.stringify({ version: '1.2.3' }), { status: 200 })
      }
    )
    const results = await fetchPackageData({ rootPath: tmp, project })
    const byName = Object.fromEntries(results.map((r) => [r.name as string, r]))
    expect(byName.good).toMatchObject({ latest: '1.2.3' })
    expect(byName.bad.error).toMatch(/500/)
    expect(byName.bad.latest).toBeUndefined()
  })

  it('returns empty when package.json is unreadable', async () => {
    const empty: DetectedProject = { path: 'missing', name: 'gone', kinds: ['node'] }
    const results = await fetchPackageData({ rootPath: tmp, project: empty })
    expect(results).toEqual([])
  })

  it('skips packages the registry has unpublished (404)', async () => {
    writePkg({ dependencies: { 'never-existed': '^1' } })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('not found', { status: 404 })
    )
    const results = await fetchPackageData({ rootPath: tmp, project })
    expect(results).toHaveLength(1)
    expect(results[0].latest).toBeUndefined()
    expect(results[0].error).toBeUndefined()
  })
})
