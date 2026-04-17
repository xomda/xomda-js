import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Template } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  deleteTemplate,
  deleteTemplateFolder,
  listTemplateFolders,
  listTemplates,
  moveTemplate,
  moveTemplateFolder,
  readTemplate,
  saveTemplateFolder,
  writeTemplate,
} from '../storage'

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
    await expect(
      deleteTemplate('00000000-0000-0000-0000-000000000000', root)
    ).resolves.not.toThrow()
  })

  describe('deleteTemplateFolder', () => {
    it('removes folder, its templates, and nested subfolders', async () => {
      await saveTemplateFolder({ path: 'a', name: 'A' }, root)
      await saveTemplateFolder({ path: 'a/b', name: 'B' }, root)
      const t1 = makeTemplate({ name: 'inA' })
      const t2 = makeTemplate({ name: 'inAB' })
      const tOther = makeTemplate({ name: 'outside' })
      await writeTemplate(t1, root)
      await writeTemplate(t2, root)
      await writeTemplate(tOther, root)
      await moveTemplate(t1.uuid, 'a', root)
      await moveTemplate(t2.uuid, 'a/b', root)

      await deleteTemplateFolder('a', root)

      const templates = await listTemplates(root)
      expect(templates.map((t) => t.uuid)).toEqual([tOther.uuid])
      const folders = await listTemplateFolders(root)
      expect(folders).toHaveLength(0)
    })

    it('is a no-op when the folder does not exist', async () => {
      await expect(deleteTemplateFolder('nope', root)).resolves.not.toThrow()
    })

    it('rejects empty / dot / absolute / traversal paths', async () => {
      await expect(deleteTemplateFolder('', root)).rejects.toThrow()
      await expect(deleteTemplateFolder('.', root)).rejects.toThrow()
      await expect(deleteTemplateFolder('/etc', root)).rejects.toThrow()
      await expect(deleteTemplateFolder('../escape', root)).rejects.toThrow()
    })
  })

  describe('moveTemplate', () => {
    it('moves a template into a nested folder, preserving its filename basename', async () => {
      const t = makeTemplate({ name: 'My Template' })
      await writeTemplate(t, root)
      await saveTemplateFolder({ path: 'sub/nested', name: 'Nested' }, root)
      await moveTemplate(t.uuid, 'sub/nested', root)

      const list = await listTemplates(root)
      expect(list).toHaveLength(1)
      expect(list[0].uuid).toBe(t.uuid)
      // Folder is reflected in the stored template
      expect(list[0].folder).toBe('sub/nested')
    })

    it('moves a template back to the templates root when toFolder is empty', async () => {
      const t = makeTemplate()
      await writeTemplate(t, root)
      await saveTemplateFolder({ path: 'a', name: 'A' }, root)
      await moveTemplate(t.uuid, 'a', root)
      await moveTemplate(t.uuid, '', root)

      const reread = await readTemplate(t.uuid, root)
      expect(reread.folder).toBeUndefined()
    })

    it('throws when the template uuid is unknown', async () => {
      await expect(moveTemplate(crypto.randomUUID(), 'a', root)).rejects.toThrow(/not found/)
    })
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

  describe('filename sanitization', () => {
    it('strips special characters from template names when choosing a filename', async () => {
      const t = makeTemplate({ name: 'My/Weird*Name?!' })
      await writeTemplate(t, root)
      const files = (await readdir(join(root, '.xomda', 'templates'))).filter((f) =>
        f.endsWith('.template.json')
      )
      expect(files).toHaveLength(1)
      // Stripped of /, *, ?, !; collapses whitespace runs to single dashes.
      expect(files[0]).toMatch(/^[A-Za-z0-9_-]+\.template\.json$/)
      expect(files[0]).not.toMatch(/[*?!/]/)
    })

    it('falls back to "template.template.json" when the name strips to empty', async () => {
      const t = makeTemplate({ name: '!!!' })
      await writeTemplate(t, root)
      const files = (await readdir(join(root, '.xomda', 'templates'))).filter((f) =>
        f.endsWith('.template.json')
      )
      expect(files).toEqual(['template.template.json'])
    })

    it('keeps using the original filename on subsequent writes (does not rename on title change)', async () => {
      const t = makeTemplate({ name: 'Original Name' })
      await writeTemplate(t, root)
      const beforeFiles = (await readdir(join(root, '.xomda', 'templates'))).filter((f) =>
        f.endsWith('.template.json')
      )

      await writeTemplate({ ...t, name: 'Renamed' }, root)
      const afterFiles = (await readdir(join(root, '.xomda', 'templates'))).filter((f) =>
        f.endsWith('.template.json')
      )

      expect(afterFiles).toEqual(beforeFiles)
    })
  })

  describe('listTemplateFolders', () => {
    it('returns an empty list when the templates dir does not exist', async () => {
      expect(await listTemplateFolders(root)).toEqual([])
    })

    it('lists each folder once and preserves metadata', async () => {
      await saveTemplateFolder(
        { path: 'a', name: 'Alpha', description: 'first', tags: ['x'] },
        root
      )
      await saveTemplateFolder({ path: 'a/b', name: 'Bravo' }, root)
      const folders = await listTemplateFolders(root)
      const a = folders.find((f) => f.path === 'a')!
      expect(a.name).toBe('Alpha')
      expect(a.description).toBe('first')
      expect(a.tags).toEqual(['x'])
      const b = folders.find((f) => f.path === 'a/b')!
      expect(b.name).toBe('Bravo')
    })

    it('falls back to the directory name when metadata is missing', async () => {
      await mkdir(join(root, '.xomda', 'templates', 'no-meta'), { recursive: true })
      const folders = await listTemplateFolders(root)
      const found = folders.find((f) => f.path === 'no-meta')!
      expect(found.name).toBe('no-meta')
    })
  })

  describe('moveTemplateFolder', () => {
    it('renames a folder under templates/', async () => {
      await saveTemplateFolder({ path: 'before', name: 'Before' }, root)
      await moveTemplateFolder('before', 'after', root)
      expect(await listTemplateFolders(root)).toEqual([expect.objectContaining({ path: 'after' })])
    })

    it('moves into a nested target, creating parent dirs as needed', async () => {
      await saveTemplateFolder({ path: 'flat', name: 'Flat' }, root)
      await moveTemplateFolder('flat', 'parent/nested', root)
      const folders = await listTemplateFolders(root)
      expect(folders.map((f) => f.path)).toContain('parent/nested')
    })

    it('throws when source folder does not exist', async () => {
      await expect(moveTemplateFolder('missing', 'whatever', root)).rejects.toThrow(/not found/)
    })

    it('moves the directory and its content to the destination', async () => {
      await saveTemplateFolder({ path: 'src', name: 'Src' }, root)
      const t = makeTemplate({ name: 'inside' })
      await writeTemplate(t, root)
      await moveTemplate(t.uuid, 'src', root)
      await mkdir(join(root, '.xomda', 'templates'), { recursive: true })

      await moveTemplateFolder('src', 'dst', root)
      await expect(stat(join(root, '.xomda', 'templates', 'dst'))).resolves.toBeDefined()
    })
  })
})
