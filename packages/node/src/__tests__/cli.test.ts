import { describe, expect, it } from 'vitest'

import { parseArgs } from '../cli'

describe('parseArgs', () => {
  it('returns defaults with no args', () => {
    expect(parseArgs([])).toEqual({ open: false })
  })

  it('parses --open', () => {
    expect(parseArgs(['--open'])).toEqual({ open: true })
  })

  it('parses --port <number>', () => {
    expect(parseArgs(['--port', '12345'])).toEqual({ open: false, port: 12345 })
  })

  it('parses --port=<number>', () => {
    expect(parseArgs(['--port=8080'])).toEqual({ open: false, port: 8080 })
  })

  it('combines flags in any order', () => {
    expect(parseArgs(['--open', '--port', '9000'])).toEqual({ open: true, port: 9000 })
    expect(parseArgs(['--port=9000', '--open'])).toEqual({ open: true, port: 9000 })
  })

  it('rejects non-numeric port', () => {
    expect(() => parseArgs(['--port', 'abc'])).toThrow(/valid port/i)
  })

  it('rejects out-of-range port', () => {
    expect(() => parseArgs(['--port', '70000'])).toThrow(/valid port/i)
    expect(() => parseArgs(['--port', '-1'])).toThrow(/valid port/i)
  })

  it('rejects --port without value', () => {
    expect(() => parseArgs(['--port'])).toThrow(/valid port/i)
  })
})
