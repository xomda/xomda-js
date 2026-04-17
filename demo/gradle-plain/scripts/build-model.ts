// Same User+Order model as demo/maven-plain — proves xomda + the same record
// template build cleanly under a different build tool. Generation is driven
// separately by `xomda generate` (wired into the `generate` script).

import { fileURLToPath } from 'node:url'

import { createAttribute, createEntity, createModel, createPackage, writeModel } from 'xomda'

const demoRoot = fileURLToPath(new URL('..', import.meta.url))

const model = createModel({
  name: 'GradlePlain',
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
            createAttribute({ name: 'email', type: 'string', required: true, unique: true }),
          ],
        }),
        createEntity({
          name: 'Order',
          attributes: [
            createAttribute({
              name: 'id',
              type: 'uuid',
              required: true,
              primaryKey: true,
              unique: true,
            }),
            createAttribute({ name: 'user', type: 'User', required: true, reference: true }),
            createAttribute({ name: 'total', type: 'decimal', required: true }),
          ],
        }),
      ],
    }),
  ],
})

await writeModel(model, demoRoot)
