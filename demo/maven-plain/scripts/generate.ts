import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generate } from '@xomda/cli'
import { createAttribute, createEntity, createModel, createPackage } from '@xomda/core'
import { writeModel } from '@xomda/model/storage'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const demoRoot = join(__dirname, '..')

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
const results = await generate(demoRoot)
console.log(
  `Generated ${results.length} file(s) for model "${model.name}" under ${demoRoot}/src/main/generated/`
)
