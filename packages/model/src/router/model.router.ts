import { TRPCError } from '@trpc/server'
import type { Entity, Enum, Package, Selector } from '@xomda/core'
import {
  AttributeSchema,
  diffModels,
  EntitySchema,
  EnumSchema,
  LayoutEntrySchema,
  ModelSchema,
  PackageSchema,
  SelectorSchema,
  validateModelVersionEdit,
} from '@xomda/core'
import { z } from 'zod'

import {
  commitVersion,
  createSecondaryModel,
  deleteModel,
  getVersion,
  listModelDescriptors,
  listVersions,
  ModelIdCollisionError,
  ModelNotFoundError,
  PrimaryModelDeletionError,
  readModel,
  renameModel,
  writeModel,
} from '../storage/file-storage'
import {
  findPackageById,
  getContainerById,
  isPackageDescendantOf,
  removeEntityById,
  removeEnumById,
  removePackageById,
  reorderByIds,
  replaceEntityById,
  replaceEnumById,
  requireEntityById,
  requireEnumById,
  requirePackageById,
} from './helpers'
import { publicProcedure, router } from './trpc'

/**
 * Build a Zod schema by merging the workspace selector ({ root?, modelId? })
 * into a raw object shape. Used everywhere except `save` / `updateEntity` /
 * `updateEnum` / `updatePackage`, which wrap their refined-schema payload
 * under a single field (see those procedures).
 */
function withSelectorShape<T extends z.ZodRawShape>(shape: T) {
  return z.object({ ...SelectorSchema.shape, ...shape })
}

/** Extract just the selector half of a parsed input. */
function selectorOf<T extends Selector>(input: T): Selector {
  const { root, modelId } = input
  return {
    ...(root !== undefined ? { root } : {}),
    ...(modelId !== undefined ? { modelId } : {}),
  }
}

/** Validate-then-persist. Centralises the `ModelSchema.parse` defence around writes. */
const persist = (model: unknown, selector: Selector) =>
  writeModel(ModelSchema.parse(model), selector.root, selector.modelId)

const SelectorOnlySchema = SelectorSchema

/**
 * Rewrap the multi-model storage's typed errors as TRPCErrors so the
 * client gets discriminable codes instead of a generic 500.
 */
function rewrapStorageError(err: unknown): never {
  if (err instanceof ModelNotFoundError) {
    throw new TRPCError({ code: 'NOT_FOUND', message: err.message })
  }
  if (err instanceof PrimaryModelDeletionError) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: err.message })
  }
  if (err instanceof ModelIdCollisionError) {
    throw new TRPCError({ code: 'CONFLICT', message: err.message })
  }
  throw err
}

