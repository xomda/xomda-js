import { describe, expect, it } from 'vitest'

import { casingHelpers } from '../casingHelpers'

describe('casingHelpers', () => {
  describe('pascalCase', () => {
    it('converts mixed inputs to PascalCase', () => {
      expect(casingHelpers.pascalCase('hello world')).toBe('HelloWorld')
      expect(casingHelpers.pascalCase('hello_world')).toBe('HelloWorld')
      expect(casingHelpers.pascalCase('hello-world')).toBe('HelloWorld')
      expect(casingHelpers.pascalCase('helloWorld')).toBe('HelloWorld')
    })

    it('handles single tokens', () => {
      expect(casingHelpers.pascalCase('foo')).toBe('Foo')
    })

    it('returns "" for null/undefined input', () => {
      expect(casingHelpers.pascalCase(null as unknown as string)).toBe('')
      expect(casingHelpers.pascalCase(undefined as unknown as string)).toBe('')
    })
  })

  describe('camelCase', () => {
    it('converts mixed inputs to camelCase', () => {
      expect(casingHelpers.camelCase('hello world')).toBe('helloWorld')
      expect(casingHelpers.camelCase('HelloWorld')).toBe('helloWorld')
      expect(casingHelpers.camelCase('hello_world')).toBe('helloWorld')
    })

    it('returns "" for null input', () => {
      expect(casingHelpers.camelCase(null as unknown as string)).toBe('')
    })
  })

  describe('snakeCase', () => {
    it('converts mixed inputs to snake_case', () => {
      expect(casingHelpers.snakeCase('helloWorld')).toBe('hello_world')
      expect(casingHelpers.snakeCase('Hello World')).toBe('hello_world')
      expect(casingHelpers.snakeCase('hello-world')).toBe('hello_world')
    })
  })

  describe('kebabCase', () => {
    it('converts mixed inputs to kebab-case', () => {
      expect(casingHelpers.kebabCase('helloWorld')).toBe('hello-world')
      expect(casingHelpers.kebabCase('Hello World')).toBe('hello-world')
      expect(casingHelpers.kebabCase('hello_world')).toBe('hello-world')
    })
  })

  describe('constantCase', () => {
    it('converts mixed inputs to CONSTANT_CASE', () => {
      expect(casingHelpers.constantCase('helloWorld')).toBe('HELLO_WORLD')
      expect(casingHelpers.constantCase('hello world')).toBe('HELLO_WORLD')
    })
  })

  describe('upperCase / lowerCase', () => {
    it('upper-cases without splitting on word boundaries', () => {
      expect(casingHelpers.upperCase('Hello World')).toBe('HELLO WORLD')
    })

    it('lower-cases without splitting on word boundaries', () => {
      expect(casingHelpers.lowerCase('Hello World')).toBe('hello world')
    })

    it('treats null/undefined as ""', () => {
      expect(casingHelpers.upperCase(null as unknown as string)).toBe('')
      expect(casingHelpers.lowerCase(undefined as unknown as string)).toBe('')
    })
  })

  it('exposes a stable, frozen set of helper keys', () => {
    expect(Object.keys(casingHelpers).sort()).toEqual([
      'camelCase',
      'constantCase',
      'kebabCase',
      'lowerCase',
      'pascalCase',
      'snakeCase',
      'upperCase',
    ])
  })
})
