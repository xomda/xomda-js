/**
 * Root folder for all xomda project data. Can be overridden via XOMDA_DIR env
 * var. Accessed through `globalThis` so this module typechecks in browser
 * packages too — without that path, every browser consumer would need
 * `@types/node` in its tsconfig just to satisfy `process`.
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
export const XOMDA_DIR = env?.XOMDA_DIR ?? '.xomda'

export const MODEL_FILE = 'model.json'
export const TEMPLATES_DIR = 'templates'

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
} from './diff/index'
export { diffModels, emptyModelDiff } from './diff/index'
export { buildEntitySchema } from './dynamic/index'
export type {
  AttributeId,
  EntityId,
  EnumId,
  EnumValueId,
  ModelId,
  PackageId,
  TemplateId,
} from './ids'
export {
  asAttributeId,
  asEntityId,
  asEnumId,
  asEnumValueId,
  asModelId,
  asPackageId,
  asTemplateId,
  AttributeIdSchema,
  EntityIdSchema,
  EnumIdSchema,
  EnumValueIdSchema,
  ModelIdSchema,
  PackageIdSchema,
  TemplateIdSchema,
} from './ids'
export {
  getEffectiveAttributes,
  getEntityAncestors,
  getInheritedAttributes,
} from './inheritance/index'
export {
  findAttributeByName,
  findEntityById,
  findEntityByName,
  findEntityParentPackage,
  findEnumById,
  findEnumByName,
  findEnumParentPackage,
  findPackageById,
  findPackageByName,
  getAllEntities,
  getAllEnums,
  getAllPackages,
  sortAttributesForDisplay,
} from './introspect/index'
export type {
  Attribute,
  AttributeType,
  AttributeTypeKind,
  CellType,
  Entity,
  EntityKind,
  Enum,
  EnumValue,
  Layout,
  LayoutEntry,
  MetaType,
  Model,
  OutputType,
  Package,
  PrimitiveType,
  ProjectFile,
  ProjectSettings,
  Selector,
  SnapshotEnvelope,
  Template,
  TemplateCell,
  TemplateFolder,
  Version,
  VersionsIndex,
} from './schemas/index'
export {
  ATTRIBUTE_TYPES,
  AttributeSchema,
  CellTypeSchema,
  DEFAULT_PROJECT_SCAN_EXCLUDES,
  defaultProjectSettings,
  DIFF_LOOP_SOURCES,
  DIFF_PROVIDER_SOURCES,
  ENTITY_KINDS,
  EntitySchema,
  EnumSchema,
  EnumValueSchema,
  getEntityImplements,
  getEntityKind,
  isAttributeTypeKind,
  isMetaType,
  isPrimitiveType,
  LayoutEntrySchema,
  LOOP_SOURCES,
  META_TYPES,
  ModelSchema,
  normalizeTemplate,
  OUTPUT_TYPES,
  OutputTypeSchema,
  PackageSchema,
  PRIMITIVE_TYPES,
  ProjectFileSchema,
  ProjectSettingsSchema,
  PROVIDER_SOURCES,
  SelectorSchema,
  SnapshotEnvelopeSchema,
  TemplateCellSchema,
  TemplateFolderSchema,
  TemplateSchema,
  VersionSchema,
  VersionsIndexSchema,
} from './schemas/index'
export type { ModelStorage } from './storage/index'
export {
  createAttribute,
  createEntity,
  createEnum,
  createEnumValue,
  createModel,
  createPackage,
} from './testing/index'
export type { ParsedVersion, VersionPart } from './version'
export {
  bumpVersion,
  compareVersions,
  isValidVersion,
  maxVersion,
  parseVersion,
  validateModelVersionEdit,
  validateUpcomingVersion,
} from './version'
export type { Visibility, VisibilityCheck } from './visibility/index'
export {
  getEffectiveVisibility,
  getOwnVisibility,
  isVisibleFrom,
  minVisibility,
  VISIBILITY_VALUES,
} from './visibility/index'
