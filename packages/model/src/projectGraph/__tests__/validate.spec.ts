import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadProjectGraph } from '../loader'
import { validateModelAgainstGraph } from '../validate'

let workspace = ''

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'xomda-pg-validate-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

let _seq = 1000
const newPkgId = (): string => `99999999-9999-4999-8999-${String(++_seq).padStart(12, '0')}`

interface ProjectFixture {
  name: string
  parentProject?: string
  restrictReadsToProjectRoot?: boolean
  model: object
}

function writeProject(absPath: string, fix: ProjectFixture): void {
  mkdirSync(join(absPath, '.xomda'), { recursive: true })
  const project = {
    name: fix.name,
    ...(fix.parentProject !== undefined ? { parentProject: fix.parentProject } : {}),
    settings: {
      restrictReadsToProjectRoot: fix.restrictReadsToProjectRoot ?? true,
    },
  }
  writeFileSync(join(absPath, '.xomda', 'project.json'), JSON.stringify(project, null, 2))
  writeFileSync(join(absPath, '.xomda', 'model.json'), JSON.stringify(fix.model, null, 2))
}

describe('F5–F7 — validateModelAgainstGraph (cross-model checks)', () => {
  it('cross-model: default extends abstract in parent project (public): no violations', async () => {
    const parentAbs = join(workspace, 'parent')
    const childAbs = join(workspace, 'child')
    const baseId = '00000000-0000-4000-8000-aaaa00000001'
    const userId = '00000000-0000-4000-8000-bbbb00000001'
    const parentModelId = '00000000-0000-4000-8000-aaaa00000010'
    const childModelId = '00000000-0000-4000-8000-bbbb00000010'
    writeProject(parentAbs, {
      name: 'Parent',
      model: {
        id: parentModelId,
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              {
                id: baseId,
                name: 'Base',
                attributes: [],
                kind: 'abstract',
                visibility: 'public',
              },
            ],
          },
        ],
      },
    })
    const childModel = {
      id: childModelId,
      name: 'M',
      version: '1.0.0',
      packages: [
        {
          id: newPkgId(),
          name: 'p',
          packages: [],
          enums: [],
          entities: [
            {
              id: userId,
              name: 'User',
              attributes: [],
              kind: 'default',
              extends: baseId,
            },
          ],
        },
      ],
    }
    writeProject(childAbs, {
      name: 'Child',
      parentProject: '../parent',
      restrictReadsToProjectRoot: false,
      model: childModel,
    })

    const graph = await loadProjectGraph(childAbs)
    const { violations } = validateModelAgainstGraph(graph.root.models[0], graph)
    expect(violations).toEqual([])
  })

  it('cross-model: target hidden by model-private visibility yields extends-target-not-visible', async () => {
    const parentAbs = join(workspace, 'parent')
    const childAbs = join(workspace, 'child')
    const baseId = '00000000-0000-4000-8000-aaaa00000020'
    const userId = '00000000-0000-4000-8000-bbbb00000020'
    const parentModelId = '00000000-0000-4000-8000-aaaa00000030'
    const childModelId = '00000000-0000-4000-8000-bbbb00000030'
    writeProject(parentAbs, {
      name: 'Parent',
      model: {
        id: parentModelId,
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              {
                id: baseId,
                name: 'Hidden',
                attributes: [],
                kind: 'abstract',
                visibility: 'model-private',
              },
            ],
          },
        ],
      },
    })
    writeProject(childAbs, {
      name: 'Child',
      parentProject: '../parent',
      restrictReadsToProjectRoot: false,
      model: {
        id: childModelId,
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              {
                id: userId,
                name: 'User',
                attributes: [],
                kind: 'default',
                extends: baseId,
              },
            ],
          },
        ],
      },
    })
    const graph = await loadProjectGraph(childAbs)
    const { violations } = validateModelAgainstGraph(graph.root.models[0], graph)
    expect(violations.length).toBe(1)
    expect(violations[0].kind).toBe('extends-target-not-visible')
  })

  it('cross-model: target id absent from graph yields extends-target-not-found', async () => {
    const childAbs = join(workspace, 'child')
    const userId = '00000000-0000-4000-8000-bbbb00000040'
    const childModelId = '00000000-0000-4000-8000-bbbb00000041'
    const ghostId = '00000000-0000-4000-8000-cccccccccccc'
    writeProject(childAbs, {
      name: 'Child',
      model: {
        id: childModelId,
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              {
                id: userId,
                name: 'User',
                attributes: [],
                kind: 'default',
                extends: ghostId,
              },
            ],
          },
        ],
      },
    })
    const graph = await loadProjectGraph(childAbs)
    const { violations } = validateModelAgainstGraph(graph.root.models[0], graph)
    expect(violations.length).toBe(1)
    expect(violations[0].kind).toBe('extends-target-not-found')
  })

  it('cross-model: implements points at a non-interface across projects', async () => {
    const parentAbs = join(workspace, 'parent')
    const childAbs = join(workspace, 'child')
    const decoyId = '00000000-0000-4000-8000-aaaa00000050'
    const userId = '00000000-0000-4000-8000-bbbb00000050'
    writeProject(parentAbs, {
      name: 'Parent',
      model: {
        id: '00000000-0000-4000-8000-aaaa00000051',
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              {
                id: decoyId,
                name: 'Decoy',
                attributes: [],
                kind: 'default',
                visibility: 'public',
              },
            ],
          },
        ],
      },
    })
    writeProject(childAbs, {
      name: 'Child',
      parentProject: '../parent',
      restrictReadsToProjectRoot: false,
      model: {
        id: '00000000-0000-4000-8000-bbbb00000051',
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              {
                id: userId,
                name: 'User',
                attributes: [],
                kind: 'default',
                implements: [decoyId],
              },
            ],
          },
        ],
      },
    })
    const graph = await loadProjectGraph(childAbs)
    const { violations } = validateModelAgainstGraph(graph.root.models[0], graph)
    expect(violations.length).toBe(1)
    expect(violations[0].kind).toBe('implements-target-wrong-kind')
  })

  it('same-model targets are skipped — already covered by ModelSchema.superRefine', async () => {
    const root = join(workspace, 'p')
    const baseId = '00000000-0000-4000-8000-aaaa00000070'
    const userId = '00000000-0000-4000-8000-aaaa00000071'
    writeProject(root, {
      name: 'P',
      model: {
        id: '00000000-0000-4000-8000-aaaa00000072',
        name: 'M',
        version: '1.0.0',
        packages: [
          {
            id: newPkgId(),
            name: 'p',
            packages: [],
            enums: [],
            entities: [
              { id: baseId, name: 'Base', attributes: [], kind: 'abstract' },
              {
                id: userId,
                name: 'User',
                attributes: [],
                kind: 'default',
                extends: baseId,
              },
            ],
          },
        ],
      },
    })
    const graph = await loadProjectGraph(root)
    const { violations } = validateModelAgainstGraph(graph.root.models[0], graph)
    expect(violations).toEqual([])
  })
})
