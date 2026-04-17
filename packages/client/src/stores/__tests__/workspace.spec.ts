import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workspaceQueryMock = vi.fn()
const createModelMock = vi.fn()
const renameModelMock = vi.fn()
const deleteModelMock = vi.fn()

vi.mock('../../trpc', () => ({
  trpc: {
    project: {
      workspace: {
        query: (args: { root?: string } = {}) => workspaceQueryMock(args),
      },
    },
    model: {
      createModel: { mutate: (args: unknown) => createModelMock(args) },
      renameModel: { mutate: (args: unknown) => renameModelMock(args) },
      deleteModel: { mutate: (args: unknown) => deleteModelMock(args) },
    },
  },
}))

import { useWorkspaceStore } from '../workspace'

type Model = { id: string; name: string; version: string; isPrimary: boolean }
type Project = {
  root: string
  name: string
  isRoot: boolean
  description?: string
  models: Model[]
}

const makeModel = (id: string, name: string, isPrimary = false): Model => ({
  id,
  name,
  version: '1.0.0',
  isPrimary,
})

const makeProject = (root: string, name: string, models: Model[], isRoot = false): Project => ({
  root,
  name,
  isRoot,
  models,
})

const wsResponse = (workspace: Project, subprojects: Project[] = []) => ({
  workspace,
  subprojects,
})

beforeEach(() => {
  setActivePinia(createPinia())
  workspaceQueryMock.mockReset()
  createModelMock.mockReset()
  renameModelMock.mockReset()
  deleteModelMock.mockReset()
})

describe('useWorkspaceStore — initial state', () => {
  it('starts empty before load() resolves', () => {
    const s = useWorkspaceStore()
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.loaded).toBe(false)
    expect(s.workspace).toBeNull()
    expect(s.subprojects).toEqual([])
    expect(s.activeProjectRoot).toBeNull()
    expect(s.activeModelId).toBeNull()
    expect(s.projects).toEqual([])
    expect(s.activeProject).toBeNull()
    expect(s.activeModel).toBeNull()
  })
})

describe('useWorkspaceStore — load()', () => {
  it('hydrates state and defaults active selection to the workspace primary', async () => {
    const primary = makeModel('m-1', 'Main', true)
    const secondary = makeModel('m-2', 'Domain')
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [primary, secondary], true))
    )

    const s = useWorkspaceStore()
    const ok = await s.load()

    expect(ok).toBe(true)
    expect(s.loaded).toBe(true)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.workspace?.root).toBe('/repo')
    expect(s.activeProjectRoot).toBe('/repo')
    expect(s.activeModelId).toBe('m-1')
    expect(s.activeProject?.name).toBe('root')
    expect(s.activeModel?.name).toBe('Main')
  })

  it('surfaces a ParsedTrpcError on failure without throwing', async () => {
    workspaceQueryMock.mockRejectedValueOnce(new Error('boom'))
    const s = useWorkspaceStore()
    const ok = await s.load()
    expect(ok).toBe(false)
    expect(s.loaded).toBe(false)
    expect(s.error).not.toBeNull()
    expect(s.error?.message).toBe('boom')
    expect(s.loading).toBe(false)
  })

  it('preserves the user selection on subsequent load() calls (refresh semantics)', async () => {
    const primary = makeProject('/repo', 'root', [
      makeModel('m-1', 'Main', true),
      makeModel('m-2', 'Domain'),
    ])
    workspaceQueryMock.mockResolvedValue(wsResponse(primary))

    const s = useWorkspaceStore()
    await s.load()
    s.selectModel('m-2')
    expect(s.activeModelId).toBe('m-2')

    // Refresh — server-side state unchanged. The store keeps the user's pick.
    await s.refresh()
    expect(s.activeModelId).toBe('m-2')
    expect(s.activeProjectRoot).toBe('/repo')
  })

  it('orders projects with the workspace root first, then subprojects in given order', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-r', 'R', true)]), [
        makeProject('/repo/sub-a', 'a', [makeModel('m-a', 'A', true)]),
        makeProject('/repo/sub-b', 'b', [makeModel('m-b', 'B', true)], true),
      ])
    )
    const s = useWorkspaceStore()
    await s.load()
    expect(s.projects.map((p) => p.name)).toEqual(['root', 'a', 'b'])
  })

  it('resets activeModelId when current selection no longer exists in the active project', async () => {
    // First load: model m-2 exists.
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(
        makeProject('/repo', 'root', [makeModel('m-1', 'Main', true), makeModel('m-2', 'X')])
      )
    )
    const s = useWorkspaceStore()
    await s.load()
    s.selectModel('m-2')

    // Second load: m-2 has been deleted server-side. Selection must fall back.
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Main', true)]))
    )
    await s.refresh()
    expect(s.activeModelId).toBe('m-1')
  })
})

