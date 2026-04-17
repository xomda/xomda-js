import { z } from 'zod'

export const HANDLEBARS_TEMPLATE_SCOPES = ['Entity', 'Enum', 'Package'] as const

export const HandlebarsTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  path: z.string().optional(),
  outputPath: z.string(),
  content: z.string(),
  language: z.string().optional(),
  scope: z.enum(HANDLEBARS_TEMPLATE_SCOPES).optional(),
  disabled: z.boolean().optional(),
})

export const HandlebarsTemplateFolderSchema = z.object({
  path: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
})
