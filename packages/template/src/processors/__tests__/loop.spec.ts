import type { Model } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { collectLoopItems } from '../loop'

const model: Model = {
  uuid: '00000000-0000-0000-0000-000000000000',
  name: 'Test',
  version: '1.0.0',
  packages: [
    {
      id: 'pkg-1',
      name: 'app',
      packages: [],
      entities: [
        { id: 'e1', name: 'User', attributes: [] },
        { id: 'e2', name: 'UserSession', attributes: [] },
        { id: 'e3', name: 'Order', attributes: [] },
      ],
      enums: [],
    },
  ],
} as unknown as Model

describe('collectLoopItems — filter', () => {
  it('passes everything through when no filter', async () => {
    const items = await collectLoopItems({ source: 'entities', content: '', model })
    expect(items).toHaveLength(3)
  })

  it('applies a simple predicate', async () => {
    const items = await collectLoopItems({
      source: 'entities',
      content: '',
      model,
      filter: "item.name.startsWith('User')",
    })
    expect(items.map((i) => (i as { name: string }).name)).toEqual(['User', 'UserSession'])
  })

  it('exposes index, model, and parent-scope variables to the predicate', async () => {
    const items = await collectLoopItems({
      source: 'entities',
      content: '',
      model,
      scopeVariables: { limit: 2 },
      filter: 'index < limit',
    })
    expect(items).toHaveLength(2)
  })

  it('treats an empty filter string as no filter', async () => {
    const items = await collectLoopItems({
      source: 'entities',
      content: '',
      model,
      filter: '   ',
    })
    expect(items).toHaveLength(3)
  })

  it('returns an empty array when nothing matches', async () => {
    const items = await collectLoopItems({
      source: 'entities',
      content: '',
      model,
      filter: 'false',
    })
    expect(items).toEqual([])
  })
})
