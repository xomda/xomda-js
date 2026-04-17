import { describe, expect, it } from 'vitest'

import type { Attribute } from '../../schemas/attribute'
import type { Entity } from '../../schemas/entity'
import type { Model } from '../../schemas/model'
import { getEffectiveAttributes, getEntityAncestors, getInheritedAttributes } from '../index'

const attr = (name: string, overrides: Partial<Attribute> = {}): Attribute => ({
  id: `attr-${name}`,
  name,
  type: 'string',
  required: false,
  multiValue: false,
  primaryKey: false,
  unique: false,
  ...overrides,
})

const entity = (id: string, name: string, overrides: Partial<Entity> = {}): Entity => ({
  id,
  name,
  attributes: [],
  ...overrides,
})

const model = (entities: Entity[]): Model => ({
  id: '00000000-0000-0000-0000-000000000000',
  name: 'M',
  version: '1.0.0',
  packages: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'p',
      packages: [],
      enums: [],
      entities,
    },
  ],
})

describe('getEntityAncestors', () => {
  it('returns [] for an entity with no extends', () => {
    const a = entity('a', 'A')
    expect(getEntityAncestors(a, model([a]))).toEqual([])
  })

  it('walks the chain immediate-parent-first', () => {
    const grand = entity('grand', 'Grand')
    const parent = entity('parent', 'Parent', { extends: 'grand' })
    const child = entity('child', 'Child', { extends: 'parent' })
    const m = model([grand, parent, child])
    const ancestors = getEntityAncestors(child, m)
    expect(ancestors.map((e) => e.name)).toEqual(['Parent', 'Grand'])
  })

  it('stops at a cycle without throwing', () => {
    const a = entity('a', 'A', { extends: 'b' })
    const b = entity('b', 'B', { extends: 'a' })
    const m = model([a, b])
    // From a, ancestors: b (extends a → cycle, stop)
    const ancestors = getEntityAncestors(a, m)
    expect(ancestors.map((e) => e.name)).toEqual(['B'])
  })

  it('silently ignores dangling extends references', () => {
    const a = entity('a', 'A', { extends: 'does-not-exist' })
    expect(getEntityAncestors(a, model([a]))).toEqual([])
  })
})

describe('getEffectiveAttributes', () => {
  it('returns own attributes when there are no ancestors', () => {
    const a = entity('a', 'A', { attributes: [attr('x')] })
    const result = getEffectiveAttributes(a, model([a]))
    expect(result.map((r) => r.name)).toEqual(['x'])
  })

  it('returns ancestor attributes followed by own', () => {
    const parent = entity('parent', 'Parent', { attributes: [attr('p1')] })
    const child = entity('child', 'Child', {
      extends: 'parent',
      attributes: [attr('c1')],
    })
    const result = getEffectiveAttributes(child, model([parent, child]))
    expect(result.map((r) => r.name)).toEqual(['p1', 'c1'])
  })

  it('drops inherited attribute when own attribute has the same name', () => {
    const parent = entity('parent', 'Parent', {
      attributes: [attr('shared', { description: 'parent version' })],
    })
    const child = entity('child', 'Child', {
      extends: 'parent',
      attributes: [attr('shared', { description: 'child version' })],
    })
    const result = getEffectiveAttributes(child, model([parent, child]))
    expect(result.map((r) => r.name)).toEqual(['shared'])
    expect(result[0].description).toBe('child version')
  })

  it('closer ancestor wins over farther one when names collide', () => {
    const grand = entity('grand', 'Grand', {
      attributes: [attr('shared', { description: 'grand' })],
    })
    const parent = entity('parent', 'Parent', {
      extends: 'grand',
      attributes: [attr('shared', { description: 'parent' })],
    })
    const child = entity('child', 'Child', { extends: 'parent' })
    const result = getEffectiveAttributes(child, model([grand, parent, child]))
    expect(result.map((r) => r.name)).toEqual(['shared'])
    expect(result[0].description).toBe('parent')
  })
})

describe('getInheritedAttributes', () => {
  it('returns just the inherited subset', () => {
    const parent = entity('parent', 'Parent', { attributes: [attr('p1')] })
    const child = entity('child', 'Child', {
      extends: 'parent',
      attributes: [attr('c1')],
    })
    const result = getInheritedAttributes(child, model([parent, child]))
    expect(result.map((r) => r.name)).toEqual(['p1'])
  })
})
