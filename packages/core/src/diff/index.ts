import { getAllEntities, getAllEnums, getAllPackages } from '../introspect/index'
import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Enum, EnumValue } from '../schemas/enum'
import type { Model } from '../schemas/model'
import type { LooseKind, ModelDiff } from './types'
import { emptyModelDiff } from './types'

export type {
  AddedAttribute,
  AddedEntity,
  AddedEnum,
  AddedEnumValue,
  LooseChange,
  LooseKind,
  ModelDiff,
  ModifiedAttribute,
  ModifiedEntity,
  ModifiedEnum,
  ModifiedPackage,
  RenamedAttribute,
  RenamedEntity,
  RenamedEnum,
  RenamedEnumValue,
  RenamedPackage,
} from './types'
export { emptyModelDiff } from './types'

const ENTITY_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'attributes',
  'description',
  'extends',
  'abstract',
])
const ATTRIBUTE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'type',
  'required',
  'multiValue',
  'primaryKey',
  'unique',
  'uniqueScope',
  'reference',
  'description',
  'defaultValue',
])
const ENUM_KEYS: ReadonlySet<string> = new Set(['id', 'name', 'values', 'description'])
const ENUM_VALUE_KEYS: ReadonlySet<string> = new Set(['id', 'name'])
const PACKAGE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'packages',
  'enums',
  'entities',
  'description',
  'elementsOrder',
])
const MODEL_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'version',
  'packages',
  'createdAt',
  'updatedAt',
  'elementsOrder',
  'layout',
])

const ENTITY_COMPARE_KEYS = ['description', 'extends', 'abstract'] as const
const ATTRIBUTE_COMPARE_KEYS = [
  'name',
  'type',
  'required',
  'multiValue',
  'primaryKey',
  'unique',
  'uniqueScope',
  'reference',
  'description',
  'defaultValue',
] as const
const ENUM_COMPARE_KEYS = ['description'] as const
const PACKAGE_COMPARE_KEYS = ['description'] as const

