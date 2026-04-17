// Cell-based template engine
export type { CellOutput, TemplateExecutionResult } from './engine'
export { executeTemplate, OutputBuffer } from './engine'
export type {
  CellContext,
  CellInstance,
  CellProcessor,
  CellState,
  ExecutionContext,
} from './processors'
export {
  collectLoopItems,
  createCellInstance,
  createExecutionContext,
  PROCESSORS,
} from './processors'
export type { WriteRenderResultsOptions } from './renderer'
export { renderTemplateByScope, writeRenderResults } from './renderer'
export {
  deleteTemplate,
  deleteTemplateFolder,
  listTemplateFolders,
  listTemplates,
  moveTemplate,
  moveTemplateFolder,
  readTemplate,
  saveTemplateFolder,
  writeTemplate,
} from './storage'
export type { RenderResult } from './types'
export type { CellType, Template, TemplateCell, TemplateFolder } from '@xomda/core'
export {
  DIFF_LOOP_SOURCES,
  DIFF_PROVIDER_SOURCES,
  LOOP_SOURCES,
  normalizeTemplate,
  PROVIDER_SOURCES,
  TEMPLATE_SCOPES,
  TemplateCellSchema,
  TemplateFolderSchema,
  TemplateSchema,
} from '@xomda/core'
export { TEMPLATES_DIR, XOMDA_DIR } from '@xomda/core'
