// Runs once before any vitest project starts. Ensures `output/` is populated
// so the `@generated` alias resolves and the dom-environment specs can mount
// the Vue form against the real generated `AuthorSchema`.
//
// Uses only the public `xomda` surface — same path the demo's npm scripts /
// Vite plugin take.

import { fileURLToPath } from 'node:url'

import { generate } from 'xomda'

const demoRoot = fileURLToPath(new URL('..', import.meta.url))

export default async function setup() {
  await generate(demoRoot, { outputDir: 'output' })
}