describe('useWorkspaceStore — selectProject()', () => {
  const fixture = () =>
    wsResponse(
      makeProject('/repo', 'root', [makeModel('m-r', 'R', true), makeModel('m-r2', 'R2')]),
      [
        makeProject('/repo/sub', 'sub', [makeModel('m-s', 'S', true), makeModel('m-s2', 'S2')]),
        makeProject('/repo/iso', 'iso', [makeModel('m-i', 'I', true)], true),
      ]
    )

  it('switches to the target project and defaults to its primary model', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const s = useWorkspaceStore()
    await s.load()
    s.selectProject('/repo/sub')
    expect(s.activeProjectRoot).toBe('/repo/sub')
    expect(s.activeModelId).toBe('m-s')
  })

  it('restores the sticky model pick on round-trip back to a previously visited project', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const s = useWorkspaceStore()
    await s.load()

    // Switch to sub, then pick S2.
    s.selectProject('/repo/sub')
    s.selectModel('m-s2')
    expect(s.activeModelId).toBe('m-s2')

    // Hop away then back — must restore S2, not snap to primary.
    s.selectProject('/repo/iso')
    expect(s.activeModelId).toBe('m-i')
    s.selectProject('/repo/sub')
    expect(s.activeModelId).toBe('m-s2')
  })

  it('is a no-op when called with the already-active root', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const s = useWorkspaceStore()
    await s.load()
    s.selectModel('m-r2')
    s.selectProject('/repo') // already active — must NOT reset to primary
    expect(s.activeModelId).toBe('m-r2')
  })

  it('is a no-op for an unknown root (defensive — UI should never offer one)', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const s = useWorkspaceStore()
    await s.load()
    s.selectProject('/somewhere/else')
    expect(s.activeProjectRoot).toBe('/repo')
  })
})

describe('useWorkspaceStore — selectModel()', () => {
  it('persists the pick into selectedModelByProject so selectProject restores it', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(
        makeProject('/repo', 'root', [makeModel('m-1', 'Main', true), makeModel('m-2', 'B')])
      )
    )
    const s = useWorkspaceStore()
    await s.load()
    s.selectModel('m-2')
    expect(s.selectedModelByProject).toEqual({ '/repo': 'm-2' })
  })

  it('rejects an unknown model id without mutating state', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Main', true)]))
    )
    const s = useWorkspaceStore()
    await s.load()
    s.selectModel('does-not-exist')
    expect(s.activeModelId).toBe('m-1')
    expect(s.selectedModelByProject).toEqual({})
  })
})

describe('useWorkspaceStore — createModel()', () => {
  it('creates the model, refreshes, switches active project + model', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Main', true)]))
    )
    const s = useWorkspaceStore()
    await s.load()

    const created = { id: 'm-new', name: 'Fresh', version: '1.0.0', isPrimary: false }
    createModelMock.mockResolvedValueOnce(created)

    // After create the workspace query must reflect the new model.
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(
        makeProject('/repo', 'root', [makeModel('m-1', 'Main', true), { ...created } as Model])
      )
    )

    const result = await s.createModel('/repo', 'Fresh')
    expect(createModelMock).toHaveBeenCalledWith({ root: '/repo', name: 'Fresh' })
    expect(result?.id).toBe('m-new')
    expect(s.activeModelId).toBe('m-new')
    expect(s.activeProjectRoot).toBe('/repo')
  })

  it('surfaces failure via error and returns null', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Main', true)]))
    )
    const s = useWorkspaceStore()
    await s.load()

    createModelMock.mockRejectedValueOnce(new Error('name in use'))
    const result = await s.createModel('/repo', 'dup')
    expect(result).toBeNull()
    expect(s.error?.message).toBe('name in use')
    // Active selection unchanged on failure.
    expect(s.activeModelId).toBe('m-1')
  })
})

describe('useWorkspaceStore — renameModel()', () => {
  it('calls the router and refreshes the workspace', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Old', true)]))
    )
    const s = useWorkspaceStore()
    await s.load()

    renameModelMock.mockResolvedValueOnce({
      id: 'm-1',
      name: 'New',
      version: '1.0.0',
      isPrimary: true,
    })
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'New', true)]))
    )

    const renamed = await s.renameModel('/repo', 'm-1', 'New')
    expect(renamed?.name).toBe('New')
    expect(s.activeModel?.name).toBe('New')
  })

  it('surfaces failure via error and returns null', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Old', true)]))
    )
    const s = useWorkspaceStore()
    await s.load()

    renameModelMock.mockRejectedValueOnce(new Error('bad name'))
    const renamed = await s.renameModel('/repo', 'm-1', '')
    expect(renamed).toBeNull()
    expect(s.error?.message).toBe('bad name')
  })
})

describe('useWorkspaceStore — deleteModel()', () => {
  it('deletes, clears sticky memory + active selection, then refreshes', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(
        makeProject('/repo', 'root', [makeModel('m-1', 'Main', true), makeModel('m-2', 'X')])
      )
    )
    const s = useWorkspaceStore()
    await s.load()
    s.selectModel('m-2')
    expect(s.selectedModelByProject['/repo']).toBe('m-2')

    deleteModelMock.mockResolvedValueOnce({ ok: true })
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(makeProject('/repo', 'root', [makeModel('m-1', 'Main', true)]))
    )

    const ok = await s.deleteModel('/repo', 'm-2')
    expect(ok).toBe(true)
    expect(s.selectedModelByProject['/repo']).toBeUndefined()
    expect(s.activeModelId).toBe('m-1') // refreshed to primary
  })

  it('surfaces refusal to delete the primary (rewrapped as BAD_REQUEST)', async () => {
    workspaceQueryMock.mockResolvedValueOnce(
      wsResponse(
        makeProject('/repo', 'root', [makeModel('m-1', 'Main', true), makeModel('m-2', 'X')])
      )
    )
    const s = useWorkspaceStore()
    await s.load()

    deleteModelMock.mockRejectedValueOnce(new Error('cannot delete primary'))
    const ok = await s.deleteModel('/repo', 'm-1')
    expect(ok).toBe(false)
    expect(s.error?.message).toBe('cannot delete primary')
  })
})
