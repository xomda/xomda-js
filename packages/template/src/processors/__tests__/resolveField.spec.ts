import { describe, expect, it } from 'vitest'

import { resolveField } from '../resolveField'

describe('resolveField', () => {
  it('returns "" for undefined field', () => {
    expect(resolveField(undefined, {})).toBe('')
  })

  it('returns "" for empty string field', () => {
    expect(resolveField('', { foo: 'bar' })).toBe('')
  })

  it('passes literal strings through unchanged when no handlebars present', () => {
    expect(resolveField('out.txt', { x: 1 })).toBe('out.txt')
  })

  it('interpolates handlebars expressions', () => {
    expect(resolveField('{{name}}.txt', { name: 'demo' })).toBe('demo.txt')
  })

  it('applies casing helpers via the engine', () => {
    expect(resolveField('{{pascalCase name}}.ts', { name: 'user profile' })).toBe('UserProfile.ts')
  })

  it('resolves dotted context paths', () => {
    expect(resolveField('{{entity.name}}.ts', { entity: { name: 'Foo' } })).toBe('Foo.ts')
  })

  it('renders missing values as empty', () => {
    expect(resolveField('{{missing}}.ts', {})).toBe('.ts')
  })
})
