// Cell-based template engine (primary)
export { executeTemplate, OutputBuffer } from './engine'
export type { CellOutput, TemplateExecutionResult } from './engine'
export { collectProviderItems, createCellInstance, createExecutionContext, PROCESSORS } from './processors'
export type { CellContext, CellInstance, CellProcessor, CellState, ExecutionContext } from './processors'
export { renderTemplateByScope, writeRenderResults } from './renderer'
export { renderTemplatePPByScope } from './renderer' // backwards compat
export {
  deleteTemplate,
  listTemplates,
  listTemplateFolders,
  moveTemplate,
  moveTemplateFolder,
  readTemplate,
  saveTemplateFolder,
  writeTemplate,
} from './storage'
export { deleteTemplatePP, listTemplatesPP, readTemplatePP, writeTemplatePP } from './storage' // backwards compat
export type { CellType, Template, TemplateCell, TemplateFolder } from '@xomda/core'
export {
  PROVIDER_SOURCES,
  TEMPLATE_SCOPES,
  TemplateCellSchema,
  TemplateFolderSchema,
  TemplateSchema,
} from '@xomda/core'
export { TEMPLATE_PP_SCOPES, TemplatePPSchema } from '@xomda/core' // backwards compat
export type { TemplatePP } from '@xomda/core' // backwards compat

// Handlebars template system (legacy, being phased out)
export { compile, render } from './handlebarsEngine'
export { registerHelpers } from './helpers'
export {
  renderHandlebarsPerEntity,
  renderHandlebarsTemplate,
  renderHandlebarsTemplateByScope,
} from './handlebarsRenderer'
export {
  HandlebarsTemplateFolderSchema,
  HandlebarsTemplateSchema,
  deleteHandlebarsTemplate,
  listHandlebarsTemplateFolders,
  listHandlebarsTemplates,
  moveHandlebarsTemplate,
  moveHandlebarsTemplateFolder,
  readHandlebarsTemplate,
  saveHandlebarsTemplateFolder,
  writeHandlebarsTemplate,
} from './handlebarsStorage'
export type { HandlebarsRenderContext, HandlebarsTemplate, HandlebarsTemplateFolder, RenderResult } from './types'

export { TEMPLATES_DIR, XOMDA_DIR } from '@xomda/core'
