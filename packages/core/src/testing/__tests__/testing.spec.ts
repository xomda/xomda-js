import { describe, expect, it } from 'vitest'

import { AttributeSchema } from '../../schemas/attribute'
import { EntitySchema } from '../../schemas/entity'
import { EnumSchema } from '../../schemas/enum'
import { ModelSchema } from '../../schemas/model'
import { PackageSchema } from '../../schemas/package'
import { createAttribute, createEntity, createEnum, createModel, createPackage } from '../index'

describe('createAttribute', () => {
  it('produces a Zod-valid Attribute', () => {
    expect(() => AttributeSchema.parse(createAttribute())).not.toThrow()
  })
  it('applies overrides', () => {
    const a = createAttribute({ name: 'title', type: 'string', required: true })
    expect(a.name).toBe('title')
    expect(a.required).toBe(true)
  })
})

describe('createEntity', () => {
  it('produces a Zod-valid Entity', () => {
    expect(() => EntitySchema.parse(createEntity())).not.toThrow()
  })
  it('accepts nested attributes', () => {
    const e = createEntity({ attributes: [createAttribute({ name: 'id', primaryKey: true })] })
    expect(EntitySchema.parse(e).attributes[0].name).toBe('id')
  })
})

describe('createEnum', () => {
  it('produces a Zod-valid Enum', () => {
    expect(() => EnumSchema.parse(createEnum())).not.toThrow()
  })
})

describe('createPackage', () => {
  it('produces a Zod-valid Package', () => {
    expect(() => PackageSchema.parse(createPackage())).not.toThrow()
  })
  it('supports nested packages', () => {
    const child = createPackage({ name: 'child' })
    const parent = createPackage({ name: 'parent', packages: [child] })
    expect(PackageSchema.parse(parent).packages[0].name).toBe('child')
  })
})

describe('createModel', () => {
  it('produces a Zod-valid Model', () => {
    expect(() => ModelSchema.parse(createModel())).not.toThrow()
  })
  it('applies name override', () => {
    expect(createModel({ name: 'MyApp' }).name).toBe('MyApp')
  })
})
