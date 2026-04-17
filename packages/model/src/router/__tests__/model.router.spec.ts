import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  type Entity,
  type Enum,
  type Model,
  MODEL_FILE,
  type Package,
  XOMDA_DIR,
} from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { modelRouter } from '../model.router'
import { createCallerFactory } from '../trpc'

const createCaller = createCallerFactory(modelRouter)
const caller = createCaller({})

const newId = (): string => crypto.randomUUID()

const entity = (id: string, name = id): Entity => ({ id, name, attributes: [] })
const enumVal = (id: string, name = id): Enum => ({ id, name, values: [] })
const pkg = (id: string, partial: Partial<Package> = {}): Package => ({
  id,
  name: id,
  packages: [],
  enums: [],
  entities: [],
  ...partial,
})

async function seedModel(root: string, model: Partial<Model>): Promise<void> {
  const dir = join(root, XOMDA_DIR)
  await mkdir(dir, { recursive: true })
  const full: Model = {
    id: newId(),
    name: 'TestModel',
    version: '1.0.0',
    packages: [],
    ...model,
  }
  await writeFile(join(dir, MODEL_FILE), JSON.stringify(full, null, 2), 'utf-8')
}

describe('modelRouter mutations', () => {
  let tmpDir: string
  let originalCwd: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'xomda-model-router-'))
    originalCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('updateEntity', () => {
    it('replaces a nested entity by id', async () => {
      const eId = newId()
      await seedModel(tmpDir, { packages: [pkg(newId(), { entities: [entity(eId, 'Old')] })] })
      const updated = await caller.updateEntity({ id: eId, name: 'New', attributes: [] })
      expect(updated.packages[0].entities[0].name).toBe('New')
    })

    it('throws NOT_FOUND when no entity has that id', async () => {
      await seedModel(tmpDir, { packages: [pkg(newId())] })
      await expect(
        caller.updateEntity({ id: newId(), name: 'Ghost', attributes: [] })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('updateEnum', () => {
    it('replaces a nested enum by id', async () => {
      const enId = newId()
      await seedModel(tmpDir, { packages: [pkg(newId(), { enums: [enumVal(enId, 'Old')] })] })
      const updated = await caller.updateEnum({ id: enId, name: 'New', values: [] })
      expect(updated.packages[0].enums[0].name).toBe('New')
    })

    it('throws NOT_FOUND when no enum has that id', async () => {
      await seedModel(tmpDir, { packages: [pkg(newId())] })
      await expect(
        caller.updateEnum({ id: newId(), name: 'Ghost', values: [] })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('deleteEntity / deleteEnum', () => {
    it('removes a nested entity', async () => {
      const targetId = newId()
      const survivorId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(newId(), { entities: [entity(targetId), entity(survivorId)] })],
      })
      const result = await caller.deleteEntity({ id: targetId })
      expect(result.packages[0].entities.map((e) => e.id)).toEqual([survivorId])
    })

    it('removes a nested enum', async () => {
      const targetId = newId()
      const survivorId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(newId(), { enums: [enumVal(targetId), enumVal(survivorId)] })],
      })
      const result = await caller.deleteEnum({ id: targetId })
      expect(result.packages[0].enums.map((e) => e.id)).toEqual([survivorId])
    })

    it('is a no-op when the id does not exist (no throw)', async () => {
      await seedModel(tmpDir, { packages: [pkg(newId())] })
      await expect(caller.deleteEntity({ id: newId() })).resolves.toBeDefined()
    })
  })

  describe('deletePackage', () => {
    it('removes a nested package and its subtree', async () => {
      const targetId = newId()
      const survivorId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(newId(), { packages: [pkg(targetId), pkg(survivorId)] })],
      })
      const result = await caller.deletePackage({ id: targetId })
      expect(result.packages[0].packages.map((p) => p.id)).toEqual([survivorId])
    })

    it('removes a top-level package', async () => {
      const targetId = newId()
      const survivorId = newId()
      await seedModel(tmpDir, { packages: [pkg(targetId), pkg(survivorId)] })
      const result = await caller.deletePackage({ id: targetId })
      expect(result.packages.map((p) => p.id)).toEqual([survivorId])
    })
  })

  describe('moveToPackage', () => {
    it('moves an entity between packages', async () => {
      const eId = newId()
      const fromId = newId()
      const toId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(fromId, { entities: [entity(eId)] }), pkg(toId)],
      })
      const result = await caller.moveToPackage({
        type: 'entity',
        id: eId,
        targetPackageId: toId,
      })
      expect(result.packages.find((p) => p.id === fromId)!.entities).toEqual([])
      expect(result.packages.find((p) => p.id === toId)!.entities.map((e) => e.id)).toEqual([eId])
    })

    it('moves an enum between packages', async () => {
      const enId = newId()
      const fromId = newId()
      const toId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(fromId, { enums: [enumVal(enId)] }), pkg(toId)],
      })
      const result = await caller.moveToPackage({
        type: 'enum',
        id: enId,
        targetPackageId: toId,
      })
      expect(result.packages.find((p) => p.id === fromId)!.enums).toEqual([])
      expect(result.packages.find((p) => p.id === toId)!.enums.map((e) => e.id)).toEqual([enId])
    })

    it('moves a package to the model root', async () => {
      const parentId = newId()
      const childId = newId()
      await seedModel(tmpDir, { packages: [pkg(parentId, { packages: [pkg(childId)] })] })
      const result = await caller.moveToPackage({
        type: 'package',
        id: childId,
        targetPackageId: undefined,
      })
      expect(result.packages.map((p) => p.id).sort()).toEqual([parentId, childId].sort())
      expect(result.packages.find((p) => p.id === parentId)!.packages).toEqual([])
    })

    it('moves a package between containers', async () => {
      const fromId = newId()
      const toId = newId()
      const movedId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(fromId, { packages: [pkg(movedId)] }), pkg(toId)],
      })
      const result = await caller.moveToPackage({
        type: 'package',
        id: movedId,
        targetPackageId: toId,
      })
      expect(result.packages.find((p) => p.id === fromId)!.packages).toEqual([])
      expect(result.packages.find((p) => p.id === toId)!.packages.map((p) => p.id)).toEqual([
        movedId,
      ])
    })

    it('rejects moving a package into itself', async () => {
      const id = newId()
      await seedModel(tmpDir, { packages: [pkg(id)] })
      await expect(
        caller.moveToPackage({ type: 'package', id, targetPackageId: id })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('rejects moving a package into one of its descendants', async () => {
      const rootId = newId()
      const midId = newId()
      const leafId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(rootId, { packages: [pkg(midId, { packages: [pkg(leafId)] })] })],
      })
      await expect(
        caller.moveToPackage({ type: 'package', id: rootId, targetPackageId: leafId })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('throws NOT_FOUND when the moved item does not exist', async () => {
      const otherId = newId()
      await seedModel(tmpDir, { packages: [pkg(otherId)] })
      await expect(
        caller.moveToPackage({ type: 'entity', id: newId(), targetPackageId: otherId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  // Uniqueness enforcement lives in @xomda/core schemas (PackageSchema and
  // EntitySchema superRefine). The router runs ModelSchema.parse on every
  // write via `persist()`, so a duplicate name reaches the client as a
  // tRPC error with `cause.issues[]` populated — which parseTrpcError
  // turns into `ParsedTrpcError.fields`. These tests pin the contract
  // the client now relies on.
  describe('uniqueness enforcement (schema-level)', () => {
    it('rejects adding an entity whose name collides with an existing entity', async () => {
      const pkgId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(pkgId, { entities: [entity(newId(), 'Customer')] })],
      })
      await expect(
        caller.addEntity({ packageId: pkgId, entity: entity(newId(), 'Customer') })
      ).rejects.toThrow(/Customer/)
    })

    it('rejects adding an enum whose name collides with an existing entity', async () => {
      const pkgId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(pkgId, { entities: [entity(newId(), 'Status')] })],
      })
      await expect(
        caller.addEnum({ packageId: pkgId, enum: enumVal(newId(), 'Status') })
      ).rejects.toThrow(/Status/)
    })

    it('rejects adding a package whose name collides with a sibling package', async () => {
      const parentId = newId()
      await seedModel(tmpDir, {
        packages: [
          pkg(parentId, { packages: [pkg(newId(), { name: 'sub' } as Partial<Package>)] }),
        ],
      })
      const fresh = pkg(newId())
      fresh.name = 'sub'
      await expect(caller.addPackage({ parentId, package: fresh })).rejects.toThrow(/sub/)
    })

    it('rejects adding an attribute whose name collides within the entity', async () => {
      const entId = newId()
      const attrId = newId()
      await seedModel(tmpDir, {
        packages: [
          pkg(newId(), {
            entities: [
              {
                id: entId,
                name: 'Customer',
                attributes: [
                  {
                    id: attrId,
                    name: 'email',
                    type: 'string',
                    required: false,
                    multiValue: false,
                    primaryKey: false,
                    unique: false,
                  },
                ],
              },
            ],
          }),
        ],
      })
      await expect(
        caller.addAttribute({
          entityId: entId,
          attribute: {
            id: newId(),
            name: 'email',
            type: 'string',
            required: false,
            multiValue: false,
            primaryKey: false,
            unique: false,
          },
        })
      ).rejects.toThrow(/email/)
    })
  })

  // Regression guard (recurring bug — fixed three times). Saves through the
  // router must be no-ops on disk when nothing meaningful changed. If the
  // dirty check at the storage layer is ever weakened, OR if any router
  // mutation starts bypassing `writeModel` / its idempotency guarantee,
  // these tests must fail. DO NOT remove or weaken without first confirming
  // the underlying invariant is enforced elsewhere.
  describe('idempotent saves (no-op when only updatedAt would change)', () => {
    const modelPath = (): string => join(tmpDir, XOMDA_DIR, MODEL_FILE)

    it('save() does not rewrite the file when input matches what is on disk', async () => {
      // Seed by going through the router so the file gets a real updatedAt
      // stamp and any schema defaults are materialized — matches how the
      // client/server round-trip actually populates model.json.
      await seedModel(tmpDir, { name: 'Pinned', packages: [pkg(newId())] })
      const first = await caller.save({
        id: newId(),
        name: 'Pinned',
        version: '1.0.0',
        packages: [pkg(newId())],
      })

      const statBefore = await stat(modelPath())
      const bytesBefore = await readFile(modelPath(), 'utf-8')

      // Wait past coarse-mtime resolution so a real write would be visible.
      await new Promise((r) => setTimeout(r, 1100))

      // Replay the EXACT same model through the router. The dirty check at
      // the storage layer should detect that only `updatedAt` would differ
      // and skip the write entirely.
      const second = await caller.save(first)

      expect(second.updatedAt).toBe(first.updatedAt)
      const statAfter = await stat(modelPath())
      const bytesAfter = await readFile(modelPath(), 'utf-8')
      expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs)
      expect(bytesAfter).toBe(bytesBefore)
    })

    it('updateLayout() does not rewrite the file when the layout is unchanged', async () => {
      const pkgId = newId()
      await seedModel(tmpDir, {
        packages: [pkg(pkgId)],
        layout: { [pkgId]: { x: 100, y: 200 } },
      })
      // Touch through the router once so updatedAt + schema defaults settle.
      const first = await caller.updateLayout({ [pkgId]: { x: 100, y: 200 } })

      const statBefore = await stat(modelPath())
      const bytesBefore = await readFile(modelPath(), 'utf-8')

      await new Promise((r) => setTimeout(r, 1100))

      const second = await caller.updateLayout({ [pkgId]: { x: 100, y: 200 } })

      expect(second.updatedAt).toBe(first.updatedAt)
      const statAfter = await stat(modelPath())
      const bytesAfter = await readFile(modelPath(), 'utf-8')
      expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs)
      expect(bytesAfter).toBe(bytesBefore)
    })
  })
})
