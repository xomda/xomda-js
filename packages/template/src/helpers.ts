import type { Attribute } from '@xomda/core'
import { camelCase, constantCase, kebabCase, pascalCase, snakeCase } from 'change-case'
import Handlebars from 'handlebars'

/**
 * Registers Handlebars helpers for code generation.
 * All string-case helpers are compatible with the jknack/handlebars.java
 * StringHelpers (CamelCaseHelper, etc.).
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

  // Type helpers — includes both legacy-cased (Date, UUID) and model.json lowercase variants
  const primitives = ['string', 'number', 'boolean', 'Date', 'UUID', 'decimal', 'date', 'uuid']
  hbs.registerHelper('isPrimitive', (type: string) => primitives.includes(type))

  hbs.registerHelper('javaType', (type: string) => {
    const map: Record<string, string> = {
      string: 'String',
      number: 'Integer',
      boolean: 'Boolean',
      Date: 'Date',
      UUID: 'UUID',
      decimal: 'BigDecimal',
    }
    return map[type] || pascalCase(type)
  })

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

  // Emits the full Zod chain for a single attribute, suitable for use in z.object({...}).
  hbs.registerHelper('zodType', (attr: Attribute & { defaultValue?: string }) => {
    const primitiveZod: Record<string, string> = {
      string: 'z.string()',
      number: 'z.number()',
      boolean: 'z.boolean()',
      decimal: 'z.number()',
      date: 'z.string().datetime()',
      uuid: 'z.string().uuid()',
    }

    let base: string
    const isPrimitive = attr.type in primitiveZod
    if (attr.reference && !isPrimitive) {
      // Stored as the referenced element's id.
      base = 'z.string().uuid()'
    } else if (isPrimitive) {
      base = primitiveZod[attr.type]
      if (attr.primaryKey && attr.type === 'uuid') {
        base += '.default(() => crypto.randomUUID())'
      } else if (attr.defaultValue !== undefined && attr.defaultValue !== '') {
        const isString = attr.type === 'string'
        const val = isString ? `'${attr.defaultValue}'` : attr.defaultValue
        base += `.default(${val})`
      } else if (attr.type === 'boolean') {
        base += '.default(false)'
      }
      if (attr.required && attr.type === 'string' && !attr.defaultValue) {
        base = 'z.string().min(1)'
      }
    } else {
      base = `${pascalCase(attr.type)}Schema`
    }

    if (attr.multiValue) {
      base = `z.array(${base}).default([])`
    } else if (!attr.required && !attr.primaryKey) {
      base += '.optional()'
    }

    return new Handlebars.SafeString(base)
  })

  // Emits the TypeScript type expression for an attribute (used in manual type declarations).
  hbs.registerHelper('tsType', (attr: Attribute) => {
    const tsMap: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      decimal: 'number',
      date: 'string',
      uuid: 'string',
    }
    const isPrimitive = attr.type in tsMap
    let base: string
    if (attr.reference && !isPrimitive) {
      base = 'string'
    } else {
      base = tsMap[attr.type] ?? pascalCase(attr.type ?? '')
    }
    if (attr.multiValue) base += '[]'
    return new Handlebars.SafeString(base)
  })
}
