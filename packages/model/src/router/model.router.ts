import { TRPCError } from '@trpc/server'
import type { Entity, Enum, Package } from '@xomda/core'
import {
  AttributeSchema,
  diffModels,
  EntitySchema,
  EnumSchema,
  LayoutEntrySchema,
  ModelSchema,
  PackageSchema,
  validateModelVersionEdit,
} from '@xomda/core'
import { z } from 'zod'

import {
  commitVersion,
  getVersion,
  listVersions,
  readModel,
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

/** Validate-then-persist. Centralises the `ModelSchema.parse` defence around writes. */
const persist = (model: unknown) => writeModel(ModelSchema.parse(model))

export const modelRouter = router({
  get: publicProcedure.query(() => readModel()),

  save: publicProcedure.input(ModelSchema).mutation(async ({ input }) => {
    const versions = await listVersions()
    const err = validateModelVersionEdit(
      input.version,
      versions.map((v) => v.label)
    )
    if (err) throw new TRPCError({ code: 'BAD_REQUEST', message: err })
    return writeModel(input)
  }),

  addEntity: publicProcedure
    .input(z.object({ packageId: z.string().uuid(), entity: EntitySchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const pkg = requirePackageById(model, input.packageId)
      pkg.entities = [...(pkg.entities ?? []), input.entity]
      return persist(model)
    }),

  updateEntity: publicProcedure.input(EntitySchema).mutation(async ({ input }) => {
    const model = await readModel()
    if (!replaceEntityById(model, input)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Entity ${input.id} not found` })
    }
    return persist(model)
  }),

  deleteEntity: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      removeEntityById(model, input.id)
      return persist(model)
    }),

  addAttribute: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attribute: AttributeSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = [...(entity.attributes ?? []), input.attribute]
      return persist(model)
    }),

  updateAttribute: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attribute: AttributeSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      const idx = entity.attributes.findIndex((a) => a.id === input.attribute.id)
      if (idx === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Attribute ${input.attribute.id} not found`,
        })
      }
      entity.attributes[idx] = input.attribute
      return persist(model)
    }),

  deleteAttribute: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attributeId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = entity.attributes.filter((a) => a.id !== input.attributeId)
      return persist(model)
    }),

  reorderAttributes: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attributeIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = reorderByIds(entity.attributes ?? [], input.attributeIds)
      return persist(model)
    }),

  addEnum: publicProcedure
    .input(z.object({ packageId: z.string().uuid(), enum: EnumSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const pkg = requirePackageById(model, input.packageId)
      pkg.enums = [...(pkg.enums ?? []), input.enum]
      return persist(model)
    }),

  updateEnum: publicProcedure.input(EnumSchema).mutation(async ({ input }) => {
    const model = await readModel()
    if (!replaceEnumById(model, input)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Enum ${input.id} not found` })
    }
    return persist(model)
  }),

  deleteEnum: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      removeEnumById(model, input.id)
      return persist(model)
    }),

  reorderEnumValues: publicProcedure
    .input(z.object({ enumId: z.string().uuid(), valueIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const en = requireEnumById(model, input.enumId)
      en.values = reorderByIds(en.values ?? [], input.valueIds)
      return persist(model)
    }),

  addPackage: publicProcedure
    .input(z.object({ parentId: z.string().uuid().optional(), package: PackageSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const container = getContainerById(model, input.parentId)
      container.packages = [...(container.packages ?? []), input.package]
      return persist(model)
    }),

  updatePackage: publicProcedure.input(PackageSchema).mutation(async ({ input }) => {
    const model = await readModel()
    const target = findPackageById(model, input.id)
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${input.id} not found` })
    }
    Object.assign(target, input)
    return persist(model)
  }),

  deletePackage: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      removePackageById(model, input.id)
      return persist(model)
    }),

  moveToPackage: publicProcedure
    .input(
      z.object({
        type: z.enum(['entity', 'enum', 'package']),
        id: z.string().uuid(),
        targetPackageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const model = await readModel()

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

      return persist(model)
    }),

  listVersions: publicProcedure.query(() => listVersions()),

  commitVersion: publicProcedure
    .input(
      z.object({
        upcomingVersion: z.string().min(1),
        message: z.string().optional(),
        author: z.string().optional(),
      })
    )
    .mutation(({ input }) => commitVersion(input)),

  getVersion: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => getVersion(input.id)),

  diffVersions: publicProcedure
    .input(z.object({ beforeId: z.string().uuid(), afterId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [before, after] = await Promise.all([
        getVersion(input.beforeId),
        getVersion(input.afterId),
      ])
      return diffModels(before.model, after.model)
    }),

  diffWithCurrent: publicProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [before, current] = await Promise.all([getVersion(input.versionId), readModel()])
      return diffModels(before.model, current)
    }),

  updateLayout: publicProcedure
    .input(z.record(z.string(), LayoutEntrySchema))
    .mutation(async ({ input }) => {
      const model = await readModel()
      return writeModel({ ...model, layout: input })
    }),
})
