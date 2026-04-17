import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findByNameInProjectGraph, findInProjectGraph } from '../find'
import { loadProjectGraph } from '../loader'

let workspace = ''

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'xomda-pg-loader-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

interface MakeProjectOptions {
  name?: string
  parentProject?: string
  restrictReadsToProjectRoot?: boolean
  model?: object
}

function makeProject(absPath: string, opts: MakeProjectOptions = {}): void {
  mkdirSync(join(absPath, '.xomda'), { recursive: true })
  const project = {
    name: opts.name ?? absPath,
    ...(opts.parentProject !== undefined ? { parentProject: opts.parentProject } : {}),
    settings: {
      restrictReadsToProjectRoot: opts.restrictReadsToProjectRoot ?? true,
    },
  }
  writeFileSync(join(absPath, '.xomda', 'project.json'), JSON.stringify(project, null, 2))
  if (opts.model) {
    writeFileSync(join(absPath, '.xomda', 'model.json'), JSON.stringify(opts.model, null, 2))
  }
}

const userEntity = (id: string, name = 'User'): object => ({
  id,
  name,
  attributes: [],
  kind: 'default' as const,
})

let _seq = 100
const newPkgId = (): string => `99999999-9999-4999-8999-${String(++_seq).padStart(12, '0')}`

const minimalModel = (id: string, entities: object[]): object => ({
  id,
  name: 'M',
  version: '1.0.0',
  packages: [
    {
      id: newPkgId(),
      name: 'p',
      packages: [],
      enums: [],
      entities,
    },
  ],
})

describe('F3 — loadProjectGraph', () => {
  it('single project loads with idIndex of all entities, enums, and the model itself', () => {
    const root = join(workspace, 'p1')
    const entityId = '00000000-0000-4000-8000-aaaaaaaaaaa1'
    makeProject(root, {
      name: 'P1',
      model: minimalModel('00000000-0000-4000-8000-aaaa00000001', [userEntity(entityId)]),
    })
    return loadProjectGraph(root).then((graph) => {
      expect(graph.root.absPath).toBeTruthy()
      expect(graph.warnings).toEqual([])
      expect(graph.idIndex.get(entityId)?.kind).toBe('entity')
      expect(graph.idIndex.get('00000000-0000-4000-8000-aaaa00000001')?.kind).toBe('model')
    })
  })

  it('parent-child chain loads both projects, with idIndex spanning them', async () => {
    const child = join(workspace, 'child')
    const parent = join(workspace, 'parent')
    const parentEntityId = '00000000-0000-4000-8000-aaaa00000010'
    const childEntityId = '00000000-0000-4000-8000-bbbb00000010'
    makeProject(parent, {
      name: 'Parent',
      model: minimalModel('00000000-0000-4000-8000-aaaa00000011', [
        userEntity(parentEntityId, 'BaseUser'),
      ]),
    })
    makeProject(child, {
      name: 'Child',
      parentProject: '../parent',
      restrictReadsToProjectRoot: false,
      model: minimalModel('00000000-0000-4000-8000-bbbb00000011', [
        userEntity(childEntityId, 'CustomerUser'),
      ]),
    })

    const graph = await loadProjectGraph(child)
    expect(graph.root.parent).toBeDefined()
    expect(graph.idIndex.has(parentEntityId)).toBe(true)
    expect(graph.idIndex.has(childEntityId)).toBe(true)
  })

  it('cycle A → B → A is detected and broken; a warning is emitted', async () => {
    const a = join(workspace, 'a')
    const b = join(workspace, 'b')
    makeProject(a, { name: 'A', parentProject: '../b', restrictReadsToProjectRoot: false })
    makeProject(b, { name: 'B', parentProject: '../a', restrictReadsToProjectRoot: false })

    const graph = await loadProjectGraph(a)
    expect(graph.warnings.some((w) => w.kind === 'cycle')).toBe(true)
    // Two projects loaded, not infinite.
    expect(graph.visited.size).toBe(2)
  })

  it('id collision between projects emits an id-collision warning (later wins)', async () => {
    const sharedId = '00000000-0000-4000-8000-cccc00000001'
    const a = join(workspace, 'a')
    const b = join(workspace, 'b')
    makeProject(b, {
      name: 'B',
      model: minimalModel('00000000-0000-4000-8000-bbbb22222222', [userEntity(sharedId, 'BUser')]),
    })
    makeProject(a, {
      name: 'A',
      parentProject: '../b',
      restrictReadsToProjectRoot: false,
      model: minimalModel('00000000-0000-4000-8000-aaaa22222222', [userEntity(sharedId, 'AUser')]),
    })

    const graph = await loadProjectGraph(a)
    expect(graph.warnings.some((w) => w.kind === 'id-collision')).toBe(true)
  })

  it('restrictReads guard rejects parent outside sandbox (default true)', async () => {
    const child = join(workspace, 'child')
    const sibling = join(workspace, 'sibling')
    makeProject(sibling, { name: 'Sibling' })
    makeProject(child, {
      name: 'Child',
      parentProject: '../sibling' /* restrictReads default true */,
    })

    const graph = await loadProjectGraph(child)
    expect(
      graph.warnings.some(
        (w) => w.kind === 'parent-rejected' && w.reason === 'escapes-project-root'
      )
    ).toBe(true)
    expect(graph.root.parent).toBeUndefined()
  })
})

