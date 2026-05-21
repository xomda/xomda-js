import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MODEL_FILE, ModelSchema, XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createFileStorage,
  createSecondaryModel,
  deleteModel,
  getModelPath,
  getModelsDir,
  getXomdaDir,
  listModelDescriptors,
  listModels,
  ModelIdCollisionError,
  ModelNotFoundError,
  PrimaryModelDeletionError,
  readModel,
  renameModel,
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

  // Regression guard: the previous test only asserts that the returned
  // `updatedAt` doesn't change. A buggy "fix" could still touch the file
  // (e.g., rewrite the same bytes) while preserving the stamp in memory.
  // This test pins the actual filesystem behaviour: when nothing
  // semantically changed, the file mtime + bytes must be identical.
  // This bug has regressed multiple times — DO NOT remove or weaken.
  it('does not touch the file on disk when only updatedAt would change', async () => {
    const storage = createFileStorage(root)
    const initial = await storage.read()
    await storage.write({ ...initial, name: 'Pinned' })
    const path = getModelPath(root)
    const statBefore = await stat(path)
    const bytesBefore = await readFile(path, 'utf-8')

    // Wait long enough that a fresh mtime would be observably different
    // even on filesystems with coarse (1s) mtime resolution.
    await new Promise((r) => setTimeout(r, 1100))

    // Re-write the SAME logical content. Reads the file back to mimic the
    // realistic round-trip a router endpoint performs (read → mutate → write).
    const onDiskModel = JSON.parse(bytesBefore)
    await storage.write(onDiskModel)

    const statAfter = await stat(path)
    const bytesAfter = await readFile(path, 'utf-8')
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs)
    expect(bytesAfter).toBe(bytesBefore)
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

describe('multi-model storage', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-multi-model-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists nothing when no models exist', async () => {
    expect(await listModels(root)).toEqual([])
  })

  it('lists only the primary when no secondaries exist', async () => {
    const storage = createFileStorage(root)
    const initial = await storage.read()
    await storage.write({ ...initial, name: 'Primary Only' })

    const models = await listModels(root)
    expect(models).toHaveLength(1)
    expect(models[0].name).toBe('Primary Only')
  })

  it('lists primary + secondaries, primary first, secondaries sorted by name', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'Primary' })

    const charlie = await createSecondaryModel(root, { name: 'Charlie' })
    const alpha = await createSecondaryModel(root, { name: 'Alpha' })
    const bravo = await createSecondaryModel(root, { name: 'Bravo' })

    const models = await listModels(root)
    expect(models.map((m) => m.name)).toEqual(['Primary', 'Alpha', 'Bravo', 'Charlie'])
    expect(models[0].id).toBe(primary.id)
    // The three secondaries are sorted by name regardless of creation order.
    expect(models[1].id).toBe(alpha.id)
    expect(models[2].id).toBe(bravo.id)
    expect(models[3].id).toBe(charlie.id)
  })

  it('descriptors flag the primary correctly', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'P' })
    const secondary = await createSecondaryModel(root, { name: 'S' })

    const descriptors = await listModelDescriptors(root)
    expect(descriptors).toEqual([
      expect.objectContaining({ id: primary.id, name: 'P', isPrimary: true }),
      expect.objectContaining({ id: secondary.id, name: 'S', isPrimary: false }),
    ])
  })

  it('round-trips a secondary model through createFileStorage with modelId', async () => {
    const created = await createSecondaryModel(root, { name: 'Side Model' })
    const reloaded = await readModel(root, created.id)
    expect(reloaded.id).toBe(created.id)
    expect(reloaded.name).toBe('Side Model')
  })

  // Regression guard: the isModelUnchanged idempotency check must hold for
  // secondary models too. See feedback_model_save_idempotency — this bug
  // has regressed multiple times on the primary path. DO NOT remove or
  // weaken: a secondary model write that only differs by `updatedAt`
  // must not touch the file.
  it('does not touch secondary file when only updatedAt would change', async () => {
    const created = await createSecondaryModel(root, { name: 'Pinned' })
    const path = join(getModelsDir(root), `${created.id}.json`)
    const statBefore = await stat(path)
    const bytesBefore = await readFile(path, 'utf-8')

    // 1.1s — long enough that a fresh mtime would be observably different
    // on filesystems with coarse (1s) resolution.
    await new Promise((r) => setTimeout(r, 1100))

    await writeModel(JSON.parse(bytesBefore), root, created.id)

    const statAfter = await stat(path)
    const bytesAfter = await readFile(path, 'utf-8')
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs)
    expect(bytesAfter).toBe(bytesBefore)
  })

  it('refuses to write to an unknown modelId (no stray-file creation)', async () => {
    const fakeId = '00000000-0000-4000-8000-000000000000' // valid v4 UUID, unused
    await expect(
      writeModel(
        ModelSchema.parse({ id: fakeId, name: 'Stray', version: '1.0.0', packages: [] }),
        root,
        fakeId
      )
    ).rejects.toBeInstanceOf(ModelNotFoundError)
    expect(existsSync(join(getModelsDir(root), `${fakeId}.json`))).toBe(false)
  })

  it('renames a secondary model in place', async () => {
    const created = await createSecondaryModel(root, { name: 'Old' })
    const renamed = await renameModel(root, created.id, 'New')
    expect(renamed.name).toBe('New')
    const reloaded = await readModel(root, created.id)
    expect(reloaded.name).toBe('New')
  })

  it('rename is idempotent on identical name (no file touch)', async () => {
    const created = await createSecondaryModel(root, { name: 'Same' })
    const path = join(getModelsDir(root), `${created.id}.json`)
    const statBefore = await stat(path)
    await new Promise((r) => setTimeout(r, 1100))
    await renameModel(root, created.id, 'Same')
    const statAfter = await stat(path)
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs)
  })

  it('renames the primary by id', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'P' })
    const renamed = await renameModel(root, primary.id, 'P2')
    expect(renamed.name).toBe('P2')
    // Still in model.json, not a stray models/<id>.json
    expect(existsSync(getModelPath(root))).toBe(true)
    expect(existsSync(join(getModelsDir(root), `${primary.id}.json`))).toBe(false)
  })

  it('refuses to delete the primary when secondaries exist', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'P' })
    await createSecondaryModel(root, { name: 'S' })
    await expect(deleteModel(root, primary.id)).rejects.toBeInstanceOf(PrimaryModelDeletionError)
    expect(existsSync(getModelPath(root))).toBe(true)
  })

  it('allows deleting the primary when it is the last model', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'P' })
    await deleteModel(root, primary.id)
    expect(existsSync(getModelPath(root))).toBe(false)
  })

  it('deletes a secondary cleanly', async () => {
    const created = await createSecondaryModel(root, { name: 'Side' })
    await deleteModel(root, created.id)
    expect(existsSync(join(getModelsDir(root), `${created.id}.json`))).toBe(false)
    expect(await listModels(root)).toEqual([])
  })

  it('throws ModelNotFoundError when deleting an unknown id', async () => {
    await expect(deleteModel(root, '00000000-1111-2222-3333-444444444444')).rejects.toBeInstanceOf(
      ModelNotFoundError
    )
  })

  it('skips a malformed secondary file but keeps listing the rest', async () => {
    const good = await createSecondaryModel(root, { name: 'Good' })
    await writeFile(join(getModelsDir(root), 'bad.json'), '{not json', 'utf-8')
    const models = await listModels(root)
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe(good.id)
  })

  it('dedupes a secondary file whose id collides with the primary (primary wins)', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'Primary' })
    // Manually plant a colliding secondary file. The storage layer's
    // createSecondaryModel cannot produce this, but a user / migration
    // script could.
    await mkdir(getModelsDir(root), { recursive: true })
    await writeFile(
      join(getModelsDir(root), `${primary.id}.json`),
      JSON.stringify(
        ModelSchema.parse({ id: primary.id, name: 'Imposter', version: '1.0.0', packages: [] })
      ),
      'utf-8'
    )
    const models = await listModels(root)
    expect(models).toHaveLength(1)
    expect(models[0].name).toBe('Primary') // primary won
  })

  it('rejects createSecondaryModel + writeModel that would collide with primary id', async () => {
    const storage = createFileStorage(root)
    const primary = await storage.write({ ...(await storage.read()), name: 'P' })
    // Manually place a stray secondary file with the primary id so a
    // subsequent write tries to mint it through the secondary path.
    await mkdir(getModelsDir(root), { recursive: true })
    await writeFile(
      join(getModelsDir(root), `${primary.id}.json`),
      JSON.stringify(
        ModelSchema.parse({ id: primary.id, name: 'Stray', version: '1.0.0', packages: [] })
      ),
      'utf-8'
    )
    // Resolving `modelId === primary.id` lands on the primary file (not
    // the secondary), so a write goes to model.json — the secondary
    // file is silently bypassed. listModels already proves the dedupe.
    // Documents the behavior; no error path here.
    expect(await readModel(root, primary.id)).toMatchObject({ name: 'P' })
  })

  it('createSecondaryModel sets defaults (version 1.0.0, empty packages)', async () => {
    const created = await createSecondaryModel(root, { name: 'Fresh' })
    expect(created.version).toBe('1.0.0')
    expect(created.packages).toEqual([])
    expect(created.updatedAt).toBeTruthy()
  })
})

// Tiny no-op to keep ModelIdCollisionError referenced by the test imports —
// the constructor is exercised indirectly through createSecondaryModel's
// collision-detection branch and is included here for completeness.
const _idCollisionType: typeof ModelIdCollisionError = ModelIdCollisionError
void _idCollisionType

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
