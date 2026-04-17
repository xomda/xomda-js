import { describe, expect, it } from 'vitest'

import { parseTrpcError, setTransportFallbackMessage } from '../parseTrpcError'

describe('parseTrpcError', () => {
  describe('transport failures', () => {
    it('flags TypeError fetch failed as transport', () => {
      const err = Object.assign(new TypeError('fetch failed'), { name: 'TypeError' })
      const out = parseTrpcError(err)
      expect(out.transport).toBe(true)
      expect(out.message).toMatch(/@xomda\/node/)
      expect(out.fields).toEqual([])
    })

    it('flags errors with TypeError cause as transport', () => {
      const cause = Object.assign(new TypeError('fetch failed'), { name: 'TypeError' })
      const err = Object.assign(new Error('Request failed'), { cause })
      const out = parseTrpcError(err)
      expect(out.transport).toBe(true)
    })

    it('recurses through a multi-level cause chain (tRPC v11 wraps wrappers)', () => {
      const root = Object.assign(new TypeError('fetch failed'), { name: 'TypeError' })
      const mid = Object.assign(new Error('Inner wrapper'), { cause: root })
      const outer = Object.assign(new Error('Outer wrapper'), { cause: mid })
      expect(parseTrpcError(outer).transport).toBe(true)
    })

    it('detects browser-specific fetch failure phrases', () => {
      const chrome = Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' })
      const firefox = Object.assign(
        new TypeError('NetworkError when attempting to fetch resource.'),
        { name: 'TypeError' }
      )
      const safari = Object.assign(new TypeError('Load failed'), { name: 'TypeError' })
      expect(parseTrpcError(chrome).transport).toBe(true)
      expect(parseTrpcError(firefox).transport).toBe(true)
      expect(parseTrpcError(safari).transport).toBe(true)
    })

    it('does not loop forever on a cyclic cause chain', () => {
      const a = { name: 'Error', message: 'a' } as {
        name?: string
        message?: string
        cause?: unknown
      }
      const b = { name: 'Error', message: 'b', cause: a } as typeof a
      a.cause = b
      expect(() => parseTrpcError(a)).not.toThrow()
      expect(parseTrpcError(a).transport).toBe(false)
    })

    it('honours a custom transport message via setTransportFallbackMessage', () => {
      const original = parseTrpcError(
        Object.assign(new TypeError('fetch failed'), { name: 'TypeError' })
      ).message
      setTransportFallbackMessage('Server unavailable.')
      try {
        const out = parseTrpcError(
          Object.assign(new TypeError('fetch failed'), { name: 'TypeError' })
        )
        expect(out.message).toBe('Server unavailable.')
      } finally {
        // Restore so other tests see the default.
        setTransportFallbackMessage(original)
      }
    })
  })

  describe('Zod validation errors via tRPC fieldErrors', () => {
    it('extracts each fieldError into a field entry', () => {
      const err = {
        message: 'BAD_REQUEST',
        data: {
          code: 'BAD_REQUEST',
          zodError: {
            fieldErrors: {
              name: ['Required'],
              version: ['Not a valid version'],
            },
          },
        },
      }
      const out = parseTrpcError(err)
      expect(out.code).toBe('BAD_REQUEST')
      expect(out.transport).toBe(false)
      expect(out.fields).toEqual(
        expect.arrayContaining([
          { message: 'Required', path: ['name'] },
          { message: 'Not a valid version', path: ['version'] },
        ])
      )
      expect(out.message).toBe(out.fields[0].message)
    })

    it('extracts issues[] when fieldErrors absent', () => {
      const err = {
        message: 'BAD_REQUEST',
        data: {
          code: 'BAD_REQUEST',
          zodError: {
            issues: [
              { path: ['cells', 0, 'type'], message: 'Invalid cell type' },
              { path: ['name'], message: 'Required' },
            ],
          },
        },
      }
      const out = parseTrpcError(err)
      expect(out.fields).toHaveLength(2)
      expect(out.fields[0]).toEqual({ message: 'Invalid cell type', path: ['cells', 0, 'type'] })
    })

    it('falls back to a friendly "Validation failed" message when zodError is present but empty', () => {
      // Newer Zod versions can emit `{ fieldErrors: {} }` for non-object
      // schemas or after `flatten()` on an empty issue set. Previously the
      // toast surfaced the raw `BAD_REQUEST` string — cryptic for users.
      // Contract: when we KNOW it's a validation failure (the zodError
      // shape is present) but can't extract specific field messages, say so.
      const err = {
        message: 'BAD_REQUEST',
        data: { code: 'BAD_REQUEST', zodError: { fieldErrors: {} } },
      }
      const out = parseTrpcError(err)
      expect(out.code).toBe('BAD_REQUEST')
      expect(out.fields).toEqual([])
      expect(out.message).toBe('Validation failed')
      expect(out.transport).toBe(false)
    })

    it('falls back to "Validation failed" when issues[] is present but empty', () => {
      const err = {
        message: 'BAD_REQUEST',
        data: { code: 'BAD_REQUEST', zodError: { issues: [] } },
      }
      const out = parseTrpcError(err)
      expect(out.message).toBe('Validation failed')
      expect(out.fields).toEqual([])
    })
  })

  describe('legacy JSON-stringified Zod issues', () => {
    it('parses an Error whose message is a JSON array of issues', () => {
      const err = new Error(
        JSON.stringify([{ message: 'Required', path: ['name'] }, { message: 'Too short' }])
      )
      const out = parseTrpcError(err)
      expect(out.fields).toEqual([
        { message: 'Required', path: ['name'] },
        { message: 'Too short', path: [] },
      ])
      expect(out.message).toBe('Required')
    })
  })

  describe('plain server errors', () => {
    it('preserves message and code', () => {
      const err = { message: 'Entity not found', data: { code: 'NOT_FOUND' } }
      const out = parseTrpcError(err)
      expect(out.message).toBe('Entity not found')
      expect(out.code).toBe('NOT_FOUND')
      expect(out.fields).toEqual([])
      expect(out.transport).toBe(false)
    })
  })

  describe('fallbacks', () => {
    it('handles Error instances with a message (preserves message + empty fields)', () => {
      const out = parseTrpcError(new Error('oh no'))
      expect(out.message).toBe('oh no')
      expect(out.fields).toEqual([])
      expect(out.transport).toBe(false)
    })

    it('falls back to "Unexpected error" for an Error with no message', () => {
      // Some libraries throw `new Error()` with no argument.
      const e = new Error()
      const out = parseTrpcError(e)
      expect(out.message).toBe('Unexpected error')
    })

    it('handles primitive throws', () => {
      expect(parseTrpcError('boom').message).toBe('boom')
      expect(parseTrpcError(null).message).toBe('Unexpected error')
      expect(parseTrpcError(undefined).message).toBe('Unexpected error')
    })

    it('falls back to "Unexpected error" when message is empty', () => {
      const out = parseTrpcError({ message: '', data: undefined })
      expect(out.message).toBe('Unexpected error')
    })
  })
})
