import { describe, expect, it } from 'vitest'

import { getServerUrls } from '../network'

describe('getServerUrls', () => {
  it('returns a local url for the given port', () => {
    const { local } = getServerUrls(1234)
    expect(local).toEqual(['http://localhost:1234/'])
  })

  it('respects the protocol option', () => {
    const { local } = getServerUrls(1234, 'localhost', 'https')
    expect(local[0]).toBe('https://localhost:1234/')
  })

  it('returns an array for network urls', () => {
    const { network } = getServerUrls(1234)
    expect(Array.isArray(network)).toBe(true)
  })
})
