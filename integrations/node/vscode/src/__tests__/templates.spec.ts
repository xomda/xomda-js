import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { listTemplatesWithPaths } from '../templates'

const SAMPLE_TEMPLATE = JSON.stringify({
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'demo',
  version: '1.0.0',
  cells: [],
})

describe('listTemplatesWithPaths', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-vscode-tpl-'))
    await mkdir(join(root, '.xomda', 'templates', 'sub'), { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns an empty list when no templates directory exists', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'xomda-vscode-empty-'))
    try {
      expect(await listTemplatesWithPaths(empty)).toEqual([])
    } finally {
      await rm(empty, { recursive: true, force: true })
    }
  })

  it('walks templates recursively and pairs each Template with its path', async () => {
    const topPath = join(root, '.xomda', 'templates', 'top.template.json')
    const nestedPath = join(root, '.xomda', 'templates', 'sub', 'nested.template.json')
    await writeFile(topPath, SAMPLE_TEMPLATE)
    await writeFile(nestedPath, SAMPLE_TEMPLATE)

    const found = await listTemplatesWithPaths(root)
    const paths = found.map((t) => t.path).sort()
    expect(paths).toEqual([nestedPath, topPath].sort())
    for (const item of found) {
      expect(item.template.name).toBe('demo')
    }
  })

  it('ignores files that do not end with .template.json', async () => {
    await writeFile(join(root, '.xomda', 'templates', 'README.md'), '# not a template')
    await writeFile(join(root, '.xomda', 'templates', 'data.json'), '{}')
    const found = await listTemplatesWithPaths(root)
    expect(found).toEqual([])
  })
})
