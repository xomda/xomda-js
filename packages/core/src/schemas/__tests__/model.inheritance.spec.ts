import { describe, expect, it } from 'vitest'

import type { Entity, EntityKind } from '../entity'
import { ModelSchema } from '../model'

const MID = '00000000-0000-4000-8000-000000000001'
const PID = '00000000-0000-4000-8000-000000000002'

let _seq = 100
const newId = (): string => `00000000-0000-4000-8000-${String(++_seq).padStart(12, '0')}`

interface EntityInput {
  id?: string
  name: string
  kind?: EntityKind
  extends?: string
  implements?: string[]
}

const ent = (input: EntityInput): Entity => ({
  id: input.id ?? newId(),
  name: input.name,
  attributes: [],
  kind: input.kind ?? 'default',
  extends: input.extends,
  implements: input.implements,
})

const buildModel = (entities: Entity[]): unknown => ({
  id: MID,
  name: 'M',
  version: '1.0.0',
  packages: [
    {
      id: PID,
      name: 'p',
      packages: [],
      enums: [],
      entities,
    },
  ],
})

describe('C4 — Model-level inheritance constraints', () => {
  describe('extends — child-kind → parent-kind compatibility', () => {
    it('default extends abstract: ok', () => {
      const parent = ent({ name: 'Base', kind: 'abstract' })
      const child = ent({ name: 'User', kind: 'default', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).not.toThrow()
    })

    it('default extends default: validation error', () => {
      const parent = ent({ name: 'Parent', kind: 'default' })
      const child = ent({ name: 'Child', kind: 'default', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).toThrow(
        /can only extend an entity of kind/
      )
    })

    it('default extends interface: validation error', () => {
      const parent = ent({ name: 'IParent', kind: 'interface' })
      const child = ent({ name: 'Child', kind: 'default', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).toThrow(
        /can only extend an entity of kind/
      )
    })

    it('abstract extends abstract: ok', () => {
      const parent = ent({ name: 'Base', kind: 'abstract' })
      const child = ent({ name: 'MidBase', kind: 'abstract', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).not.toThrow()
    })

    it('abstract extends default: validation error', () => {
      const parent = ent({ name: 'Concrete', kind: 'default' })
      const child = ent({ name: 'Base', kind: 'abstract', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).toThrow(
        /can only extend an entity of kind/
      )
    })

    it('interface extends interface: ok', () => {
      const parent = ent({ name: 'IBase', kind: 'interface' })
      const child = ent({ name: 'IUser', kind: 'interface', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).not.toThrow()
    })

    it('interface extends abstract: validation error', () => {
      const parent = ent({ name: 'Base', kind: 'abstract' })
      const child = ent({ name: 'IUser', kind: 'interface', extends: parent.id })
      expect(() => ModelSchema.parse(buildModel([parent, child]))).toThrow(
        /can only extend an entity of kind/
      )
    })
  })

  describe('implements — target must be of kind "interface"', () => {
    it('implements points to interface: ok', () => {
      const iface = ent({ name: 'IUser', kind: 'interface' })
      const user = ent({ name: 'User', kind: 'default', implements: [iface.id] })
      expect(() => ModelSchema.parse(buildModel([iface, user]))).not.toThrow()
    })

    it('implements points to abstract: validation error', () => {
      const base = ent({ name: 'Base', kind: 'abstract' })
      const user = ent({ name: 'User', kind: 'default', implements: [base.id] })
      expect(() => ModelSchema.parse(buildModel([base, user]))).toThrow(
        /implements must target an entity of kind/
      )
    })

    it('implements points to default: validation error', () => {
      const target = ent({ name: 'Mixin', kind: 'default' })
      const user = ent({ name: 'User', kind: 'default', implements: [target.id] })
      expect(() => ModelSchema.parse(buildModel([target, user]))).toThrow(
        /implements must target an entity of kind/
      )
    })
  })

  describe('cycle detection over extends + implements graph', () => {
    it('cycle A extends B extends A: validation error', () => {
      const a = ent({ id: newId(), name: 'A', kind: 'abstract' })
      const b = ent({ id: newId(), name: 'B', kind: 'abstract', extends: a.id })
      a.extends = b.id
      expect(() => ModelSchema.parse(buildModel([a, b]))).toThrow(/Inheritance cycle detected/)
    })

    it('cycle A implements I; I extends J; J implements (back to A): validation error', () => {
      const aId = newId()
      const iId = newId()
      const jId = newId()
      const a = ent({ id: aId, name: 'A', kind: 'default', implements: [iId] })
      const i = ent({ id: iId, name: 'I', kind: 'interface', extends: jId })
      // Set up an impossible cycle: J's extends loops back to I (interface chain)
      const j = ent({ id: jId, name: 'J', kind: 'interface', extends: iId })
      expect(() => ModelSchema.parse(buildModel([a, i, j]))).toThrow(/Inheritance cycle detected/)
    })

    it('non-cyclic graph with mixed extends + implements: ok', () => {
      const ifaceA = ent({ id: newId(), name: 'IA', kind: 'interface' })
      const ifaceB = ent({ id: newId(), name: 'IB', kind: 'interface', extends: ifaceA.id })
      const base = ent({ id: newId(), name: 'Base', kind: 'abstract' })
      const user = ent({
        id: newId(),
        name: 'User',
        kind: 'default',
        extends: base.id,
        implements: [ifaceA.id, ifaceB.id],
      })
      expect(() => ModelSchema.parse(buildModel([ifaceA, ifaceB, base, user]))).not.toThrow()
    })
  })

  describe('cross-model targets are deferred (not validated here)', () => {
    it('extends target UUID not in this model: no validation error', () => {
      const stranger = '00000000-0000-4000-8000-ffffffffffff'
      const child = ent({ name: 'User', kind: 'default', extends: stranger })
      expect(() => ModelSchema.parse(buildModel([child]))).not.toThrow()
    })

    it('implements target UUID not in this model: no validation error', () => {
      const stranger = '00000000-0000-4000-8000-ffffffffffff'
      const child = ent({ name: 'User', kind: 'default', implements: [stranger] })
      expect(() => ModelSchema.parse(buildModel([child]))).not.toThrow()
    })
  })
})
