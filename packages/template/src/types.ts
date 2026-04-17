import type { z } from 'zod'

import type { HandlebarsTemplateFolderSchema, HandlebarsTemplateSchema } from './handlebarsSchema'

export type HandlebarsTemplate = z.infer<typeof HandlebarsTemplateSchema>
export type HandlebarsTemplateFolder = z.infer<typeof HandlebarsTemplateFolderSchema>

export interface HandlebarsRenderContext {
  model: import('@xomda/core').Model
  entity?: import('@xomda/core').Entity
  [key: string]: unknown
}

export interface RenderResult {
  templateId: string
  outputPath: string
  content: string
}
