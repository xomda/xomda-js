import { describe, expect, it } from 'vitest'

import { EntitySchema } from '../entity'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'
const I1 = '11111111-1111-4111-8111-111111111111'
const I2 = '22222222-2222-4222-8222-222222222222'

describe('C3 — Entity superRefine constraints (kind / implements)', () => {
  describe('interface entities may implement other interfaces (fold semantics)', () => {
    it('interface with non-empty implements: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'IUser',
        attributes: [],
        kind: 'interface',
        implements: [I1],
      })
      expect(e.implements).toEqual([I1])
    })

    it('interface with empty implements: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'IUser',
        attributes: [],
        kind: 'interface',
        implements: [],
      })
      expect(e.kind).toBe('interface')
    })

    it('interface without implements key: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'IUser',
        attributes: [],
        kind: 'interface',
      })
      expect(e.kind).toBe('interface')
    })
  })

  describe('default and abstract entities may implement interfaces', () => {
    it('default with implements []: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'User',
        attributes: [],
        kind: 'default',
        implements: [],
      })
      expect(e.implements).toEqual([])
    })

    it('default with implements [I1, I2]: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'User',
        attributes: [],
        kind: 'default',
        implements: [I1, I2],
      })
      expect(e.implements).toEqual([I1, I2])
    })

    it('abstract with implements [I1, I2]: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'UserBase',
        attributes: [],
        kind: 'abstract',
        implements: [I1, I2],
      })
      expect(e.implements).toEqual([I1, I2])
    })
  })

  describe('legacy abstract: true behaves as kind "abstract" for the implements check', () => {
    it('legacy abstract: true with implements [I1]: ok (allowed)', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'UserBase',
        attributes: [],
        kind: 'default' as const,
        abstract: true,
        implements: [I1],
      })
      expect(e.implements).toEqual([I1])
    })
  })

  describe('implements list must contain unique UUIDs', () => {
    it('duplicate UUID in implements: validation error', () => {
      expect(() =>
        EntitySchema.parse({
          id: ID,
          name: 'User',
          attributes: [],
          kind: 'default' as const,
          implements: [I1, I1],
        })
      ).toThrow(/Duplicate UUID in implements/)
    })

    it('distinct UUIDs in implements: ok', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'User',
        attributes: [],
        kind: 'default' as const,
        implements: [I1, I2],
      })
      expect(e.implements).toEqual([I1, I2])
    })
  })

  describe('existing attribute-uniqueness constraint still holds', () => {
    it('duplicate attribute name: validation error', () => {
      expect(() =>
        EntitySchema.parse({
          id: ID,
          name: 'User',
          attributes: [
            { id: '11111111-1111-4111-8111-aaaaaaaaaaaa', name: 'email', type: 'string' },
            { id: '22222222-2222-4222-8222-bbbbbbbbbbbb', name: 'email', type: 'string' },
          ],
        })
      ).toThrow(/must be unique within an entity/)
    })
  })
})
