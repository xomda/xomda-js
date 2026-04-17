import { describe, expect, it } from 'vitest'

import { modeToOctal, modeToSymbolic } from '../mode'

describe('modeToOctal', () => {
  it('formats a common file mode', () => {
    expect(modeToOctal(0o644)).toBe('644')
  })

  it('formats a common executable mode', () => {
    expect(modeToOctal(0o755)).toBe('755')
  })

  it('zero-pads modes with leading zero', () => {
    expect(modeToOctal(0o400)).toBe('400')
    expect(modeToOctal(0o040)).toBe('040')
    expect(modeToOctal(0o004)).toBe('004')
  })

  it('returns 000 for no permissions', () => {
    expect(modeToOctal(0)).toBe('000')
  })

  it('strips file-type bits above 0o777', () => {
    // 0o100644 = regular file with 0o644 perms (real stat output)
    expect(modeToOctal(0o100644)).toBe('644')
    expect(modeToOctal(0o040755)).toBe('755')
  })
})

describe('modeToSymbolic', () => {
  it('formats a typical file mode', () => {
    expect(modeToSymbolic(0o644, false)).toBe('-rw-r--r--')
  })

  it('formats a typical directory mode', () => {
    expect(modeToSymbolic(0o755, true)).toBe('drwxr-xr-x')
  })

  it('renders missing permissions as dashes', () => {
    expect(modeToSymbolic(0o400, false)).toBe('-r--------')
    expect(modeToSymbolic(0, false)).toBe('----------')
  })

  it('formats a fully open mode', () => {
    expect(modeToSymbolic(0o777, false)).toBe('-rwxrwxrwx')
    expect(modeToSymbolic(0o777, true)).toBe('drwxrwxrwx')
  })

  it('ignores file-type bits above 0o777', () => {
    expect(modeToSymbolic(0o100644, false)).toBe('-rw-r--r--')
  })
})
