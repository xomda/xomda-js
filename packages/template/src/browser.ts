// Cell-based template engine (primary)
export type { CellOutput, TemplateExecutionResult } from './engine'
export { executeTemplate, OutputBuffer } from './engine'
export { createCellInstance, createExecutionContext } from './processors/registry'
export type { CellType, Template, TemplateCell } from '@xomda/core'
export { PROVIDER_SOURCES, TEMPLATE_SCOPES, TEMPLATES_DIR, XOMDA_DIR } from '@xomda/core'

// backwards-compat aliases
export type { TemplatePP } from '@xomda/core'
export { TEMPLATE_PP_SCOPES } from '@xomda/core'

// Handlebars legacy types
export { HandlebarsTemplateFolderSchema, HandlebarsTemplateSchema } from './handlebarsSchema'
export type {
  HandlebarsRenderContext,
  HandlebarsTemplate,
  HandlebarsTemplateFolder,
  RenderResult,
} from './types'