describe('F4 — findInProjectGraph + visibility', () => {
  it('finds an entity by id when no fromContext is supplied (admin lookup)', async () => {
    const root = join(workspace, 'p')
    const id = '00000000-0000-4000-8000-aaaa00000020'
    makeProject(root, {
      name: 'P',
      model: minimalModel('00000000-0000-4000-8000-aaaa00000021', [userEntity(id)]),
    })
    const graph = await loadProjectGraph(root)
    expect(findInProjectGraph(graph, id)?.kind).toBe('entity')
  })

  it('finds an entity by name with a kind filter', async () => {
    const root = join(workspace, 'p')
    const id = '00000000-0000-4000-8000-aaaa00000030'
    makeProject(root, {
      name: 'P',
      model: minimalModel('00000000-0000-4000-8000-aaaa00000031', [userEntity(id, 'Customer')]),
    })
    const graph = await loadProjectGraph(root)
    const hit = findByNameInProjectGraph(graph, 'Customer', 'entity')
    expect(hit?.kind).toBe('entity')
    if (hit?.kind === 'entity') expect(hit.value.id).toBe(id)
  })

  it('returns undefined when name lookup is filtered to a different kind', async () => {
    const root = join(workspace, 'p')
    const id = '00000000-0000-4000-8000-aaaa00000040'
    makeProject(root, {
      name: 'P',
      model: minimalModel('00000000-0000-4000-8000-aaaa00000041', [userEntity(id, 'Customer')]),
    })
    const graph = await loadProjectGraph(root)
    expect(findByNameInProjectGraph(graph, 'Customer', 'enum')).toBeUndefined()
  })

  it('cross-model lookup of a model-private entity returns undefined when fromContext differs', async () => {
    const childAbs = join(workspace, 'child')
    const parentAbs = join(workspace, 'parent')
    const privateId = '00000000-0000-4000-8000-aaaa00000050'
    const parentModelId = '00000000-0000-4000-8000-aaaa00000051'
    const childModelId = '00000000-0000-4000-8000-bbbb00000051'
    makeProject(parentAbs, {
      name: 'Parent',
      model: {
        ...minimalModel(parentModelId, [
          {
            id: privateId,
            name: 'Secret',
            attributes: [],
            kind: 'default' as const,
            visibility: 'model-private',
          } as object,
        ]),
      },
    })
    makeProject(childAbs, {
      name: 'Child',
      parentProject: '../parent',
      restrictReadsToProjectRoot: false,
      model: minimalModel(childModelId, []),
    })
    const graph = await loadProjectGraph(childAbs)
    const hit = findInProjectGraph(graph, privateId, { modelId: childModelId })
    expect(hit).toBeUndefined()
  })

  it('cross-model lookup of a public entity from parent project succeeds', async () => {
    const childAbs = join(workspace, 'child')
    const parentAbs = join(workspace, 'parent')
    const publicId = '00000000-0000-4000-8000-aaaa00000060'
    const parentModelId = '00000000-0000-4000-8000-aaaa00000061'
    const childModelId = '00000000-0000-4000-8000-bbbb00000061'
    makeProject(parentAbs, {
      name: 'Parent',
      model: {
        ...minimalModel(parentModelId, [
          {
            id: publicId,
            name: 'Shared',
            attributes: [],
            kind: 'default' as const,
            visibility: 'public',
          } as object,
        ]),
      },
    })
    makeProject(childAbs, {
      name: 'Child',
      parentProject: '../parent',
      restrictReadsToProjectRoot: false,
      model: minimalModel(childModelId, []),
    })
    const graph = await loadProjectGraph(childAbs)
    const hit = findInProjectGraph(graph, publicId, { modelId: childModelId })
    expect(hit?.kind).toBe('entity')
  })
})
