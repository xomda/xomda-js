import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ModelSchema } from '../model'

/**
 * The `.xomda/model.json` at the repo root is xomda's *self-bootstrap*: the
 * meta-model that, fed back into the engine + its own templates, regenerates
 * `@xomda/core`. Any schema edit that fails to round-trip this file is a
 * silent drift (AGENTS.md rule 19) — we pin the contract with a spec rather
 * than rely on memory.
 */
describe('self-bootstrap: .xomda/model.json', () => {
  // 4 levels up from packages/core/src/schemas/__tests__/ → repo root.
  const repoRoot = join(__dirname, '..', '..', '..', '..', '..')
  const modelPath = join(repoRoot, '.xomda', 'model.json')
  const raw = readFileSync(modelPath, 'utf-8')
  const parsed = ModelSchema.parse(JSON.parse(raw))

  it('parses without errors', () => {
    expect(parsed.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(parsed.name).toBe('Main Model')
    expect(parsed.packages.length).toBeGreaterThan(0)
  })

  it('exposes a `Project` entity reflecting the runtime ProjectFile shape', () => {
    // Phase 9: the project-owns-many-models relationship must be visible in
    // the meta-model so AI agents and downstream template authors can see it.
    const xomda = parsed.packages.find((p) => p.name === 'xomda')
    expect(xomda).toBeDefined()
    const project = xomda!.entities.find((e) => e.name === 'Project')
    expect(project, 'expected a Project entity in the xomda package').toBeDefined()
    // Required scalar surface.
    const names = project!.attributes.map((a) => a.name).sort()
    expect(names).toContain('name')
    expect(names).toContain('description')
    expect(names).toContain('isRoot')
    expect(names).toContain('models')
    // `models` is the multi-valued ownership relationship.
    const models = project!.attributes.find((a) => a.name === 'models')!
    expect(models.type).toBe('Model')
    expect(models.multiValue).toBe(true)
  })

  it('keeps the `Model` entity intact (regression pin)', () => {
    const xomda = parsed.packages.find((p) => p.name === 'xomda')!
    const model = xomda.entities.find((e) => e.name === 'Model')
    expect(model, 'Model entity must remain after adding Project').toBeDefined()
    const attrs = model!.attributes.map((a) => a.name)
    for (const required of ['id', 'name', 'version', 'packages']) {
      expect(attrs).toContain(required)
    }
  })

  // C5 of the brainstorm-reconciliation plan: the meta-model must declare
  // the new `kind` enum and the Entity attributes that mirror the C1-C4
  // schema changes in `@xomda/core`. If these drift, AI agents and template
  // authors see a different shape than the runtime enforces.
  describe('C5 — kind + implements in the meta-model', () => {
    const modelPkg = () =>
      parsed.packages.find((p) => p.name === 'xomda')!.packages.find((p) => p.name === 'model')!

    it('declares the `Entity Kind` enum with three values', () => {
      const entityKind = modelPkg().enums.find((e) => e.name === 'Entity Kind')
      expect(entityKind, 'Entity Kind enum must exist in xomda.model').toBeDefined()
      const values = entityKind!.values.map((v) => v.name).sort()
      expect(values).toEqual(['abstract', 'default', 'interface'])
    })

    it('Entity meta-entity has a `kind` attribute typed Entity Kind (required, defaultValue "default")', () => {
      const entity = modelPkg().entities.find((e) => e.name === 'Entity')!
      const kindAttr = entity.attributes.find((a) => a.name === 'kind')
      expect(kindAttr, 'Entity.kind attribute must exist').toBeDefined()
      expect(kindAttr!.type).toBe('Entity Kind')
      expect(kindAttr!.required).toBe(true)
      expect(kindAttr!.defaultValue).toBe('default')
    })

    it('Entity meta-entity has an `implements` attribute (multi-valued reference to Entity)', () => {
      const entity = modelPkg().entities.find((e) => e.name === 'Entity')!
      const impl = entity.attributes.find((a) => a.name === 'implements')
      expect(impl, 'Entity.implements attribute must exist').toBeDefined()
      expect(impl!.type).toBe('Entity')
      expect(impl!.multiValue).toBe(true)
      expect(impl!.aggregation).toBe('none')
      expect(impl!.required).toBe(false)
    })

    it('Entity meta-entity no longer declares the legacy `abstract` attribute', () => {
      const entity = modelPkg().entities.find((e) => e.name === 'Entity')!
      const abstractAttr = entity.attributes.find((a) => a.name === 'abstract')
      expect(abstractAttr, 'legacy abstract attribute should be removed').toBeUndefined()
    })
  })

  // D4 of the brainstorm-reconciliation plan: the meta-model must declare
  // the Visibility enum and the `visibility` attribute on Entity + Package.
  describe('D4 — Visibility in the meta-model', () => {
    const modelPkg = () =>
      parsed.packages.find((p) => p.name === 'xomda')!.packages.find((p) => p.name === 'model')!

    it('declares the `Visibility` enum with three values', () => {
      const visibility = modelPkg().enums.find((e) => e.name === 'Visibility')
      expect(visibility, 'Visibility enum must exist in xomda.model').toBeDefined()
      const values = visibility!.values.map((v) => v.name).sort()
      expect(values).toEqual(['model-private', 'package-private', 'public'])
    })

    it('Entity meta-entity has a `visibility` attribute typed Visibility', () => {
      const entity = modelPkg().entities.find((e) => e.name === 'Entity')!
      const attr = entity.attributes.find((a) => a.name === 'visibility')
      expect(attr, 'Entity.visibility attribute must exist').toBeDefined()
      expect(attr!.type).toBe('Visibility')
      expect(attr!.required).toBe(false)
    })

    it('Package meta-entity has a `visibility` attribute typed Visibility', () => {
      const pkg = modelPkg().entities.find((e) => e.name === 'Package')!
      const attr = pkg.attributes.find((a) => a.name === 'visibility')
      expect(attr, 'Package.visibility attribute must exist').toBeDefined()
      expect(attr!.type).toBe('Visibility')
      expect(attr!.required).toBe(false)
    })
  })

  // E5 of the brainstorm-reconciliation plan: the meta-model's Attribute
  // Type enum extends to the four meta-types, and Attribute itself gains
  // five per-type extension attributes (targetEntity, targetEnum, length,
  // precision, scale).
  describe('E5 — Attribute Type meta-types and extension fields in the meta-model', () => {
    const modelPkg = () =>
      parsed.packages.find((p) => p.name === 'xomda')!.packages.find((p) => p.name === 'model')!

    it('Attribute Type enum lists primitives and the four meta-types', () => {
      const attributeType = modelPkg().enums.find((e) => e.name === 'Attribute Type')
      expect(attributeType, 'Attribute Type enum must exist').toBeDefined()
      const values = attributeType!.values.map((v) => v.name)
      // Primitives + meta-types, in the order declared in the meta-model.
      for (const expected of [
        'string',
        'number',
        'decimal',
        'boolean',
        'date',
        'uuid',
        'entity',
        'enum',
        'package',
        'attribute',
      ]) {
        expect(values).toContain(expected)
      }
    })

    it('Attribute meta-entity has the five per-type extension fields', () => {
      const attribute = modelPkg().entities.find((e) => e.name === 'Attribute')!
      const names = attribute.attributes.map((a) => a.name)
      for (const expected of ['targetEntity', 'targetEnum', 'length', 'precision', 'scale']) {
        expect(names, `Attribute meta-entity must declare ${expected}`).toContain(expected)
      }
    })

    it('targetEntity is a reference to Entity (multiValue: false)', () => {
      const attribute = modelPkg().entities.find((e) => e.name === 'Attribute')!
      const attr = attribute.attributes.find((a) => a.name === 'targetEntity')!
      expect(attr.type).toBe('Entity')
      expect(attr.aggregation).toBe('none')
      expect(attr.multiValue).toBe(false)
      expect(attr.required).toBe(false)
    })

    it('aggregation meta-attribute defaults to "none" (idiomatic MDA association)', () => {
      // Pins the contract documented on `AttributeSchema.aggregation`:
      // new attributes created via the meta-driven form pick up the
      // association default rather than leaving the field unset and
      // silently falling back to composite/embedded semantics.
      const attribute = modelPkg().entities.find((e) => e.name === 'Attribute')!
      const attr = attribute.attributes.find((a) => a.name === 'aggregation')!
      expect(attr.type).toBe('Aggregation Kind')
      expect(attr.defaultValue).toBe('none')
    })

    it('targetEnum is a reference to Enum (multiValue: false)', () => {
      const attribute = modelPkg().entities.find((e) => e.name === 'Attribute')!
      const attr = attribute.attributes.find((a) => a.name === 'targetEnum')!
      expect(attr.type).toBe('Enum')
      expect(attr.aggregation).toBe('none')
      expect(attr.multiValue).toBe(false)
    })

    it('length, precision, scale are number-typed and optional', () => {
      const attribute = modelPkg().entities.find((e) => e.name === 'Attribute')!
      for (const name of ['length', 'precision', 'scale']) {
        const attr = attribute.attributes.find((a) => a.name === name)!
        expect(attr.type, `${name} should be a number`).toBe('number')
        expect(attr.required, `${name} should be optional`).toBe(false)
      }
    })
  })
})
