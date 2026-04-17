import { join } from 'node:path'

import { demoRoot, generate, outputRoot } from './generate'

const { model } = await generate()

console.log(`Model "${model.name}" written to ${join(demoRoot, '.xomda', 'model.json')}`)
console.log(`Generated files written under ${outputRoot}`)
