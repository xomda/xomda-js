import { describe, expect, it } from 'vitest'

import type { Visibility } from '../../visibility/index'
import { getOwnVisibility, minVisibility, VISIBILITY_VALUES } from '../../visibility/index'
import { EntitySchema } from '../entity'
import { PackageSchema } from '../package'

const ID = '46c4e0d3-8d04-44a1-bb5e-9d6f57001618'
const PID = '11111111-1111-4111-8111-111111111111'

describe('D1 — Visibility field on Entity and Package', () => {
  it('VISIBILITY_VALUES is the locked three-value tuple', () => {
    expect(VISIBILITY_VALUES).toEqual(['public', 'package-private', 'model-private'])
  })

  describe('Entity', () => {
    it('legacy entity without visibility key reads as effective "public"', () => {
      const e = EntitySchema.parse({
        id: ID,
        name: 'User',
        kind: 'default' as const,
        attributes: [],
      })
      expect(e.visibility).toBeUndefined()
      expect(getOwnVisibility(e)).toBe<Visibility>('public')
    })

    it('round-trips each visibility value', () => {
      for (const v of VISIBILITY_VALUES) {
        const e = EntitySchema.parse({
          id: ID,
          name: 'User',
          attributes: [],
          kind: 'default' as const,
          visibility: v,
        })
        expect(e.visibility).toBe(v)
        const reParsed = EntitySchema.parse(JSON.parse(JSON.stringify(e)))
        expect(reParsed.visibility).toBe(v)
      }
    })

    it('rejects an unknown visibility value', () => {
      expect(() =>
        EntitySchema.parse({
          id: ID,
          name: 'User',
          attributes: [],
          kind: 'default' as const,
          visibility: 'protected' as Visibility,
        })
      ).toThrow()
    })
  })

  describe('Package', () => {
    it('legacy package without visibility key reads as effective "public"', () => {
      const p = PackageSchema.parse({
        id: PID,
        name: 'security',
        packages: [],
        enums: [],
        entities: [],
      })
      expect(p.visibility).toBeUndefined()
      expect(getOwnVisibility(p)).toBe<Visibility>('public')
    })

    it('round-trips each visibility value', () => {
      for (const v of VISIBILITY_VALUES) {
        const p = PackageSchema.parse({
          id: PID,
          name: 'security',
          packages: [],
          enums: [],
          entities: [],
          visibility: v,
        })
        expect(p.visibility).toBe(v)
      }
    })

    it('rejects an unknown visibility value', () => {
      expect(() =>
        PackageSchema.parse({
          id: PID,
          name: 'security',
          packages: [],
          enums: [],
          entities: [],
          visibility: 'protected' as Visibility,
        })
      ).toThrow()
    })
  })

  describe('minVisibility — most-restrictive narrowing', () => {
    it('model-private is the most restrictive', () => {
      expect(minVisibility('public', 'model-private')).toBe<Visibility>('model-private')
      expect(minVisibility('package-private', 'model-private')).toBe<Visibility>('model-private')
    })

    it('package-private is more restrictive than public', () => {
      expect(minVisibility('public', 'package-private')).toBe<Visibility>('package-private')
    })

    it('identity when both are equal', () => {
      for (const v of VISIBILITY_VALUES) {
        expect(minVisibility(v, v)).toBe(v)
      }
    })
  })
})
