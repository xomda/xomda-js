import { join } from 'node:path'

import { demoRoot, generate, outputRoot } from './generate'

const { model, templates, results } = await generate()

console.log(`Model "${model.name}" written to ${join(demoRoot, '.xomda', 'model.json')}`)
console.log(`\nLoaded ${templates.length} template(s) from the root project:`)
for (const t of templates) {
  console.log(`  • ${t.name} (scope: ${t.scope ?? 'Model'})`)
}

console.log(`\nGenerated ${results.length} file(s) in ${outputRoot}:`)
for (const r of results) {
  console.log(`  • ${r.outputPath}`)
}
