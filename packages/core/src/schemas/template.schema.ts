import { z } from 'zod'

export const TEMPLATE_SCOPES = ['Entity', 'Enum', 'Package'] as const

export const CellTypeSchema = z.enum(['logic', 'markdown', 'handlebars', 'buffer', 'output', 'provider', 'provider-logic'])

export const PROVIDER_SOURCES = ['entities', 'enums', 'packages', 'javascript'] as const

export const DIFF_PROVIDER_SOURCES = [
  'diff-added-entities',
  'diff-removed-entities',
  'diff-renamed-entities',
  'diff-modified-entities',
  'diff-added-attributes',
  'diff-removed-attributes',
  'diff-renamed-attributes',
  'diff-modified-attributes',
  'diff-added-enums',
  'diff-removed-enums',
  'diff-renamed-enums',
  'diff-modified-enums',
  'diff-added-enum-values',
  'diff-removed-enum-values',
  'diff-renamed-enum-values',
  'diff-added-packages',
  'diff-removed-packages',
  'diff-renamed-packages',
  'diff-modified-packages',
] as const

const ALL_PROVIDER_SOURCES = [...PROVIDER_SOURCES, ...DIFF_PROVIDER_SOURCES] as const

export const TemplateCellSchema = z.object({
  uuid: z.string().uuid(),
  type: CellTypeSchema,
  content: z.string(),
  variableName: z.string().optional(),
  outputFilename: z.string().optional(),
  outputContent: z.string().optional(),
  // provider cell fields
  providerSource: z.enum(ALL_PROVIDER_SOURCES).optional(),
})

export const TemplateSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  scope: z.enum(TEMPLATE_SCOPES).optional(),
  folder: z.string().optional(),
  cells: z.array(TemplateCellSchema),
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
