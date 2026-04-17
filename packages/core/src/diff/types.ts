import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Enum, EnumValue } from '../schemas/enum'
import type { Package } from '../schemas/package'

export interface AddedEntity {
  entity: Entity
  packageId: string
  packageName: string
}
export interface AddedEnum {
  enum: Enum
  packageId: string
  packageName: string
}
export interface AddedAttribute {
  attribute: Attribute
  entityId: string
  entityName: string
}
export interface AddedEnumValue {
  value: EnumValue
  enumId: string
  enumName: string
}

export interface RenamedPackage {
  id: string
  oldName: string
  newName: string
}
export interface RenamedEntity {
  id: string
  oldName: string
  newName: string
  packageId: string
  packageName: string
}
export interface RenamedEnum {
  id: string
  oldName: string
  newName: string
  packageId: string
  packageName: string
}
export interface RenamedAttribute {
  id: string
  oldName: string
  newName: string
  entityId: string
  entityName: string
}
export interface RenamedEnumValue {
  id: string
  oldName: string
  newName: string
  enumId: string
  enumName: string
}

export interface ModifiedEntity {
  id: string
  before: Entity
  after: Entity
  changes: string[]
  packageId: string
  packageName: string
}
export interface ModifiedEnum {
  id: string
  before: Enum
  after: Enum
  changes: string[]
  packageId: string
  packageName: string
}
export interface ModifiedAttribute {
  id: string
  before: Attribute
  after: Attribute
  changes: string[]
  entityId: string
  entityName: string
}
export interface ModifiedPackage {
  id: string
  before: Package
  after: Package
  changes: string[]
}

export type LooseKind = 'model' | 'package' | 'entity' | 'enum' | 'attribute' | 'enumValue'

export interface LooseChange {
  kind: LooseKind
  id: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

export interface ModelDiff {
  added: {
    packages: Package[]
    entities: AddedEntity[]
    enums: AddedEnum[]
    attributes: AddedAttribute[]
    enumValues: AddedEnumValue[]
  }
  removed: {
    packages: Package[]
    entities: AddedEntity[]
    enums: AddedEnum[]
    attributes: AddedAttribute[]
    enumValues: AddedEnumValue[]
  }
  renamed: {
    packages: RenamedPackage[]
    entities: RenamedEntity[]
    enums: RenamedEnum[]
    attributes: RenamedAttribute[]
    enumValues: RenamedEnumValue[]
  }
  modified: {
    packages: ModifiedPackage[]
    entities: ModifiedEntity[]
    enums: ModifiedEnum[]
    attributes: ModifiedAttribute[]
  }
  loose: LooseChange[]
}

export function emptyModelDiff(): ModelDiff {
  return {
    added: { packages: [], entities: [], enums: [], attributes: [], enumValues: [] },
    removed: { packages: [], entities: [], enums: [], attributes: [], enumValues: [] },
    renamed: { packages: [], entities: [], enums: [], attributes: [], enumValues: [] },
    modified: { packages: [], entities: [], enums: [], attributes: [] },
    loose: [],
  }
}
