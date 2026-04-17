import { describe, expect, it, vi } from 'vitest'

import { buildIndex } from '../providers/modelProvider'
import { scoreMatch } from '../providers/types'

vi.mock('../../../trpc', () => ({ trpc: {} }))

const sampleModel = {
  id: 'm1',
  name: 'M',
  version: '1',
  packages: [
    {
      id: 'pkg-root',
      name: 'root',
      packages: [
        {
          id: 'pkg-nested',
          name: 'nested',
          packages: [],
          enums: [],
          entities: [
            {
              id: 'ent-user',
              name: 'User',
              attributes: [
                { id: 'a1', name: 'email', type: 'string' },
                { id: 'a2', name: 'username', type: 'string' },
              ],
            },
          ],
        },
      ],
      enums: [
        {
          id: 'en-status',
          name: 'Status',
          values: [
            { id: 'v1', name: 'active' },
            { id: 'v2', name: 'archived' },
          ],
        },
      ],
      entities: [],
    },
  ],
} as any

describe('buildIndex', () => {
  it('walks packages, entities, enums, attributes and enum values', () => {
    const idx = buildIndex(sampleModel)
    const types = idx.map((e) => `${e.type}:${e.name}`)
    expect(types).toContain('package:root')
    expect(types).toContain('package:nested')
    expect(types).toContain('entity:User')
    expect(types).toContain('attribute:email')
    expect(types).toContain('attribute:username')
    expect(types).toContain('enum:Status')
    expect(types).toContain('enumValue:active')
    expect(types).toContain('enumValue:archived')
  })

  it('records dotted package path', () => {
    const idx = buildIndex(sampleModel)
    const user = idx.find((e) => e.type === 'entity' && e.name === 'User')!
    expect(user.path).toBe('root.nested')
  })

  it('records parentId/parentName for attributes and enum values', () => {
    const idx = buildIndex(sampleModel)
    const email = idx.find((e) => e.type === 'attribute' && e.name === 'email')!
    expect(email.parentId).toBe('ent-user')
    expect(email.parentName).toBe('User')
    const active = idx.find((e) => e.type === 'enumValue' && e.name === 'active')!
    expect(active.parentId).toBe('en-status')
  })
})

describe('scoreMatch', () => {
  it('ranks prefix match above mid-string match', () => {
    expect(scoreMatch('UserAccount', 'user')).toBeGreaterThan(scoreMatch('SuperUser', 'user'))
  })

  it('returns 0 when no match', () => {
    expect(scoreMatch('something', 'xyz')).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(scoreMatch('Email', 'EMAIL')).toBeGreaterThan(0)
  })

  it('ranks word-start match above arbitrary substring', () => {
    expect(scoreMatch('snake_case_name', 'case')).toBeGreaterThan(
      scoreMatch('staircase', 'case')
    )
  })
})
