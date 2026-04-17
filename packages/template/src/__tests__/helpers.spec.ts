import Handlebars from 'handlebars'
import { beforeEach, describe, expect, it } from 'vitest'

import { registerHelpers } from '../helpers'

describe('registerHelpers', () => {
  let hbs: typeof Handlebars

  beforeEach(() => {
    // Each test gets an isolated Handlebars instance so helpers from one test
    // can't bleed into another.
    hbs = Handlebars.create()
    registerHelpers(hbs)
  })

  const render = (template: string, context: Record<string, unknown> = {}): string =>
    hbs.compile(template)(context)

  describe('casing helpers (registered as Handlebars helpers)', () => {
    it('exposes pascalCase / camelCase / snakeCase / kebabCase / constantCase / upperCase / lowerCase', () => {
      expect(render('{{pascalCase name}}', { name: 'hello world' })).toBe('HelloWorld')
      expect(render('{{camelCase name}}', { name: 'hello world' })).toBe('helloWorld')
      expect(render('{{snakeCase name}}', { name: 'helloWorld' })).toBe('hello_world')
      expect(render('{{kebabCase name}}', { name: 'helloWorld' })).toBe('hello-world')
      expect(render('{{constantCase name}}', { name: 'helloWorld' })).toBe('HELLO_WORLD')
      expect(render('{{upperCase name}}', { name: 'hi there' })).toBe('HI THERE')
      expect(render('{{lowerCase name}}', { name: 'HI THERE' })).toBe('hi there')
    })
  })

  describe('comparison helpers', () => {
    it('eq returns "true" for strict equality only', () => {
      expect(render('{{eq a b}}', { a: 1, b: 1 })).toBe('true')
      expect(render('{{eq a b}}', { a: 1, b: '1' })).toBe('false')
      expect(render('{{eq a b}}', { a: 1, b: 2 })).toBe('false')
    })

    it('ne is the negation of eq', () => {
      expect(render('{{ne a b}}', { a: 1, b: 2 })).toBe('true')
      expect(render('{{ne a b}}', { a: 1, b: 1 })).toBe('false')
    })

    it('and / or coerce truthiness', () => {
      expect(render('{{and a b}}', { a: 'x', b: 1 })).toBe('true')
      expect(render('{{and a b}}', { a: 'x', b: 0 })).toBe('false')
      expect(render('{{or a b}}', { a: 0, b: 0 })).toBe('false')
      expect(render('{{or a b}}', { a: 0, b: 'x' })).toBe('true')
    })

    it('not negates truthiness', () => {
      expect(render('{{not a}}', { a: 0 })).toBe('true')
      expect(render('{{not a}}', { a: 1 })).toBe('false')
    })
  })

  describe('array helpers', () => {
    it('join joins with the provided separator', () => {
      expect(render('{{join xs " | "}}', { xs: [1, 2, 3] })).toBe('1 | 2 | 3')
    })

    it('join can use an empty separator to concatenate without delimiter', () => {
      expect(render('{{join xs ""}}', { xs: ['a', 'b', 'c'] })).toBe('abc')
    })

    it('join returns "" for non-arrays', () => {
      expect(render('{{join xs}}', { xs: null })).toBe('')
      expect(render('{{join xs}}', { xs: undefined })).toBe('')
      expect(render('{{join xs}}', { xs: 'oops' })).toBe('')
    })

    it('first / last return the boundary elements (or empty string for non-arrays)', () => {
      expect(render('{{first xs}}', { xs: ['a', 'b', 'c'] })).toBe('a')
      expect(render('{{last xs}}', { xs: ['a', 'b', 'c'] })).toBe('c')
      expect(render('{{first xs}}', { xs: [] })).toBe('')
      expect(render('{{first xs}}', { xs: null })).toBe('')
      expect(render('{{last xs}}', { xs: null })).toBe('')
    })
  })

  describe('attribute helpers', () => {
    it('required filters to attributes with required=true', () => {
      const attrs = [{ name: 'a', required: true }, { name: 'b', required: false }, { name: 'c' }]
      const out = (hbs.helpers.required as (a: unknown[]) => unknown[])(attrs) as Array<{
        name: string
      }>
      expect(out.map((a) => a.name)).toEqual(['a'])
    })

    it('primaryKeys filters to attributes with primaryKey=true', () => {
      const attrs = [{ name: 'a', primaryKey: true }, { name: 'b' }]
      const out = (hbs.helpers.primaryKeys as (a: unknown[]) => unknown[])(attrs) as Array<{
        name: string
      }>
      expect(out.map((a) => a.name)).toEqual(['a'])
    })

    it('required and primaryKeys treat null/undefined input as empty', () => {
      expect((hbs.helpers.required as (a: unknown) => unknown[])(null)).toEqual([])
      expect((hbs.helpers.primaryKeys as (a: unknown) => unknown[])(undefined)).toEqual([])
    })
  })

  describe('isPrimitive', () => {
    it('accepts the canonical primitive type names', () => {
      const isPrimitive = hbs.helpers.isPrimitive as (s: string) => boolean
      for (const p of ['string', 'number', 'boolean', 'date', 'uuid', 'decimal']) {
        expect(isPrimitive(p)).toBe(true)
      }
    })

    it('accepts legacy-cased aliases (Date, UUID)', () => {
      const isPrimitive = hbs.helpers.isPrimitive as (s: string) => boolean
      expect(isPrimitive('Date')).toBe(true)
      expect(isPrimitive('UUID')).toBe(true)
    })

    it('rejects user-defined types', () => {
      const isPrimitive = hbs.helpers.isPrimitive as (s: string) => boolean
      expect(isPrimitive('Customer')).toBe(false)
      expect(isPrimitive('')).toBe(false)
    })
  })

  describe('nonPrimitiveTypes', () => {
    type Helper = (attrs: unknown[], options?: { data?: { root?: { name?: string } } }) => unknown[]

    it('returns unique non-primitive types referenced by an entity', () => {
      const helper = hbs.helpers.nonPrimitiveTypes as Helper
      const result = helper(
        [
          { name: 'id', type: 'uuid' },
          { name: 'owner', type: 'User' },
          { name: 'manager', type: 'User' },
          { name: 'address', type: 'Address' },
        ],
        { data: { root: { name: 'Customer' } } }
      )
      expect(result).toEqual(['User', 'Address'])
    })

    it('excludes the entity name itself (self-reference)', () => {
      const helper = hbs.helpers.nonPrimitiveTypes as Helper
      const result = helper(
        [
          { name: 'parent', type: 'Customer' },
          { name: 'note', type: 'string' },
        ],
        { data: { root: { name: 'Customer' } } }
      )
      expect(result).toEqual([])
    })

    it('excludes reference-typed fields (stored as ids, not embedded)', () => {
      const helper = hbs.helpers.nonPrimitiveTypes as Helper
      const result = helper(
        [
          { name: 'owner', type: 'User', reference: true },
          { name: 'address', type: 'Address' },
        ],
        { data: { root: { name: 'Customer' } } }
      )
      expect(result).toEqual(['Address'])
    })

    it('returns [] for null/empty input', () => {
      const helper = hbs.helpers.nonPrimitiveTypes as Helper
      expect(helper(null as unknown as unknown[], { data: { root: { name: 'X' } } })).toEqual([])
      expect(helper([], { data: { root: { name: 'X' } } })).toEqual([])
    })
  })

  describe('isSelfRef', () => {
    type Helper = (entityName: string, attrs: unknown[]) => boolean

    it('returns true when any attribute embeds the entity itself', () => {
      const helper = hbs.helpers.isSelfRef as Helper
      expect(helper('Node', [{ type: 'string' }, { type: 'Node' }])).toBe(true)
    })

    it('returns false when the only self-typed attribute is a reference (stored as id)', () => {
      const helper = hbs.helpers.isSelfRef as Helper
      expect(helper('Node', [{ type: 'Node', reference: true }])).toBe(false)
    })

    it('returns false when no attributes are self-typed', () => {
      const helper = hbs.helpers.isSelfRef as Helper
      expect(helper('Node', [{ type: 'string' }])).toBe(false)
    })

    it('returns false for null/empty attrs', () => {
      const helper = hbs.helpers.isSelfRef as Helper
      expect(helper('Node', null as unknown as unknown[])).toBe(false)
      expect(helper('Node', [])).toBe(false)
    })
  })

  it('registers on the default Handlebars singleton when no instance is passed', () => {
    // Call with no argument; verify a helper appears on the default Handlebars.
    registerHelpers()
    expect(typeof Handlebars.helpers.pascalCase).toBe('function')
  })
})