export const modelRouter = router({
  get: publicProcedure
    .input(SelectorOnlySchema.optional())
    .query(({ input }) => readModel(input?.root, input?.modelId)),

  save: publicProcedure
    .input(withSelectorShape({ model: ModelSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const parsed = input.model
      // Version-validation reads the primary's history. Secondary models
      // share no history (Phase 1 follow-up: per-model histories), so we
      // skip the gate when the selector points at one.
      const isSecondary =
        selector.modelId !== undefined && selector.modelId !== (await readModel(selector.root)).id
      if (!isSecondary) {
        const versions = await listVersions()
        const err = validateModelVersionEdit(
          parsed.version,
          versions.map((v) => v.label)
        )
        if (err) throw new TRPCError({ code: 'BAD_REQUEST', message: err })
      }
      try {
        return await writeModel(parsed, selector.root, selector.modelId)
      } catch (err) {
        rewrapStorageError(err)
      }
    }),

  addEntity: publicProcedure
    .input(withSelectorShape({ packageId: z.string().uuid(), entity: EntitySchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const pkg = requirePackageById(model, input.packageId)
      pkg.entities = [...(pkg.entities ?? []), input.entity]
      return persist(model, selector)
    }),

  updateEntity: publicProcedure
    .input(withSelectorShape({ entity: EntitySchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const entity = input.entity
      const model = await readModel(selector.root, selector.modelId)
      if (!replaceEntityById(model, entity)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Entity ${entity.id} not found` })
      }
      return persist(model, selector)
    }),

  deleteEntity: publicProcedure
    .input(withSelectorShape({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      removeEntityById(model, input.id)
      return persist(model, selector)
    }),

  addAttribute: publicProcedure
    .input(withSelectorShape({ entityId: z.string().uuid(), attribute: AttributeSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = [...(entity.attributes ?? []), input.attribute]
      return persist(model, selector)
    }),

  updateAttribute: publicProcedure
    .input(withSelectorShape({ entityId: z.string().uuid(), attribute: AttributeSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const entity = requireEntityById(model, input.entityId)
      const idx = entity.attributes.findIndex((a) => a.id === input.attribute.id)
      if (idx === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Attribute ${input.attribute.id} not found`,
        })
      }
      entity.attributes[idx] = input.attribute
      return persist(model, selector)
    }),

  deleteAttribute: publicProcedure
    .input(withSelectorShape({ entityId: z.string().uuid(), attributeId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = entity.attributes.filter((a) => a.id !== input.attributeId)
      return persist(model, selector)
    }),

  reorderAttributes: publicProcedure
    .input(
      withSelectorShape({ entityId: z.string().uuid(), attributeIds: z.array(z.string().uuid()) })
    )
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = reorderByIds(entity.attributes ?? [], input.attributeIds)
      return persist(model, selector)
    }),

  addEnum: publicProcedure
    .input(withSelectorShape({ packageId: z.string().uuid(), enum: EnumSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const pkg = requirePackageById(model, input.packageId)
      pkg.enums = [...(pkg.enums ?? []), input.enum]
      return persist(model, selector)
    }),

  updateEnum: publicProcedure
    .input(withSelectorShape({ enum: EnumSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const en = input.enum
      const model = await readModel(selector.root, selector.modelId)
      if (!replaceEnumById(model, en)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Enum ${en.id} not found` })
      }
      return persist(model, selector)
    }),

  deleteEnum: publicProcedure
    .input(withSelectorShape({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      removeEnumById(model, input.id)
      return persist(model, selector)
    }),

  reorderEnumValues: publicProcedure
    .input(withSelectorShape({ enumId: z.string().uuid(), valueIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const en = requireEnumById(model, input.enumId)
      en.values = reorderByIds(en.values ?? [], input.valueIds)
      return persist(model, selector)
    }),

  addPackage: publicProcedure
    .input(withSelectorShape({ parentId: z.string().uuid().optional(), package: PackageSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      const container = getContainerById(model, input.parentId)
      container.packages = [...(container.packages ?? []), input.package]
      return persist(model, selector)
    }),

  updatePackage: publicProcedure
    .input(withSelectorShape({ package: PackageSchema }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const pkg = input.package
      const model = await readModel(selector.root, selector.modelId)
      const target = findPackageById(model, pkg.id)
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${pkg.id} not found` })
      }
      Object.assign(target, pkg)
      return persist(model, selector)
    }),

  deletePackage: publicProcedure
    .input(withSelectorShape({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      removePackageById(model, input.id)
      return persist(model, selector)
    }),

  moveToPackage: publicProcedure
    .input(
      withSelectorShape({
        type: z.enum(['entity', 'enum', 'package']),
        id: z.string().uuid(),
        targetPackageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)

      const item: Entity | Enum | Package | undefined =
        input.type === 'entity'
          ? removeEntityById(model, input.id)
          : input.type === 'enum'
            ? removeEnumById(model, input.id)
            : removePackageById(model, input.id)

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${input.type} ${input.id} not found`,
        })
      }

      if (input.type === 'package') {
        // Reject moving a package into itself or any of its descendants.
        if (
          input.targetPackageId &&
          isPackageDescendantOf(item as Package, { id: input.targetPackageId } as Package)
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot move a package into itself or its descendants',
          })
        }
        const targetContainer = getContainerById(model, input.targetPackageId)
        targetContainer.packages = [...(targetContainer.packages ?? []), item as Package]
      } else {
        const targetPkg = requirePackageById(model, input.targetPackageId)
        if (input.type === 'entity') {
          targetPkg.entities = [...(targetPkg.entities ?? []), item as Entity]
        } else {
          targetPkg.enums = [...(targetPkg.enums ?? []), item as Enum]
        }
      }

      return persist(model, selector)
    }),

  listVersions: publicProcedure
    .input(SelectorOnlySchema.optional())
    .query(({ input: _input }) => listVersions()),

  commitVersion: publicProcedure
    .input(
      withSelectorShape({
        upcomingVersion: z.string().min(1),
        message: z.string().optional(),
        author: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      // Per-model histories are a Phase-1 follow-up. Reject commits on
      // anything but the primary so callers get a clear message instead
      // of silently writing to the primary's history with secondary
      // data.
      if (selector.modelId !== undefined) {
        const primary = await readModel(selector.root)
        if (selector.modelId !== primary.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'Versioning is supported only on the project primary model in this release. Per-model histories are a follow-up.',
          })
        }
      }
      return commitVersion({
        upcomingVersion: input.upcomingVersion,
        ...(input.message !== undefined ? { message: input.message } : {}),
        ...(input.author !== undefined ? { author: input.author } : {}),
      })
    }),

  getVersion: publicProcedure
    .input(withSelectorShape({ id: z.string().uuid() }))
    .query(({ input }) => getVersion(input.id)),

  diffVersions: publicProcedure
    .input(withSelectorShape({ beforeId: z.string().uuid(), afterId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [before, after] = await Promise.all([
        getVersion(input.beforeId),
        getVersion(input.afterId),
      ])
      return diffModels(before.model, after.model)
    }),

  diffWithCurrent: publicProcedure
    .input(withSelectorShape({ versionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const selector = selectorOf(input)
      const [before, current] = await Promise.all([
        getVersion(input.versionId),
        readModel(selector.root, selector.modelId),
      ])
      return diffModels(before.model, current)
    }),

  updateLayout: publicProcedure
    .input(withSelectorShape({ layout: z.record(z.string(), LayoutEntrySchema) }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const model = await readModel(selector.root, selector.modelId)
      return writeModel({ ...model, layout: input.layout }, selector.root, selector.modelId)
    }),

  // ─── Multi-model surface ─────────────────────────────────────────────────

  /** List every model in the project as a lightweight descriptor. */
  listModels: publicProcedure
    .input(SelectorOnlySchema.optional())
    .query(({ input }) => listModelDescriptors(input?.root)),

  /** Create a new secondary model under `.xomda/models/<id>.json`. */
  createModel: publicProcedure
    .input(withSelectorShape({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const selector = selectorOf(input)
      const root = selector.root ?? process.cwd()
      try {
        const created = await createSecondaryModel(root, { name: input.name })
        return {
          id: created.id,
          name: created.name,
          version: created.version,
          ...(created.updatedAt !== undefined ? { updatedAt: created.updatedAt } : {}),
          isPrimary: false,
        }
      } catch (err) {
        rewrapStorageError(err)
      }
    }),

  /** Rename a model (primary or secondary) by id. */
  renameModel: publicProcedure
    .input(
      z.object({
        root: z.string().optional(),
        modelId: z.string().uuid(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const root = input.root ?? process.cwd()
      try {
        const renamed = await renameModel(root, input.modelId, input.name)
        // Look up `isPrimary` after the write so the response shape matches
        // `createModel` and the client doesn't need a follow-up `listModels`
        // round-trip to know which one was renamed.
        const descriptors = await listModelDescriptors(root)
        const descriptor = descriptors.find((d) => d.id === renamed.id)
        return {
          id: renamed.id,
          name: renamed.name,
          version: renamed.version,
          ...(renamed.updatedAt !== undefined ? { updatedAt: renamed.updatedAt } : {}),
          isPrimary: descriptor?.isPrimary ?? false,
        }
      } catch (err) {
        rewrapStorageError(err)
      }
    }),

  /**
   * Delete a model by id. Refuses to delete the primary while secondary
   * models exist (storage layer enforces; we rewrap as BAD_REQUEST).
   */
  deleteModel: publicProcedure
    .input(z.object({ root: z.string().optional(), modelId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const root = input.root ?? process.cwd()
      try {
        await deleteModel(root, input.modelId)
        return { ok: true as const }
      } catch (err) {
        rewrapStorageError(err)
      }
    }),
})
