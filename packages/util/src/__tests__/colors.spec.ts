import { describe, expect, it } from 'vitest'

import { colors } from '../colors'

describe('colors', () => {
  it('re-exports picocolors functions', () => {
    expect(typeof colors.bold).toBe('function')
    expect(typeof colors.red).toBe('function')
    expect(typeof colors.green).toBe('function')
    expect(typeof colors.dim).toBe('function')
  })

  it('color functions return the input string (possibly wrapped in ANSI)', () => {
    // We can't depend on whether picocolors thinks the test env supports color,
    // but the result must always contain the original text verbatim.
    expect(colors.red('hello')).toMatch(/hello/)
    expect(colors.bold('world')).toMatch(/world/)
  })
})
