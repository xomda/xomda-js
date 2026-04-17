import type { Attribute } from '../schemas/attribute'
import type { Entity } from '../schemas/entity'
import type { Enum, EnumValue } from '../schemas/enum'
import type { Model } from '../schemas/model'
import type { Package } from '../schemas/package'

let _seq = 0
const seq = () => `00000000-0000-4000-8000-${String(++_seq).padStart(12, '0')}`

/** Build a valid Attribute with sensible defaults. All fields can be overridden. */
export function createAttribute(overrides: Partial<Attribute> = {}): Attribute {
  return {
    id: seq(),
    name: 'attribute',
    type: 'string',
    required: false,
    multiValue: false,
    primaryKey: false,
    unique: false,
    ...overrides,
  }
}

/** Build a valid EnumValue with sensible defaults. */
export function createEnumValue(overrides: Partial<EnumValue> = {}): EnumValue {
  return {
    id: seq(),
    name: 'VALUE',
    ...overrides,
  }
}

/** Build a valid Entity with sensible defaults. */
export function createEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: seq(),
    name: 'Entity',
    attributes: [],
    ...overrides,
  }
}

/** Build a valid Enum with sensible defaults. */
export function createEnum(overrides: Partial<Enum> = {}): Enum {
  return {
    id: seq(),
    name: 'Enum',
    values: [],
    ...overrides,
  }
}

/** Build a valid Package with sensible defaults. */
export function createPackage(overrides: Partial<Package> = {}): Package {
  return {
    id: seq(),
    name: 'pkg',
    packages: [],
    enums: [],
    entities: [],
    ...overrides,
  }
}

/** Build a valid Model with sensible defaults. */
export function createModel(
  overrides: Partial<Pick<Model, 'id' | 'name' | 'version' | 'packages'>> = {}
): Model {
  return {
    id: seq(),
    name: 'Test Model',
    version: '1.0.0',
    packages: [],
    ...overrides,
  }
}
