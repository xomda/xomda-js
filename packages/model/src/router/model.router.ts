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
  appendToElementsOrder,
  type Container,
  findPackageById,
  getContainerById,
  isPackage,
  removeFromElementsOrder,
  reorderByIds,
  requireEntityById,
  requireEnumById,
  requirePackageById,
} from './helpers'
import { publicProcedure, router } from './trpc'

export const modelRouter = router({
  get: publicProcedure.query(() => readModel()),

  save: publicProcedure.input(ModelSchema).mutation(({ input }) => writeModel(input)),

  addEntity: publicProcedure
    .input(z.object({ packageId: z.string().uuid(), entity: EntitySchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const pkg = requirePackageById(model, input.packageId)
      pkg.entities = [...(pkg.entities ?? []), input.entity]
      appendToElementsOrder(pkg, input.entity.id)
      return writeModel(ModelSchema.parse(model))
    }),

  updateEntity: publicProcedure.input(EntitySchema).mutation(async ({ input }) => {
    const model = await readModel()
    const updateInPackages = (packages: Package[]): boolean => {
      for (const pkg of packages) {
        const idx = (pkg.entities ?? []).findIndex((e: Entity) => e.id === input.id)
        if (idx !== -1) {
          pkg.entities![idx] = input
          return true
        }
        if (pkg.packages && updateInPackages(pkg.packages)) return true
      }
      return false
    }
    if (!updateInPackages(model.packages)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Entity ${input.id} not found` })
    }
    return writeModel(ModelSchema.parse(model))
  }),

  deleteEntity: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const deleteFromPackage = (pkg: Package): boolean => {
        const initialLen = (pkg.entities ?? []).length
        pkg.entities = (pkg.entities ?? []).filter((e: Entity) => e.id !== input.id)
        if (pkg.entities.length < initialLen) {
          removeFromElementsOrder(pkg, input.id)
          return true
        }
        for (const child of pkg.packages ?? []) {
          if (deleteFromPackage(child)) return true
        }
        return false
      }
      for (const pkg of model.packages) {
        if (deleteFromPackage(pkg)) break
      }
      return writeModel(model)
    }),

  addAttribute: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attribute: AttributeSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = [...(entity.attributes ?? []), input.attribute]
      return writeModel(ModelSchema.parse(model))
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
      return writeModel(ModelSchema.parse(model))
    }),

  deleteAttribute: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attributeId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = entity.attributes.filter((a) => a.id !== input.attributeId)
      return writeModel(model)
    }),

  reorderAttributes: publicProcedure
    .input(z.object({ entityId: z.string().uuid(), attributeIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const entity = requireEntityById(model, input.entityId)
      entity.attributes = reorderByIds(entity.attributes ?? [], input.attributeIds)
      return writeModel(ModelSchema.parse(model))
    }),

  addEnum: publicProcedure
    .input(z.object({ packageId: z.string().uuid(), enum: EnumSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const pkg = requirePackageById(model, input.packageId)
      pkg.enums = [...(pkg.enums ?? []), input.enum]
      appendToElementsOrder(pkg, input.enum.id)
      return writeModel(ModelSchema.parse(model))
    }),

  updateEnum: publicProcedure.input(EnumSchema).mutation(async ({ input }) => {
    const model = await readModel()
    const updateInPackages = (packages: Package[]): boolean => {
      for (const pkg of packages) {
        const idx = (pkg.enums ?? []).findIndex((e: Enum) => e.id === input.id)
        if (idx !== -1) {
          pkg.enums![idx] = input
          return true
        }
        if (pkg.packages && updateInPackages(pkg.packages)) return true
      }
      return false
    }
    if (!updateInPackages(model.packages)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Enum ${input.id} not found` })
    }
    return writeModel(ModelSchema.parse(model))
  }),

  deleteEnum: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const deleteFromPackage = (pkg: Package): boolean => {
        const initialLen = (pkg.enums ?? []).length
        pkg.enums = (pkg.enums ?? []).filter((e: Enum) => e.id !== input.id)
        if (pkg.enums.length < initialLen) {
          removeFromElementsOrder(pkg, input.id)
          return true
        }
        for (const child of pkg.packages ?? []) {
          if (deleteFromPackage(child)) return true
        }
        return false
      }
      for (const pkg of model.packages) {
        if (deleteFromPackage(pkg)) break
      }
      return writeModel(model)
    }),

  reorderEnumValues: publicProcedure
    .input(z.object({ enumId: z.string().uuid(), valueIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const en = requireEnumById(model, input.enumId)
      en.values = reorderByIds(en.values ?? [], input.valueIds)
      return writeModel(ModelSchema.parse(model))
    }),

  addPackage: publicProcedure
    .input(z.object({ parentId: z.string().uuid().optional(), package: PackageSchema }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const container = getContainerById(model, input.parentId)
      container.packages = [...(container.packages ?? []), input.package]
      appendToElementsOrder(container, input.package.id)
      return writeModel(ModelSchema.parse(model))
    }),

  updatePackage: publicProcedure.input(PackageSchema).mutation(async ({ input }) => {
    const model = await readModel()
    const target = findPackageById(model.packages, input.id)
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Package ${input.id} not found` })
    }
    Object.assign(target, input)
    return writeModel(ModelSchema.parse(model))
  }),

  deletePackage: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const model = await readModel()
      const deleteFromContainer = (container: Container): boolean => {
        const pkgs = container.packages ?? []
        const idx = pkgs.findIndex((p) => p.id === input.id)
        if (idx !== -1) {
          pkgs.splice(idx, 1)
          removeFromElementsOrder(container, input.id)
          return true
        }
        for (const pkg of pkgs) {
          if (deleteFromContainer(pkg)) return true
        }
        return false
      }
      deleteFromContainer(model)
      return writeModel(model)
    }),

  moveToPackage: publicProcedure
    .input(
      z.object({
        type: z.enum(['entity', 'enum', 'package']),
        id: z.string().uuid(),
        targetPackageId: z.string().uuid().optional(),
        index: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const model = await readModel()
      let item: Entity | Enum | Package | null = null

      const removeItem = (container: Container): boolean => {
        if (input.type === 'entity' && isPackage(container)) {
          const idx = container.entities.findIndex((e) => e.id === input.id)
          if (idx !== -1) {
            item = container.entities.splice(idx, 1)[0]
            removeFromElementsOrder(container, input.id)
            return true
          }
        } else if (input.type === 'enum' && isPackage(container)) {
          const idx = container.enums.findIndex((e) => e.id === input.id)
          if (idx !== -1) {
            item = container.enums.splice(idx, 1)[0]
            removeFromElementsOrder(container, input.id)
            return true
          }
        } else if (input.type === 'package') {
          const idx = (container.packages ?? []).findIndex((p) => p.id === input.id)
          if (idx !== -1) {
            item = container.packages!.splice(idx, 1)[0]
            removeFromElementsOrder(container, input.id)
            return true
          }
        }
        for (const pkg of container.packages ?? []) {
          if (removeItem(pkg)) return true
        }
        return false
      }

      removeItem(model)

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${input.type} ${input.id} not found`,
        })
      }

      if (input.type === 'package') {
        const targetContainer = getContainerById(model, input.targetPackageId)
        const isDescendant = (p: Package): boolean => {
          if (p.id === input.id) return true
          return (p.packages ?? []).some((sub) => isDescendant(sub))
        }
        if (isDescendant(item as Package)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot move a package into itself or its descendants',
          })
        }
        targetContainer.packages = [...(targetContainer.packages ?? []), item as Package]
        const order = targetContainer.elementsOrder ?? []
        if (input.index !== undefined) order.splice(input.index, 0, (item as Package).id)
        else order.push((item as Package).id)
        targetContainer.elementsOrder = order
      } else {
        const targetPkg = requirePackageById(model, input.targetPackageId)
        if (input.type === 'entity') {
          targetPkg.entities = [...(targetPkg.entities ?? []), item as Entity]
        } else {
          targetPkg.enums = [...(targetPkg.enums ?? []), item as Enum]
        }
        const order = targetPkg.elementsOrder ?? []
        const movedId = (item as Entity | Enum).id
        if (input.index !== undefined) order.splice(input.index, 0, movedId)
        else order.push(movedId)
        targetPkg.elementsOrder = order
      }

      return writeModel(ModelSchema.parse(model))
    }),

  moveRootPackage: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        index: z.number().int().min(0),
      })
    )
    .mutation(async ({ input }) => {
      const model = await readModel()
      const order = model.elementsOrder ?? []
      const idx = order.indexOf(input.id)
      if (idx !== -1) {
        order.splice(idx, 1)
      }
      order.splice(input.index, 0, input.id)
      model.elementsOrder = order
      return writeModel(ModelSchema.parse(model))
    }),

  listVersions: publicProcedure.query(() => listVersions()),

  commitVersion: publicProcedure
    .input(
      z.object({
        label: z.string().min(1),
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
