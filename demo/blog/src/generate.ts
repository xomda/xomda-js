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
export const demoRoot = join(__dirname, '..')
export const monoRoot = join(__dirname, '../../..')
export const outputRoot = join(demoRoot, 'output')

export function buildModel() {
  return createModel({
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
              createAttribute({
                name: 'id',
                type: 'uuid',
                required: true,
                primaryKey: true,
                unique: true,
              }),
              createAttribute({ name: 'name', type: 'string', required: true }),
              createAttribute({ name: 'email', type: 'string', required: true, unique: true }),
            ],
          }),
          createEntity({
            name: 'Post',
            attributes: [
              createAttribute({
                name: 'id',
                type: 'uuid',
                required: true,
                primaryKey: true,
                unique: true,
              }),
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
              createAttribute({
                name: 'id',
                type: 'uuid',
                required: true,
                primaryKey: true,
                unique: true,
              }),
              createAttribute({ name: 'body', type: 'string', required: true }),
              createAttribute({ name: 'post', type: 'Post', required: true }),
              createAttribute({ name: 'author', type: 'Author', required: true }),
            ],
          }),
        ],
      }),
    ],
  })
}

export interface GenerateOptions {
  /** When true, persists model.json to .xomda/ and writes output files. Defaults to true. */
  write?: boolean
  /** Override the templates source root. Defaults to the monorepo root. */
  templatesRoot?: string
}

export async function generate(options: GenerateOptions = {}) {
  const { write = true, templatesRoot = monoRoot } = options
  const model = buildModel()

  if (write) {
    await writeModel(model, demoRoot)
  }

  const templates = await listTemplates(templatesRoot)
  const results = (await Promise.all(templates.map((t) => renderTemplateByScope(t, model)))).flat()

  if (write) {
    await writeRenderResults(results, { root: outputRoot })
  }

  return { model, templates, results }
}
