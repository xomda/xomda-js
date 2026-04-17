import { getAllEntities, getAllEnums, getAllPackages } from '../introspect/index'
import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Enum, EnumValue } from '../schemas/enum'
import type { Model } from '../schemas/model'
import type { Package } from '../schemas/package'

export type DiffEntry =
  | { kind: 'package-added'; package: Package }
  | { kind: 'package-removed'; package: Package }
  | { kind: 'entity-added'; entity: Entity; packageName: string }
  | { kind: 'entity-removed'; entity: Entity; packageName: string }
  | { kind: 'entity-renamed'; entity: Entity; oldName: string; packageName: string }
  | { kind: 'attribute-added'; attribute: Attribute; entityName: string }
  | { kind: 'attribute-removed'; attribute: Attribute; entityName: string }
  | { kind: 'attribute-changed'; attribute: Attribute; old: Attribute; entityName: string }
  | { kind: 'enum-added'; enum: Enum; packageName: string }
  | { kind: 'enum-removed'; enum: Enum; packageName: string }
  | { kind: 'enum-value-added'; value: EnumValue; enumName: string }
  | { kind: 'enum-value-removed'; value: EnumValue; enumName: string }

/**
 * Computes the structural differences between two model snapshots.
 * Entities and Enums are matched by id; Attributes by id within a matched entity.
 */
export function diffModels(before: Model, after: Model): DiffEntry[] {
  const entries: DiffEntry[] = []

  // Packages — matched by id
  const pkgsBefore = new Map(getAllPackages(before).map((p) => [p.id, p]))
  const pkgsAfter = new Map(getAllPackages(after).map((p) => [p.id, p]))

  for (const [id, pkg] of pkgsBefore) {
    if (!pkgsAfter.has(id)) entries.push({ kind: 'package-removed', package: pkg })
  }
  for (const [id, pkg] of pkgsAfter) {
    if (!pkgsBefore.has(id)) entries.push({ kind: 'package-added', package: pkg })
  }

  // Entities — matched by id; find parent package name from after model
  const entsBefore = new Map(getAllEntities(before).map((e) => [e.id, e]))
  const entsAfter = new Map(getAllEntities(after).map((e) => [e.id, e]))

  const entityPackageName = (model: Model, entityId: string): string => {
    for (const pkg of getAllPackages(model)) {
      if (pkg.entities.some((e) => e.id === entityId)) return pkg.name
    }
    return ''
  }

  for (const [id, eBefore] of entsBefore) {
    if (!entsAfter.has(id)) {
      entries.push({
        kind: 'entity-removed',
        entity: eBefore,
        packageName: entityPackageName(before, id),
      })
    } else {
      const eAfter = entsAfter.get(id)!
      if (eBefore.name !== eAfter.name) {
        entries.push({
          kind: 'entity-renamed',
          entity: eAfter,
          oldName: eBefore.name,
          packageName: entityPackageName(after, id),
        })
      }
      // Attributes
      const attrsBefore = new Map(eBefore.attributes.map((a) => [a.id, a]))
      const attrsAfter = new Map(eAfter.attributes.map((a) => [a.id, a]))
      for (const [aid, aBefore] of attrsBefore) {
        if (!attrsAfter.has(aid)) {
          entries.push({ kind: 'attribute-removed', attribute: aBefore, entityName: eAfter.name })
        } else {
          const aAfter = attrsAfter.get(aid)!
          if (JSON.stringify(aBefore) !== JSON.stringify(aAfter)) {
            entries.push({
              kind: 'attribute-changed',
              attribute: aAfter,
              old: aBefore,
              entityName: eAfter.name,
            })
          }
        }
      }
      for (const [aid, aAfter] of attrsAfter) {
        if (!attrsBefore.has(aid)) {
          entries.push({ kind: 'attribute-added', attribute: aAfter, entityName: eAfter.name })
        }
      }
    }
  }
  for (const [id, eAfter] of entsAfter) {
    if (!entsBefore.has(id)) {
      entries.push({
        kind: 'entity-added',
        entity: eAfter,
        packageName: entityPackageName(after, id),
      })
    }
  }

  // Enums — matched by id
  const enumsBefore = new Map(getAllEnums(before).map((e) => [e.id, e]))
  const enumsAfter = new Map(getAllEnums(after).map((e) => [e.id, e]))

  const enumPackageName = (model: Model, enumId: string): string => {
    for (const pkg of getAllPackages(model)) {
      if (pkg.enums.some((e) => e.id === enumId)) return pkg.name
    }
    return ''
  }

  for (const [id, eBefore] of enumsBefore) {
    if (!enumsAfter.has(id)) {
      entries.push({
        kind: 'enum-removed',
        enum: eBefore,
        packageName: enumPackageName(before, id),
      })
    } else {
      const eAfter = enumsAfter.get(id)!
      const valsBefore = new Map(eBefore.values.map((v) => [v.id, v]))
      const valsAfter = new Map(eAfter.values.map((v) => [v.id, v]))
      for (const [vid, v] of valsBefore) {
        if (!valsAfter.has(vid))
          entries.push({ kind: 'enum-value-removed', value: v, enumName: eAfter.name })
      }
      for (const [vid, v] of valsAfter) {
        if (!valsBefore.has(vid))
          entries.push({ kind: 'enum-value-added', value: v, enumName: eAfter.name })
      }
    }
  }
  for (const [id, eAfter] of enumsAfter) {
    if (!enumsBefore.has(id)) {
      entries.push({ kind: 'enum-added', enum: eAfter, packageName: enumPackageName(after, id) })
    }
  }

  return entries
}
