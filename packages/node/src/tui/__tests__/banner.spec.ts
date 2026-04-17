import { describe, expect, it } from 'vitest'

import { renderBanner } from '../banner'

describe('renderBanner', () => {
  it('includes the local URL and shortcut hint', () => {
    const out = renderBanner({
      urls: { local: ['http://localhost:6431/'], network: [] },
      startupMs: 42,
    })
    expect(out).toContain('http://localhost:6431/')
    expect(out).toContain('Local:')
    expect(out).toContain('ready in 42 ms')
    expect(out).toContain('h')
  })

  it('renders network urls when present', () => {
    const out = renderBanner({
      urls: { local: ['http://localhost:6431/'], network: ['http://192.168.1.2:6431/'] },
    })
    expect(out).toContain('192.168.1.2')
  })

  it('hints to use --host when no network urls', () => {
    const out = renderBanner({
      urls: { local: ['http://localhost:6431/'], network: [] },
    })
    expect(out).toContain('use --host to expose')
  })
})
