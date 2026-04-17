import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'
import type { RenderResult } from 'xomda'
import { preview } from 'xomda'

// Drives generation through the public `xomda` surface — same path a user
// would take in their own project. `preview` is in-memory: it reads the
// committed `.xomda/model.json` and renders against `.xomda/templates/`,
// returning the would-be-emitted files without touching the working tree.
const demoRoot = fileURLToPath(new URL('../..', import.meta.url))

describe('demo/gradle-plain generation', () => {
  let results: RenderResult[]

  beforeAll(async () => {
    results = await preview(demoRoot)
  })

  it('renders a Java record per entity', () => {
    const user = results.find((r) => r.outputPath.endsWith('User.java'))
    expect(user, 'expected a render result for User.java').toBeDefined()
    expect(user!.content).toMatch(/public record User\(/)
    expect(user!.content).toMatch(/UUID id/)
    expect(user!.content).toMatch(/String name/)
    expect(user!.content).toMatch(/String email/)
  })

  it('emits UUID (not the embedded record) for reference attributes', () => {
    const order = results.find((r) => r.outputPath.endsWith('Order.java'))
    expect(order, 'expected a render result for Order.java').toBeDefined()
    expect(order!.content).toMatch(/UUID user/)
    expect(order!.content).not.toMatch(/User user/)
  })
})
