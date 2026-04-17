// Author + Post + Comment domain for the BlogService demo. The Maven build
// compiles whatever `xomda generate` emits under `src/main/generated{,-resources}/`.

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
            createAttribute({
              name: 'id',
              type: 'uuid',
              required: true,
              primaryKey: true,
              unique: true,
            }),
            createAttribute({ name: 'name', type: 'string', required: true }),
            createAttribute({ name: 'email', type: 'string', required: true, unique: true }),
            createAttribute({ name: 'bio', type: 'string' }),
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
            createAttribute({ name: 'publishedAt', type: 'date' }),
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
            createAttribute({ name: 'createdAt', type: 'date', required: true }),
          ],
        }),
      ],
    }),
  ],
})

await writeModel(model, demoRoot)
