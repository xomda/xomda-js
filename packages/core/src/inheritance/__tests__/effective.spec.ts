import { describe, expect, it } from 'vitest'

import type { Attribute } from '../../schemas/attribute'
import type { Entity } from '../../schemas/entity'
import type { Model } from '../../schemas/model'
import { getEffectiveAttributes } from '../index'

let _seq = 100
const newId = (): string => `00000000-0000-4000-8000-${String(++_seq).padStart(12, '0')}`

const attr = (name: string, type = 'string'): Attribute => ({
  id: newId(),
  name,
  type,
  required: false,
  multiValue: false,
  primaryKey: false,
  unique: false,
})

const entity = (input: {
  id?: string
  name: string
  kind?: Entity['kind']
  attributes?: Attribute[]
  extendsId?: string
  implements?: string[]
}): Entity => ({
  id: input.id ?? newId(),
  name: input.name,
  attributes: input.attributes ?? [],
  kind: input.kind ?? 'default',
  extends: input.extendsId,
  implements: input.implements,
})

const iface = (input: { id?: string; name: string; attributes?: Attribute[] }): Entity =>
  entity({ ...input, kind: 'interface' })

const modelOf = (input: { entities?: Entity[] }): Model => ({
  id: newId(),
  name: 'M',
  version: '1.0.0',
  packages: [
    {
      id: newId(),
      name: 'p',
      packages: [],
      enums: [],
      entities: input.entities ?? [],
    },
  ],
})

describe('getEffectiveAttributes (own ⊕ implements ⊕ extends)', () => {
  it('entity with no extends, no implements: returns own attributes only', () => {
    const e = entity({ name: 'User', attributes: [attr('email'), attr('age', 'number')] })
    const m = modelOf({ entities: [e] })
    const names = getEffectiveAttributes(e, m).map((a) => a.name)
    expect(names).toEqual(['email', 'age'])
  })

  it('entity with extends only: returns parent attributes then own', () => {
    const parent = entity({
      name: 'Base',
      kind: 'abstract',
      attributes: [attr('createdAt', 'date')],
    })
    const child = entity({
      name: 'User',
      attributes: [attr('email')],
      extendsId: parent.id,
    })
    const m = modelOf({ entities: [parent, child] })
    expect(getEffectiveAttributes(child, m).map((a) => a.name)).toEqual(['createdAt', 'email'])
  })

  it('entity with implements only: returns interface attributes then own', () => {
    const audit = iface({ name: 'Auditable', attributes: [attr('createdAt', 'date')] })
    const e = entity({
      name: 'User',
      attributes: [attr('email')],
      implements: [audit.id],
    })
    const m = modelOf({ entities: [audit, e] })
    expect(getEffectiveAttributes(e, m).map((a) => a.name)).toEqual(['createdAt', 'email'])
  })

  it('entity with extends and implements: returns extends ⊕ interfaces ⊕ own in that order', () => {
    const audit = iface({ name: 'Auditable', attributes: [attr('createdAt', 'date')] })
    const parent = entity({ name: 'Base', kind: 'abstract', attributes: [attr('uuid', 'uuid')] })
    const e = entity({
      name: 'User',
      attributes: [attr('email')],
      extendsId: parent.id,
      implements: [audit.id],
    })
    const m = modelOf({ entities: [audit, parent, e] })
    expect(getEffectiveAttributes(e, m).map((a) => a.name)).toEqual(['uuid', 'createdAt', 'email'])
  })

  it('name conflict — own attribute wins over interface attribute', () => {
    const i = iface({ name: 'I', attributes: [attr('email', 'string')] })
    const ownEmail = attr('email', 'uuid')
    const e = entity({ name: 'User', attributes: [ownEmail], implements: [i.id] })
    const m = modelOf({ entities: [i, e] })
    const result = getEffectiveAttributes(e, m)
    const email = result.find((a) => a.name === 'email')!
    expect(email.type).toBe('uuid')
    expect(email.id).toBe(ownEmail.id)
  })

  it('name conflict — later interface wins over earlier interface', () => {
    const earlier = iface({ name: 'A', attributes: [attr('createdAt', 'date')] })
    const earlierAttr = earlier.attributes[0]
    const later = iface({ name: 'B', attributes: [attr('createdAt', 'uuid')] })
    const laterAttr = later.attributes[0]
    const e = entity({ name: 'User', implements: [earlier.id, later.id] })
    const m = modelOf({ entities: [earlier, later, e] })
    const result = getEffectiveAttributes(e, m)
    expect(result.map((a) => a.name)).toEqual(['createdAt'])
    expect(result[0].type).toBe('uuid')
    expect(result[0].id).toBe(laterAttr.id)
    expect(result[0].id).not.toBe(earlierAttr.id)
  })

  it('name conflict — interface wins over extends-inherited', () => {
    const i = iface({ name: 'B', attributes: [attr('createdAt', 'uuid')] })
    const parent = entity({
      name: 'Base',
      kind: 'abstract',
      attributes: [attr('createdAt', 'date')],
    })
    const e = entity({
      name: 'User',
      attributes: [],
      extendsId: parent.id,
      implements: [i.id],
    })
    const m = modelOf({ entities: [i, parent, e] })
    const result = getEffectiveAttributes(e, m)
    expect(result.map((a) => a.name)).toEqual(['createdAt'])
    expect(result[0].type).toBe('uuid') // interface wins over extends
  })

  it('transitive extends chain merges all ancestor attributes in chain order', () => {
    const grandparent = entity({
      name: 'GP',
      kind: 'abstract',
      attributes: [attr('id', 'uuid')],
    })
    const parent = entity({
      name: 'P',
      kind: 'abstract',
      attributes: [attr('createdAt', 'date')],
      extendsId: grandparent.id,
    })
    const child = entity({
      name: 'C',
      attributes: [attr('email')],
      extendsId: parent.id,
    })
    const m = modelOf({ entities: [grandparent, parent, child] })
    expect(getEffectiveAttributes(child, m).map((a) => a.name)).toEqual([
      'id',
      'createdAt',
      'email',
    ])
  })

  it('unresolved interface UUID is silently skipped (cross-model deferred to graph layer)', () => {
    const stranger = '00000000-0000-4000-8000-ffffffffffff'
    const e = entity({
      name: 'User',
      attributes: [attr('email')],
      implements: [stranger],
    })
    const m = modelOf({ entities: [e] })
    expect(getEffectiveAttributes(e, m).map((a) => a.name)).toEqual(['email'])
  })
})
