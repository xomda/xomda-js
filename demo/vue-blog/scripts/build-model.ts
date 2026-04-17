// Blog domain (Author + Post + Comment + PostStatus) for the Vue 3 SPA demo.
// The Vite plugin (`XomdaPlugin.vite`) picks up the resulting `.xomda/model.json`
// at build / dev time and regenerates the Zod schemas, TS interfaces, and
// Java POJOs into `output/`.

import { fileURLToPath } from 'node:url'

import {
  createAttribute,
  createEntity,
  createEnum,
  createEnumValue,
  createModel,
  createPackage,
  writeModel,
} from 'xomda'

const demoRoot = fileURLToPath(new URL('..', import.meta.url))

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
            createAttribute({
              name: 'author',
              type: 'Author',
              required: true,
              aggregation: 'none',
            }),
            createAttribute({ name: 'tags', type: 'string', multiValue: true }),
            createAttribute({
              name: 'comments',
              type: 'Comment',
              multiValue: true,
              aggregation: 'composite',
            }),
            createAttribute({
              name: 'relatedPosts',
              type: 'Post',
              multiValue: true,
              aggregation: 'none',
            }),
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
            createAttribute({ name: 'post', type: 'Post', required: true, aggregation: 'none' }),
            createAttribute({
              name: 'author',
              type: 'Author',
              required: true,
              aggregation: 'none',
            }),
          ],
        }),
      ],
    }),
  ],
})

await writeModel(model, demoRoot)
