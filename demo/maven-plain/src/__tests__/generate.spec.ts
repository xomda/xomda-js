import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Model } from '@xomda/core'
import { createAttribute, createEntity, createModel, createPackage } from '@xomda/core'
import { listTemplates, renderTemplateByScope } from '@xomda/template'
import { describe, expect, it } from 'vitest'

// In-memory only: load the demo's templates, render against a synthesized model,
// assert on RenderResult.content. No FS writes. Means this test never mutates
// `demo/maven-plain/.xomda/model.json` or `src/main/generated/`, so it can run
// under any IDE/watcher without diffing the working tree.
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const demoRoot = join(__dirname, '..', '..')

async function renderAll(model: Model) {
  const templates = (await listTemplates(demoRoot)).filter((t) => !t.disabled)
  const groups = await Promise.all(templates.map((t) => renderTemplateByScope(t, model)))
  return groups.flat()
}

describe('demo/maven-plain generation', () => {
  it('renders a Java record per entity', async () => {
    const model = createModel({
      name: 'MavenPlain',
      packages: [
        createPackage({
          name: 'com.example.model',
          entities: [
            createEntity({
              name: 'User',
              attributes: [
                createAttribute({
                  name: 'id',
                  type: 'uuid',
                  required: true,
                  primaryKey: true,
                  unique: true,
                }),
                createAttribute({ name: 'name', type: 'string', required: true }),
              ],
            }),
          ],
        }),
      ],
    })

    const results = await renderAll(model)
    const user = results.find((r) => r.outputPath.endsWith('User.java'))
    expect(user, 'expected a render result for User.java').toBeDefined()
    expect(user!.content).toMatch(/public record User\(/)
    expect(user!.content).toMatch(/UUID id/)
    expect(user!.content).toMatch(/String name/)
  })

  it('emits UUID (not the embedded record) for reference attributes', async () => {
    const refModel = createModel({
      name: 'MavenPlain',
      packages: [
        createPackage({
          name: 'com.example.model',
          entities: [
            createEntity({
              name: 'Owner',
              attributes: [
                createAttribute({
                  name: 'id',
                  type: 'uuid',
                  required: true,
                  primaryKey: true,
                  unique: true,
                }),
              ],
            }),
            createEntity({
              name: 'Pet',
              attributes: [
                createAttribute({
                  name: 'id',
                  type: 'uuid',
                  required: true,
                  primaryKey: true,
                  unique: true,
                }),
                createAttribute({ name: 'owner', type: 'Owner', required: true, reference: true }),
              ],
            }),
          ],
        }),
      ],
    })

    const results = await renderAll(refModel)
    const pet = results.find((r) => r.outputPath.endsWith('Pet.java'))
    expect(pet, 'expected a render result for Pet.java').toBeDefined()
    expect(pet!.content).toMatch(/UUID owner/)
    expect(pet!.content).not.toMatch(/Owner owner/)
  })
})
