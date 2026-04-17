import { describe, expect, it } from 'vitest'

import { buildVariablesLib } from '../cellContextLib'

describe('buildVariablesLib', () => {
  it('emits a declare const per valid identifier', () => {
    expect(buildVariablesLib(['foo', 'bar'])).toBe('declare const foo: any\ndeclare const bar: any\n')
  })

  it('skips undefined and empty entries', () => {
    expect(buildVariablesLib([undefined, '', 'foo'])).toBe('declare const foo: any\n')
  })

  it('skips sealed keys to avoid clashing with the static lib', () => {
    expect(buildVariablesLib(['model', 'console', '$ctx', 'pascalCase', 'foo'])).toBe(
      'declare const foo: any\n'
    )
  })

  it('skips invalid identifiers', () => {
    expect(buildVariablesLib(['1foo', 'has-dash', 'has space', 'ok_name'])).toBe(
      'declare const ok_name: any\n'
    )
  })

  it('deduplicates repeated names', () => {
    expect(buildVariablesLib(['foo', 'foo', 'bar'])).toBe(
      'declare const foo: any\ndeclare const bar: any\n'
    )
  })

  it('returns an empty string when nothing is declarable', () => {
    expect(buildVariablesLib([undefined, 'model', '1bad'])).toBe('')
  })
})
