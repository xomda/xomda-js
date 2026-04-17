// TodoList + Todo domain for the Quarkus demo. The Maven build compiles
// whatever `xomda generate` emits under `src/main/generated{,-resources}/`,
// then runs `@QuarkusTest` against it.

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
  name: 'TodoService',
  packages: [
    createPackage({
      name: 'todos',
      enums: [
        createEnum({
          name: 'Priority',
          values: [
            createEnumValue({ name: 'LOW' }),
            createEnumValue({ name: 'MEDIUM' }),
            createEnumValue({ name: 'HIGH' }),
          ],
        }),
      ],
      entities: [
        createEntity({
          name: 'TodoList',
          attributes: [
            createAttribute({
              name: 'id',
              type: 'uuid',
              required: true,
              primaryKey: true,
              unique: true,
            }),
            createAttribute({ name: 'name', type: 'string', required: true }),
            createAttribute({ name: 'createdAt', type: 'date', required: true }),
          ],
        }),
        createEntity({
          name: 'Todo',
          attributes: [
            createAttribute({
              name: 'id',
              type: 'uuid',
              required: true,
              primaryKey: true,
              unique: true,
            }),
            createAttribute({ name: 'title', type: 'string', required: true }),
            createAttribute({ name: 'done', type: 'boolean', required: true }),
            createAttribute({ name: 'priority', type: 'Priority', required: true }),
            createAttribute({ name: 'list', type: 'TodoList', required: true }),
            createAttribute({ name: 'createdAt', type: 'date', required: true }),
          ],
        }),
      ],
    }),
  ],
})

await writeModel(model, demoRoot)
