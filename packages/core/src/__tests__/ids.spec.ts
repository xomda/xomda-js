import { describe, expect, expectTypeOf, it } from 'vitest'

import type { AttributeId, EntityId, PackageId } from '../ids'
import { asEntityId, asPackageId, AttributeIdSchema, EntityIdSchema, PackageIdSchema } from '../ids'

describe('branded ID schemas', () => {
  it('parses a valid UUID and brands it', () => {
    const raw = '00000000-0000-4000-8000-000000000001'
    const id = EntityIdSchema.parse(raw)
    expect(id).toBe(raw)
    expectTypeOf(id).toEqualTypeOf<EntityId>()
  })

  it('rejects non-UUID input at parse time', () => {
    expect(() => EntityIdSchema.parse('not-a-uuid')).toThrow()
  })

  it('rejects a UUID claimed as the wrong kind via type', () => {
    // Both pointers are UUIDs; the test is purely about type discipline.
    // A consumer that types a parameter as `EntityId` will refuse a
    // `PackageId` at compile time.
    const pkg = PackageIdSchema.parse('00000000-0000-4000-8000-000000000002')
    expectTypeOf(pkg).toEqualTypeOf<PackageId>()
    expectTypeOf(pkg).not.toEqualTypeOf<EntityId>()
  })

  it('asXxxId helpers stamp without re-parsing', () => {
    // Use at trust boundaries when the source has already been validated.
    const id = asEntityId('any-string')
    expectTypeOf(id).toEqualTypeOf<EntityId>()
  })

  it('cross-brand assignment fails at compile time (smoke check)', () => {
    const ent: EntityId = asEntityId('e')
    const pkg: PackageId = asPackageId('p')
    // @ts-expect-error — assigning PackageId to EntityId is the bug class
    // these brands prevent. Removing the brand-cast would error here.
    const _wrong: EntityId = pkg
    void _wrong
    expectTypeOf(ent).not.toEqualTypeOf<PackageId>()
  })

  it('branded ID widens to plain string at assignment (one-way)', () => {
    // A consumer typed as `(id: string) => void` accepts any branded ID
    // unchanged — this is how branding stays opt-in for existing APIs.
    const attr: AttributeId = AttributeIdSchema.parse('00000000-0000-4000-8000-000000000003')
    const accept = (s: string): string => s
    expect(accept(attr)).toBe(attr)
  })
})
