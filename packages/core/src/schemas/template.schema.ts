import { z } from 'zod'

export const TEMPLATE_SCOPES = ['Entity', 'Enum', 'Package'] as const

export const CellTypeSchema = z.enum(['logic', 'markdown', 'handlebars', 'buffer', 'output', 'provider', 'provider-logic'])

export const PROVIDER_SOURCES = ['entities', 'enums', 'packages', 'javascript'] as const

export const TemplateCellSchema = z.object({
  uuid: z.string().uuid(),
  type: CellTypeSchema,
  content: z.string(),
  variableName: z.string().optional(),
  outputFilename: z.string().optional(),
  outputDirectory: z.string().optional(),
  outputContent: z.string().optional(),
  // provider cell fields
  providerSource: z.enum(PROVIDER_SOURCES).optional(),
})

export const TemplateSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  scope: z.enum(TEMPLATE_SCOPES).optional(),
  folder: z.string().optional(),
  cells: z.array(TemplateCellSchema),
  extends: z.string().uuid().optional(),
})

export const TemplateFolderSchema = z.object({
  path: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export type CellType = z.infer<typeof CellTypeSchema>
export type TemplateCell = z.infer<typeof TemplateCellSchema>
export type Template = z.infer<typeof TemplateSchema>
export type TemplateFolder = z.infer<typeof TemplateFolderSchema>

// Backwards-compat aliases (remove after full migration)
export const TemplatePPSchema = TemplateSchema
export const TEMPLATE_PP_SCOPES = TEMPLATE_SCOPES
export type TemplatePP = Template
