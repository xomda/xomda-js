import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MODEL_FILE, type Template, XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { templateRouter } from '../template.router'
import { createCallerFactory } from '../trpc'

const createCaller = createCallerFactory(templateRouter)
const caller = createCaller({})

const newId = (): string => crypto.randomUUID()

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    uuid: newId(),
    name: 'My Template',
    version: '1.0.0',
    cells: [],
    ...overrides,
  }
}

async function seedModel(root: string, body: object = {}): Promise<void> {
  const dir = join(root, XOMDA_DIR)
  await mkdir(dir, { recursive: true })
  const model = {
    id: newId(),
    name: 'M',
    version: '1.0.0',
    packages: [],
    ...body,
  }
  await writeFile(join(dir, MODEL_FILE), JSON.stringify(model, null, 2), 'utf-8')
}

describe('templateRouter', () => {
  let tmpDir: string
  let originalCwd: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'xomda-template-router-'))
    originalCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('list / save / get / delete', () => {
    it('starts empty', async () => {
      expect(await caller.list()).toEqual([])
    })

    it('save persists a template that list / get can read back', async () => {
      const t = makeTemplate({ name: 'Alpha' })
      await caller.save(t)
      const all = await caller.list()
      expect(all.map((x) => x.uuid)).toEqual([t.uuid])
      const single = await caller.get(t.uuid)
      expect(single.name).toBe('Alpha')
    })

    it('save can update an existing template (same uuid)', async () => {
      const t = makeTemplate({ name: 'V1' })
      await caller.save(t)
      await caller.save({ ...t, name: 'V2' })
      const reread = await caller.get(t.uuid)
      expect(reread.name).toBe('V2')
    })

    it('delete removes a template', async () => {
      const t = makeTemplate()
      await caller.save(t)
      await caller.delete(t.uuid)
      expect(await caller.list()).toEqual([])
    })

    it('get throws for an unknown uuid', async () => {
      await expect(caller.get(newId())).rejects.toThrow(/not found/i)
    })
  })

  describe('folder operations', () => {
    it('saveFolder + listFolders round-trip with metadata preserved', async () => {
      await caller.saveFolder({
        path: 'shared/utils',
        name: 'Utilities',
        description: 'misc',
        tags: ['core'],
      })
      const folders = await caller.listFolders()
      expect(folders.map((f) => f.path)).toContain('shared/utils')
      const found = folders.find((f) => f.path === 'shared/utils')!
      expect(found.name).toBe('Utilities')
      expect(found.description).toBe('misc')
      expect(found.tags).toEqual(['core'])
    })

    it('move places a template inside a folder', async () => {
      const t = makeTemplate({ name: 'movable' })
      await caller.save(t)
      await caller.saveFolder({ path: 'archive', name: 'Archive' })
      await caller.move({ uuid: t.uuid, folder: 'archive' })
      const reread = await caller.get(t.uuid)
      expect(reread.folder).toBe('archive')
    })

    it('moveFolder renames a folder', async () => {
      await caller.saveFolder({ path: 'old', name: 'Old' })
      await caller.moveFolder({ from: 'old', to: 'new/path' })
      const folders = await caller.listFolders()
      expect(folders.map((f) => f.path)).toContain('new/path')
      expect(folders.map((f) => f.path)).not.toContain('old')
    })

    it('deleteFolder removes a folder and any templates inside', async () => {
      await caller.saveFolder({ path: 'gone', name: 'Gone' })
      const t = makeTemplate()
      await caller.save(t)
      await caller.move({ uuid: t.uuid, folder: 'gone' })

      await caller.deleteFolder({ path: 'gone' })

      expect(await caller.listFolders()).toEqual([])
      expect(await caller.list()).toEqual([])
    })

    it('deleteFolder rejects path traversal / absolute paths', async () => {
      await expect(caller.deleteFolder({ path: '../escape' })).rejects.toThrow()
      await expect(caller.deleteFolder({ path: '/etc' })).rejects.toThrow()
    })
  })

  describe('preview / generate', () => {
    it('preview returns an empty list when no templates exist', async () => {
      await seedModel(tmpDir)
      expect(await caller.preview()).toEqual([])
    })

    it('preview skips disabled templates', async () => {
      await seedModel(tmpDir)
      const cells = [
        { uuid: newId(), type: 'logic' as const, content: "$out.write('body')" },
        {
          uuid: newId(),
          type: 'output' as const,
          content: '',
          outputType: 'file' as const,
          outputFilename: 'out.txt',
        },
      ]
      await caller.save({ uuid: newId(), name: 'active', version: '1.0.0', cells })
      await caller.save({
        uuid: newId(),
        name: 'disabled',
        version: '1.0.0',
        cells,
        disabled: true,
      })

      const results = await caller.preview()
      expect(results.length).toBe(1)
      expect(results[0].outputPath).toBe('out.txt')
    })

    it('generate writes rendered results to disk and returns them', async () => {
      await seedModel(tmpDir)
      await caller.save({
        uuid: newId(),
        name: 'gen',
        version: '1.0.0',
        cells: [
          { uuid: newId(), type: 'logic', content: "$out.write('persisted body')" },
          {
            uuid: newId(),
            type: 'output',
            content: '',
            outputType: 'file',
            outputFilename: 'generated/out.txt',
          },
        ],
      })

      const results = await caller.generate()
      expect(results.length).toBe(1)
      expect(results[0].outputPath).toBe('generated/out.txt')

      const onDisk = await readFile(join(tmpDir, 'generated', 'out.txt'), 'utf-8')
      expect(onDisk).toBe('persisted body')
    })
  })
})
