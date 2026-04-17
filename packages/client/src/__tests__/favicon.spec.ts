import { describe, expect, it } from 'vitest'

import { favicon, setFaviconSvg } from '../favicon'

describe('favicon', () => {
  it('default value is a data URI SVG', () => {
    expect(favicon.value).toMatch(/^data:image\/svg\+xml;utf8,/)
    expect(favicon.value).toContain('<svg')
  })

  it('setFaviconSvg wraps the SVG into a data URI and updates the ref', () => {
    const original = favicon.value
    try {
      setFaviconSvg('<svg viewBox="0 0 10 10"><circle r="5"/></svg>')
      expect(favicon.value).toBe(
        "data:image/svg+xml;utf8,<svg viewBox='0 0 10 10'><circle r='5'/></svg>"
      )
    } finally {
      favicon.value = original
    }
  })

  it('percent-escapes "#" so URL-fragment chars in the SVG don’t truncate the data URI', () => {
    const original = favicon.value
    try {
      setFaviconSvg('<svg fill="#1867c0"><path d="M0 0"/></svg>')
      expect(favicon.value).not.toContain('#1867c0')
      expect(favicon.value).toContain('%231867c0')
    } finally {
      favicon.value = original
    }
  })

  it('assigning favicon.value directly works for URLs and pre-encoded data URIs', () => {
    const original = favicon.value
    try {
      favicon.value = 'https://example.com/icon.png'
      expect(favicon.value).toBe('https://example.com/icon.png')
    } finally {
      favicon.value = original
    }
  })
})
