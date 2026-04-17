import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createAttribute,
  createEntity,
  createEnum,
  createEnumValue,
  createModel,
  createPackage,
} from '@xomda/core'
import { writeModel } from '@xomda/model/storage'
import { listTemplates, renderTemplateByScope, writeRenderResults } from '@xomda/template'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const demoRoot = join(__dirname, '..')
const monoRoot = join(__dirname, '../../..')
const outputRoot = join(demoRoot, 'output')

// ─── 1. Define the Blog domain model ────────────────────────────────────────

const model = createModel({
  name: 'Blog',
  packages: [
    createPackage({
      name: 'blog',
      enums: [
        createEnum({
          name: 'PostStatus',
          values: [
            createEnumValue({ name: 'draft' }),
            createEnumValue({ name: 'published' }),
            createEnumValue({ name: 'archived' }),
          ],
        }),
      ],
      entities: [
        createEntity({
          name: 'Author',
          attributes: [
            createAttribute({ name: 'id', type: 'uuid', required: true, primaryKey: true, unique: true }),
            createAttribute({ name: 'name', type: 'string', required: true }),
            createAttribute({ name: 'email', type: 'string', required: true, unique: true }),
          ],
        }),
        createEntity({
          name: 'Post',
          attributes: [
            createAttribute({ name: 'id', type: 'uuid', required: true, primaryKey: true, unique: true }),
            createAttribute({ name: 'title', type: 'string', required: true }),
            createAttribute({ name: 'content', type: 'string', required: true }),
            createAttribute({ name: 'status', type: 'PostStatus', required: true }),
            createAttribute({ name: 'author', type: 'Author', required: true }),
            createAttribute({ name: 'tags', type: 'string', multiValue: true }),
          ],
        }),
        createEntity({
          name: 'Comment',
          attributes: [
            createAttribute({ name: 'id', type: 'uuid', required: true, primaryKey: true, unique: true }),
            createAttribute({ name: 'body', type: 'string', required: true }),
            createAttribute({ name: 'post', type: 'Post', required: true }),
            createAttribute({ name: 'author', type: 'Author', required: true }),
          ],
        }),
      ],
    }),
  ],
})

// ─── 2. Persist the model ────────────────────────────────────────────────────

await writeModel(model, demoRoot)
console.log(`Model "${model.name}" written to ${join(demoRoot, '.xomda', 'model.json')}`)

// ─── 3. Load templates from the monorepo root ────────────────────────────────

const templates = await listTemplates(monoRoot)
console.log(`\nLoaded ${templates.length} template(s) from the root project:`)
for (const t of templates) {
  console.log(`  • ${t.name} (scope: ${t.scope ?? 'Model'})`)
}

// ─── 4. Render all templates against the model ───────────────────────────────

const results = (await Promise.all(templates.map((t) => renderTemplateByScope(t, model)))).flat()

// ─── 5. Write generated files ────────────────────────────────────────────────

await writeRenderResults(results, outputRoot)

console.log(`\nGenerated ${results.length} file(s) in ${outputRoot}:`)
for (const r of results) {
  console.log(`  • ${r.outputPath}`)
}
