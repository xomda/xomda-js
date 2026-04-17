import { z } from 'zod'

export const TEMPLATE_PP_SCOPES = ['Entity', 'Enum', 'Package'] as const

export const CellTypeSchema = z.enum(['logic', 'markdown', 'handlebars', 'buffer', 'output'])

export const TemplateCellSchema = z.object({
  uuid: z.string().uuid(),
  type: CellTypeSchema,
  content: z.string(),
  variableName: z.string().optional(),
  // output cell structured fields (rendered as form, not code editor)
  outputFilename: z.string().optional(),
  outputDirectory: z.string().optional(),
  outputContent: z.string().optional(),
})

export const TemplatePPSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  scope: z.enum(TEMPLATE_PP_SCOPES).optional(),
  cells: z.array(TemplateCellSchema),
  extends: z.string().uuid().optional(),
})

export type CellType = z.infer<typeof CellTypeSchema>
export type TemplateCell = z.infer<typeof TemplateCellSchema>
export type TemplatePP = z.infer<typeof TemplatePPSchema>