function diffFields<K extends string>(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly K[]
): K[] {
  const changes: K[] = []
  for (const key of keys) {
    if (!isEqual(before[key], after[key])) changes.push(key)
  }
  return changes
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (a === null || b === null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function pickLooseKeys(
  obj: Record<string, unknown>,
  knownKeys: ReadonlySet<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(obj)) {
    if (!knownKeys.has(k)) out[k] = obj[k]
  }
  return out
}

function recordLooseChange(
  diff: ModelDiff,
  kind: LooseKind,
  id: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  knownKeys: ReadonlySet<string>
): void {
  const beforeLoose = pickLooseKeys(before, knownKeys)
  const afterLoose = pickLooseKeys(after, knownKeys)
  if (!isEqual(beforeLoose, afterLoose)) {
    diff.loose.push({ kind, id, before: beforeLoose, after: afterLoose })
  }
}

function entityPackage(model: Model, entityId: string): { id: string; name: string } {
  for (const pkg of getAllPackages(model)) {
    if (pkg.entities.some((e) => e.id === entityId)) return { id: pkg.id, name: pkg.name }
  }
  return { id: '', name: '' }
}

function enumPackage(model: Model, enumId: string): { id: string; name: string } {
  for (const pkg of getAllPackages(model)) {
    if (pkg.enums.some((e) => e.id === enumId)) return { id: pkg.id, name: pkg.name }
  }
  return { id: '', name: '' }
}

/**
 * Computes the structural difference between two model snapshots.
 * Items match by `id` (UUID); name changes appear in `renamed`, other field
 * changes in `modified`, and unknown `.loose()` extension fields in `loose`.
 */
export function diffModels(before: Model, after: Model): ModelDiff {
  const diff = emptyModelDiff()

  // ── Packages (matched by id) ───────────────────────────────────────────────
  const pkgsBefore = new Map(getAllPackages(before).map((p) => [p.id, p]))
  const pkgsAfter = new Map(getAllPackages(after).map((p) => [p.id, p]))

  for (const [id, pkg] of pkgsBefore) {
    if (!pkgsAfter.has(id)) diff.removed.packages.push(pkg)
  }
  for (const [id, pkg] of pkgsAfter) {
    if (!pkgsBefore.has(id)) {
      diff.added.packages.push(pkg)
      continue
    }
    const pBefore = pkgsBefore.get(id)!
    if (pBefore.name !== pkg.name) {
      diff.renamed.packages.push({ id, oldName: pBefore.name, newName: pkg.name })
    }
    const pkgChanges = diffFields(
      pBefore as unknown as Record<string, unknown>,
      pkg as unknown as Record<string, unknown>,
      PACKAGE_COMPARE_KEYS
    )
    if (pkgChanges.length > 0) {
      diff.modified.packages.push({ id, before: pBefore, after: pkg, changes: [...pkgChanges] })
    }
    recordLooseChange(
      diff,
      'package',
      id,
      pBefore as unknown as Record<string, unknown>,
      pkg as unknown as Record<string, unknown>,
      PACKAGE_KEYS
    )
  }

  // ── Entities (matched by id) ───────────────────────────────────────────────
  const entsBefore = new Map(getAllEntities(before).map((e) => [e.id, e]))
  const entsAfter = new Map(getAllEntities(after).map((e) => [e.id, e]))

  for (const [id, eBefore] of entsBefore) {
    if (!entsAfter.has(id)) {
      const pkg = entityPackage(before, id)
      diff.removed.entities.push({ entity: eBefore, packageId: pkg.id, packageName: pkg.name })
    }
  }
  for (const [id, eAfter] of entsAfter) {
    if (!entsBefore.has(id)) {
      const pkg = entityPackage(after, id)
      diff.added.entities.push({ entity: eAfter, packageId: pkg.id, packageName: pkg.name })
      continue
    }
    const eBefore = entsBefore.get(id)!
    const pkg = entityPackage(after, id)

    if (eBefore.name !== eAfter.name) {
      diff.renamed.entities.push({
        id,
        oldName: eBefore.name,
        newName: eAfter.name,
        packageId: pkg.id,
        packageName: pkg.name,
      })
    }
    const entityChanges = diffFields(
      eBefore as unknown as Record<string, unknown>,
      eAfter as unknown as Record<string, unknown>,
      ENTITY_COMPARE_KEYS
    )
    if (entityChanges.length > 0) {
      diff.modified.entities.push({
        id,
        before: eBefore,
        after: eAfter,
        changes: [...entityChanges],
        packageId: pkg.id,
        packageName: pkg.name,
      })
    }
    recordLooseChange(
      diff,
      'entity',
      id,
      eBefore as unknown as Record<string, unknown>,
      eAfter as unknown as Record<string, unknown>,
      ENTITY_KEYS
    )

    diffAttributes(diff, eBefore, eAfter)
  }

  // ── Enums (matched by id) ──────────────────────────────────────────────────
  const enumsBefore = new Map(getAllEnums(before).map((e) => [e.id, e]))
  const enumsAfter = new Map(getAllEnums(after).map((e) => [e.id, e]))

  for (const [id, eBefore] of enumsBefore) {
    if (!enumsAfter.has(id)) {
      const pkg = enumPackage(before, id)
      diff.removed.enums.push({ enum: eBefore, packageId: pkg.id, packageName: pkg.name })
    }
  }
  for (const [id, eAfter] of enumsAfter) {
    if (!enumsBefore.has(id)) {
      const pkg = enumPackage(after, id)
      diff.added.enums.push({ enum: eAfter, packageId: pkg.id, packageName: pkg.name })
      continue
    }
    const eBefore = enumsBefore.get(id)!
    const pkg = enumPackage(after, id)

    if (eBefore.name !== eAfter.name) {
      diff.renamed.enums.push({
        id,
        oldName: eBefore.name,
        newName: eAfter.name,
        packageId: pkg.id,
        packageName: pkg.name,
      })
    }
    const enumChanges = diffFields(
      eBefore as unknown as Record<string, unknown>,
      eAfter as unknown as Record<string, unknown>,
      ENUM_COMPARE_KEYS
    )
    if (enumChanges.length > 0) {
      diff.modified.enums.push({
        id,
        before: eBefore,
        after: eAfter,
        changes: [...enumChanges],
        packageId: pkg.id,
        packageName: pkg.name,
      })
    }
    recordLooseChange(
      diff,
      'enum',
      id,
      eBefore as unknown as Record<string, unknown>,
      eAfter as unknown as Record<string, unknown>,
      ENUM_KEYS
    )

    diffEnumValues(diff, eBefore, eAfter)
  }

  // ── Model-level loose fields ───────────────────────────────────────────────
  recordLooseChange(
    diff,
    'model',
    before.id,
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    MODEL_KEYS
  )

  return diff
}

function diffAttributes(diff: ModelDiff, eBefore: Entity, eAfter: Entity): void {
  const attrsBefore = new Map(eBefore.attributes.map((a: Attribute) => [a.id, a]))
  const attrsAfter = new Map(eAfter.attributes.map((a: Attribute) => [a.id, a]))

  for (const [aid, aBefore] of attrsBefore) {
    if (!attrsAfter.has(aid)) {
      diff.removed.attributes.push({
        attribute: aBefore,
        entityId: eAfter.id,
        entityName: eAfter.name,
      })
    }
  }
  for (const [aid, aAfter] of attrsAfter) {
    if (!attrsBefore.has(aid)) {
      diff.added.attributes.push({
        attribute: aAfter,
        entityId: eAfter.id,
        entityName: eAfter.name,
      })
      continue
    }
    const aBefore = attrsBefore.get(aid)!

    if (aBefore.name !== aAfter.name) {
      diff.renamed.attributes.push({
        id: aid,
        oldName: aBefore.name,
        newName: aAfter.name,
        entityId: eAfter.id,
        entityName: eAfter.name,
      })
    }
    const attrChanges = diffFields(
      aBefore as unknown as Record<string, unknown>,
      aAfter as unknown as Record<string, unknown>,
      ATTRIBUTE_COMPARE_KEYS
    )
    const nonNameChanges = attrChanges.filter((c) => c !== 'name')
    if (nonNameChanges.length > 0) {
      diff.modified.attributes.push({
        id: aid,
        before: aBefore,
        after: aAfter,
        changes: nonNameChanges,
        entityId: eAfter.id,
        entityName: eAfter.name,
      })
    }
    recordLooseChange(
      diff,
      'attribute',
      aid,
      aBefore as unknown as Record<string, unknown>,
      aAfter as unknown as Record<string, unknown>,
      ATTRIBUTE_KEYS
    )
  }
}

function diffEnumValues(diff: ModelDiff, eBefore: Enum, eAfter: Enum): void {
  const valsBefore = new Map(eBefore.values.map((v: EnumValue) => [v.id, v]))
  const valsAfter = new Map(eAfter.values.map((v: EnumValue) => [v.id, v]))

  for (const [vid, v] of valsBefore) {
    if (!valsAfter.has(vid)) {
      diff.removed.enumValues.push({ value: v, enumId: eAfter.id, enumName: eAfter.name })
    }
  }
  for (const [vid, v] of valsAfter) {
    if (!valsBefore.has(vid)) {
      diff.added.enumValues.push({ value: v, enumId: eAfter.id, enumName: eAfter.name })
      continue
    }
    const vBefore = valsBefore.get(vid)!
    if (vBefore.name !== v.name) {
      diff.renamed.enumValues.push({
        id: vid,
        oldName: vBefore.name,
        newName: v.name,
        enumId: eAfter.id,
        enumName: eAfter.name,
      })
    }
    recordLooseChange(
      diff,
      'enumValue',
      vid,
      vBefore as unknown as Record<string, unknown>,
      v as unknown as Record<string, unknown>,
      ENUM_VALUE_KEYS
    )
  }
}

