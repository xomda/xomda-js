// Builds the demo's domain model in TypeScript and persists it to
// `.xomda/model.json`. Generation is a separate step: run `xomda generate`
// (wired into the `generate` script) to render templates against this file.
//
// Demos must only import from the public `xomda` package — never from internal
// @xomda/* workspace packages.

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAttribute, createEntity, createModel, createPackage, writeModel } from 'xomda'

const demoRoot = fileURLToPath(new URL('..', import.meta.url))

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
console.log(`Wrote model.json to ${join(demoRoot, '.xomda', 'model.json')}`)
