import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MODEL_FILE, XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createFileStorage,
  getModelPath,
  getXomdaDir,
  readModel,
  writeModel,
} from '../file-storage'

describe('createFileStorage', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-storage-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns a default-parsed model when no file exists', async () => {
    const storage = createFileStorage(root)
    const model = await storage.read()
    expect(model.packages).toEqual([])
    expect(model.version).toBe('1.0.0')
  })

  it('writes a model to disk and stamps updatedAt', async () => {
    const storage = createFileStorage(root)
    const initial = await storage.read()
    const stored = await storage.write(initial)
    expect(stored.updatedAt).toBeTruthy()

    const onDisk = JSON.parse(await readFile(getModelPath(root), 'utf-8'))
    expect(onDisk.updatedAt).toBe(stored.updatedAt)
  })

  it('round-trips the model through read/write', async () => {
    const storage = createFileStorage(root)
    const initial = await storage.read()
    const written = await storage.write({ ...initial, name: 'Roundtrip' })
    expect(written.name).toBe('Roundtrip')

    const reloaded = await storage.read()
    expect(reloaded.name).toBe('Roundtrip')
    expect(reloaded.id).toBe(written.id)
  })

  it('skips writing when only updatedAt would change', async () => {
    const storage = createFileStorage(root)
    const initial = await storage.read()
    const first = await storage.write({ ...initial, name: 'Same' })
    // Wait a tick so a fresh stamp would be observably different.
    await new Promise((r) => setTimeout(r, 5))
    const second = await storage.write({ ...first, name: 'Same' })
    expect(second.updatedAt).toBe(first.updatedAt)

    // Sanity check: an actual change does update the stamp.
    await new Promise((r) => setTimeout(r, 5))
    const third = await storage.write({ ...second, name: 'Different' })
    expect(third.updatedAt).not.toBe(second.updatedAt)
  })

  it('skips writing when content matches but key order differs', async () => {
    const storage = createFileStorage(root)
    const initial = await storage.read()
    const first = await storage.write({ ...initial, name: 'Reordered' })
    await new Promise((r) => setTimeout(r, 5))
    // Rebuild with keys in a different insertion order — should still be a no-op.
    const reordered = Object.fromEntries(Object.entries(first).reverse()) as typeof first
    const second = await storage.write(reordered)
    expect(second.updatedAt).toBe(first.updatedAt)
  })

  it('places the model file under <root>/<XOMDA_DIR>/<MODEL_FILE>', () => {
    expect(getXomdaDir(root)).toBe(join(root, XOMDA_DIR))
    expect(getModelPath(root)).toBe(join(root, XOMDA_DIR, MODEL_FILE))
  })
})

describe('readModel/writeModel default root', () => {
  // Regression: the default root must be evaluated at call time, not at
  // module-load time, since the node server changes cwd after imports run.
  it('uses process.cwd() at call time, not at module load time', async () => {
    const tempA = await mkdtemp(join(tmpdir(), 'xomda-cwd-a-'))
    const tempB = await mkdtemp(join(tmpdir(), 'xomda-cwd-b-'))
    const originalCwd = process.cwd()
    try {
      process.chdir(tempA)
      const writtenA = await writeModel({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'A',
        version: '1.0.0',
        packages: [],
      })
      expect(writtenA.name).toBe('A')

      process.chdir(tempB)
      const readB = await readModel()
      // tempB has no model file → readModel should return a fresh default,
      // not the model written in tempA.
      expect(readB.name).toBe('Untitled Model')
      expect(readB.id).not.toBe(writtenA.id)
    } finally {
      process.chdir(originalCwd)
      await rm(tempA, { recursive: true, force: true })
      await rm(tempB, { recursive: true, force: true })
    }
  })
})
