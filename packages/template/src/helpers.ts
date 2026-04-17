import type { Attribute } from '@xomda/core'
import { camelCase, constantCase, kebabCase, pascalCase, snakeCase } from 'change-case'
import Handlebars from 'handlebars'

/**
 * Registers Handlebars helpers for code generation.
 *
 * Helpers here are deliberately generic (string casing, comparisons, simple
 * model traversal). Target-language type mapping (TypeScript, Zod, Java, …)
 * lives in template logic cells, not here — keeping the helper surface
 * language-neutral is part of the two-tier MDA architecture.
 */
export function registerHelpers(hbs: typeof Handlebars = Handlebars): void {
  hbs.registerHelper('camelCase', (str: string) => camelCase(str ?? ''))
  hbs.registerHelper('pascalCase', (str: string) => pascalCase(str ?? ''))
  hbs.registerHelper('snakeCase', (str: string) => snakeCase(str ?? ''))
  hbs.registerHelper('kebabCase', (str: string) => kebabCase(str ?? ''))
  hbs.registerHelper('constantCase', (str: string) => constantCase(str ?? ''))
  hbs.registerHelper('upperCase', (str: string) => (str ?? '').toUpperCase())
  hbs.registerHelper('lowerCase', (str: string) => (str ?? '').toLowerCase())

  // Comparison helpers
  hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b)
  hbs.registerHelper('ne', (a: unknown, b: unknown) => a !== b)
  hbs.registerHelper('and', (a: unknown, b: unknown) => Boolean(a) && Boolean(b))
  hbs.registerHelper('or', (a: unknown, b: unknown) => Boolean(a) || Boolean(b))
  hbs.registerHelper('not', (a: unknown) => !a)

  // Array helpers
  hbs.registerHelper('join', (arr: unknown[], separator = ', ') =>
    Array.isArray(arr) ? arr.join(separator) : ''
  )
  hbs.registerHelper('first', (arr: unknown[]) => (Array.isArray(arr) ? arr[0] : undefined))
  hbs.registerHelper('last', (arr: unknown[]) =>
    Array.isArray(arr) ? arr[arr.length - 1] : undefined
  )

  // Attribute-specific helpers
  hbs.registerHelper('required', (attrs: Array<{ required?: boolean }>) =>
    (attrs ?? []).filter((a) => a.required)
  )
  hbs.registerHelper('primaryKeys', (attrs: Array<{ primaryKey?: boolean }>) =>
    (attrs ?? []).filter((a) => a.primaryKey)
  )

  // Model traversal helpers — language-neutral.
  // Primitive list mirrors the type names used in model.json. Both lowercase
  // (date/uuid) and legacy-cased (Date/UUID) variants are accepted.
  const primitives = ['string', 'number', 'boolean', 'Date', 'UUID', 'decimal', 'date', 'uuid']
  hbs.registerHelper('isPrimitive', (type: string) => primitives.includes(type))

  hbs.registerHelper(
    'nonPrimitiveTypes',
    (attrs: Array<Attribute>, options: { data?: { root?: { name?: string } } }) => {
      const entityName = options?.data?.root?.name
      const types = (attrs ?? [])
        // Reference fields are stored as ids (strings), not embedded objects,
        // so they don't pull in a schema/type import.
        .filter((a) => !a.reference)
        .map((a) => a.type)
        .filter((t) => !primitives.includes(t) && t !== entityName)
      return [...new Set(types)]
    }
  )

  // Returns true if any attribute embeds the entity itself (recursive type).
  // Reference-typed self-loops don't count: they're stored as ids, not embedded.
  hbs.registerHelper('isSelfRef', (entityName: string, attrs: Attribute[]) =>
    (attrs ?? []).some((a) => a.type === entityName && !a.reference)
  )
}
