/** Root folder for all xomda project data. Can be overridden via XOMDA_DIR env var. */
export const XOMDA_DIR =
  (typeof process !== 'undefined' ? process.env?.XOMDA_DIR : undefined) ?? '.xomda'

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
} from './introspect/index'
export type {
  Attribute,
  AttributeType,
  CellType,
  Entity,
  Enum,
  EnumValue,
  Layout,
  LayoutEntry,
  Model,
  OutputType,
  Package,
  PrimitiveType,
  ProjectFile,
  ProjectSettings,
  SnapshotEnvelope,
  Template,
  TemplateCell,
  TemplateFolder,
  Version,
  VersionsIndex,
} from './schemas/index'
export {
  AttributeSchema,
  CellTypeSchema,
  DEFAULT_PROJECT_SCAN_EXCLUDES,
  defaultProjectSettings,
  DIFF_LOOP_SOURCES,
  DIFF_PROVIDER_SOURCES,
  EntitySchema,
  EnumSchema,
  EnumValueSchema,
  isPrimitiveType,
  LayoutEntrySchema,
  LOOP_SOURCES,
  ModelSchema,
  normalizeTemplate,
  OUTPUT_TYPES,
  OutputTypeSchema,
  PackageSchema,
  PRIMITIVE_TYPES,
  ProjectFileSchema,
  ProjectSettingsSchema,
  PROVIDER_SOURCES,
  SnapshotEnvelopeSchema,
  TEMPLATE_SCOPES,
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
