import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Template } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { deleteTemplate, listTemplates, readTemplate, writeTemplate } from '../storage'

function makeTemplate(overrides?: Partial<Template>): Template {
  return {
    uuid: crypto.randomUUID(),
    name: 'My Template',
    version: '1.0.0',
    cells: [],
    ...overrides,
  }
}

describe('storage', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-template-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns empty list when templates dir does not exist', async () => {
    const list = await listTemplates(root)
    expect(list).toEqual([])
  })

  it('round-trips write and list', async () => {
    const t = makeTemplate()
    await writeTemplate(t, root)
    const list = await listTemplates(root)
    expect(list).toHaveLength(1)
    expect(list[0].uuid).toBe(t.uuid)
    expect(list[0].name).toBe(t.name)
    expect(list[0].cells).toEqual([])
  })

  it('reads a template by UUID', async () => {
    const t = makeTemplate({ name: 'Alpha' })
    await writeTemplate(t, root)
    const found = await readTemplate(t.uuid, root)
    expect(found.name).toBe('Alpha')
  })

  it('throws when UUID is not found', async () => {
    await expect(readTemplate('00000000-0000-0000-0000-000000000000', root)).rejects.toThrow()
  })

  it('overwrites an existing template on write', async () => {
    const t = makeTemplate({ name: 'Original' })
    await writeTemplate(t, root)

    const updated = { ...t, name: 'Updated' }
    await writeTemplate(updated, root)

    const list = await listTemplates(root)
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Updated')
  })

  it('stores multiple templates', async () => {
    const t1 = makeTemplate({ name: 'First' })
    const t2 = makeTemplate({ name: 'Second' })
    await writeTemplate(t1, root)
    await writeTemplate(t2, root)

    const list = await listTemplates(root)
    expect(list).toHaveLength(2)
    expect(list.map((t) => t.name)).toEqual(expect.arrayContaining(['First', 'Second']))
  })

  it('deletes a template by UUID', async () => {
    const t = makeTemplate()
    await writeTemplate(t, root)
    await deleteTemplate(t.uuid, root)
    const list = await listTemplates(root)
    expect(list).toHaveLength(0)
  })

  it('does not throw when deleting a non-existent UUID', async () => {
    await expect(deleteTemplate('00000000-0000-0000-0000-000000000000', root)).resolves.not.toThrow()
  })

  it('preserves cells across write/read', async () => {
    const t = makeTemplate({
      cells: [{ uuid: crypto.randomUUID(), type: 'logic', content: 'return 1' }],
    })
    await writeTemplate(t, root)
    const found = await readTemplate(t.uuid, root)
    expect(found.cells).toHaveLength(1)
    expect(found.cells[0].content).toBe('return 1')
  })
})
