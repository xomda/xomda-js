import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeModel } from '@xomda/model/storage'
import type { Template } from '@xomda/template'
import { writeTemplate } from '@xomda/template'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generate } from '../generate'

function tpl(overrides: Partial<Template>): Template {
  return {
    uuid: crypto.randomUUID(),
    name: 'T',
    version: '1.0.0',
    cells: [
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: `${overrides.name ?? 'T'}.txt`,
      },
      {
        uuid: crypto.randomUUID(),
        type: 'handlebars',
        content: 'hello',
      },
    ],
    ...overrides,
  }
}

describe('generate — skips disabled templates', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-generate-'))
    await writeModel(
      {
        id: crypto.randomUUID(),
        name: 'M',
        version: '1.0.0',
        packages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      root
    )
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('renders enabled templates and skips disabled ones', async () => {
    await writeTemplate(tpl({ name: 'enabled' }), root)
    await writeTemplate(tpl({ name: 'skipme', disabled: true }), root)

    const results = await generate(root)

    expect(results.map((r) => r.outputPath).sort()).toEqual(['enabled.txt'])
    expect(existsSync(join(root, 'enabled.txt'))).toBe(true)
    expect(existsSync(join(root, 'skipme.txt'))).toBe(false)
  })

  it('renders all templates when none are disabled', async () => {
    await writeTemplate(tpl({ name: 'a' }), root)
    await writeTemplate(tpl({ name: 'b' }), root)

    const results = await generate(root)
    expect(results.map((r) => r.outputPath).sort()).toEqual(['a.txt', 'b.txt'])
  })
})
