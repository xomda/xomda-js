import { describe, expect, it } from 'vitest'

import { compile, getEngine, render } from '../handlebarsEngine'

describe('handlebarsEngine', () => {
  describe('render', () => {
    it('renders simple interpolation', () => {
      expect(render('hello {{name}}', { name: 'world' })).toBe('hello world')
    })

    it('exposes the casing helpers registered by registerHelpers', () => {
      expect(render('{{pascalCase name}}', { name: 'hello world' })).toBe('HelloWorld')
      expect(render('{{snakeCase name}}', { name: 'helloWorld' })).toBe('hello_world')
    })

    it('exposes comparison helpers', () => {
      const tpl = '{{#if (eq a b)}}equal{{else}}not{{/if}}'
      expect(render(tpl, { a: 1, b: 1 })).toBe('equal')
      expect(render(tpl, { a: 1, b: 2 })).toBe('not')
    })

    it('renders missing variables as empty strings', () => {
      expect(render('x={{x}}', {})).toBe('x=')
    })
  })

  describe('compile', () => {
    it('returns a reusable delegate', () => {
      const tpl = compile('{{n}}')
      expect(tpl({ n: 1 })).toBe('1')
      expect(tpl({ n: 2 })).toBe('2')
    })
  })

  describe('getEngine', () => {
    it('returns the same Handlebars singleton on subsequent calls (idempotent init)', () => {
      const a = getEngine()
      const b = getEngine()
      expect(a).toBe(b)
    })

    it('has the casing helpers registered', () => {
      const engine = getEngine()
      expect(typeof engine.helpers.pascalCase).toBe('function')
      expect(typeof engine.helpers.camelCase).toBe('function')
    })
  })
})
