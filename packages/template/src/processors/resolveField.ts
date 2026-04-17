import { render } from '../handlebarsEngine'

/**
 * Resolves a cell configuration field value using Handlebars interpolation.
 * Allows {{pascalCase entity.name}} syntax in outputFilename, variableName, etc.
 */
export function resolveField(field: string | undefined, ctx: Record<string, unknown>): string {
  if (!field) return ''
  return render(field, ctx)
}
