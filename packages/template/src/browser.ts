// Cell-based template engine (browser-safe subset)
export type { CellOutput, TemplateExecutionResult } from './engine'
export { executeTemplate, OutputBuffer } from './engine'
export { createCellInstance, createExecutionContext } from './processors/registry'
export type { CellType, Template, TemplateCell } from '@xomda/core'
export {
  LOOP_SOURCES,
  normalizeTemplate,
  PROVIDER_SOURCES,
  TEMPLATE_SCOPES,
  TEMPLATES_DIR,
  XOMDA_DIR,
} from '@xomda/core'
