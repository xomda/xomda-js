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
import { XomdaPlugin } from '@xomda/unplugin'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
export const demoRoot = join(__dirname, '..')
export const outputRoot = join(demoRoot, 'output')

export function buildModel() {
  return createModel({
    name: 'BlogService',
    packages: [
      createPackage({
        name: 'blog',
        enums: [
          createEnum({
            name: 'PostStatus',
            values: [
              createEnumValue({ name: 'DRAFT' }),
              createEnumValue({ name: 'PUBLISHED' }),
              createEnumValue({ name: 'ARCHIVED' }),
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
              createAttribute({ name: 'bio', type: 'string' }),
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
              createAttribute({ name: 'publishedAt', type: 'date' }),
            ],
          }),
          createEntity({
            name: 'Comment',
            attributes: [
              createAttribute({ name: 'id', type: 'uuid', required: true, primaryKey: true, unique: true }),
              createAttribute({ name: 'body', type: 'string', required: true }),
              createAttribute({ name: 'post', type: 'Post', required: true }),
              createAttribute({ name: 'author', type: 'Author', required: true }),
              createAttribute({ name: 'createdAt', type: 'date', required: true }),
            ],
          }),
        ],
      }),
    ],
  })
}

export interface GenerateOptions {
  write?: boolean
}

export async function generate(options: GenerateOptions = {}) {
  const { write = true } = options
  const model = buildModel()

  if (!write) return { model }

  await writeModel(model, demoRoot)

  // Drive generation through the @xomda/unplugin Vite plugin.
  const { build } = await import('vite')
  await build({
    configFile: false,
    root: demoRoot,
    logLevel: 'warn',
    plugins: [XomdaPlugin.vite({ root: demoRoot, output: 'output' })],
    build: {
      outDir: 'node_modules/.vite-noop',
      emptyOutDir: true,
      write: false,
      lib: {
        entry: join(demoRoot, 'src', 'index.ts'),
        formats: ['es'],
        fileName: 'noop',
      },
      rollupOptions: {
        external: () => true,
      },
    },
  })

  return { model }
}
