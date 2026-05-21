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
})
