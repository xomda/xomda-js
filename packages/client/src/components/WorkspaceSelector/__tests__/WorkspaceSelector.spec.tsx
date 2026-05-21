import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createVuetify } from 'vuetify'

// happy-dom doesn't always wire localStorage/visualViewport — Vuetify's
// overlays read both, and our notifications store touches localStorage on
// mount. Shim both so the menu/skeleton tests don't unhandled-reject.
{
  const g = globalThis as unknown as Record<string, unknown>
  if (!g.localStorage) {
    const store = new Map<string, string>()
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size
      },
    }
  }
  if (!g.visualViewport) {
    g.visualViewport = {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
  }
}

const workspaceQueryMock = vi.fn()
const createModelMock = vi.fn()
const renameModelMock = vi.fn()
const deleteModelMock = vi.fn()
const promptMock = vi.fn()

vi.mock('../../../trpc', () => ({
  trpc: {
    project: {
      workspace: { query: (args: unknown) => workspaceQueryMock(args) },
    },
    model: {
      createModel: { mutate: (args: unknown) => createModelMock(args) },
      renameModel: { mutate: (args: unknown) => renameModelMock(args) },
      deleteModel: { mutate: (args: unknown) => deleteModelMock(args) },
    },
  },
}))

import type * as UiPkg from '@xomda/ui'

vi.mock('@xomda/ui', async () => {
  const actual = await vi.importActual<typeof UiPkg>('@xomda/ui')
  return {
    ...actual,
    usePrompt: () => ({
      prompt: (opts: unknown) => promptMock(opts),
    }),
  }
})

import { useWorkspaceStore } from '../../../stores/workspace'
import { WorkspaceSelector } from '../WorkspaceSelector'

const vuetify = createVuetify()
const wrappers: Array<ReturnType<typeof mount>> = []

function makeWrapper(props: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const w = mount(WorkspaceSelector, {
    props,
    global: { plugins: [vuetify, pinia] },
    attachTo: document.body,
  })
  wrappers.push(w)
  return w
}

type Model = { id: string; name: string; version: string; isPrimary: boolean }
type Project = {
  root: string
  name: string
  isRoot: boolean
  description?: string
  models: Model[]
}

const model = (id: string, name: string, isPrimary = false): Model => ({
  id,
  name,
  version: '1.0.0',
  isPrimary,
})

const project = (root: string, name: string, models: Model[], isRoot = false): Project => ({
  root,
  name,
  isRoot,
  models,
})

beforeEach(() => {
  workspaceQueryMock.mockReset()
  createModelMock.mockReset()
  renameModelMock.mockReset()
  deleteModelMock.mockReset()
  promptMock.mockReset()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('WorkspaceSelector — loading + error states', () => {
  it('renders a skeleton while the workspace is loading', async () => {
    let resolve: (v: unknown) => void = () => {}
    workspaceQueryMock.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r
      })
    )

    const w = makeWrapper()
    const store = useWorkspaceStore()
    const loadPromise = store.load()
    await nextTick()

    expect(w.find('.v-skeleton-loader').exists()).toBe(true)
    expect(w.find('.v-skeleton-loader').attributes('aria-busy')).toBe('true')

    resolve({ workspace: project('/repo', 'root', [model('m-1', 'Main', true)]), subprojects: [] })
    await loadPromise
    await flushPromises()

    expect(w.find('.v-skeleton-loader').exists()).toBe(false)
  })

  it('renders the retry affordance when load fails and re-invokes load() on click', async () => {
    workspaceQueryMock.mockRejectedValueOnce(new Error('cannot reach server'))

    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    expect(w.text()).toContain('Workspace failed to load')
    const retryBtn = w
      .findAll('button')
      .find((b) => b.attributes('aria-label') === 'Retry loading workspace')!
    expect(retryBtn.exists()).toBe(true)

    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)]),
      subprojects: [],
    })
    await retryBtn.trigger('click')
    await flushPromises()

    expect(workspaceQueryMock).toHaveBeenCalledTimes(2)
    expect(w.text()).not.toContain('Workspace failed to load')
  })
})

describe('WorkspaceSelector — label', () => {
  it('uses the labelPrefix prop for the visible button caption', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)]),
      subprojects: [],
    })

    const w = makeWrapper({ labelPrefix: 'Templates' })
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    const btn = w.findAll('button').find((b) => b.text().includes('Templates: Main'))!
    expect(btn.exists()).toBe(true)
  })

  it('falls back to "Model: <project> · (no model)" when the active project has no models', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', []),
      subprojects: [],
    })

    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    expect(w.text()).toContain('Model: root · (no model)')
  })
})

describe('WorkspaceSelector — single-project menu', () => {
  it('omits the "Other projects" subheader when only the workspace root exists', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)]),
      subprojects: [],
    })

    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    await w.find('button').trigger('click')
    await flushPromises()

    const body = document.body.textContent ?? ''
    expect(body).toContain('Main')
    expect(body).not.toContain('Other projects')
    expect(body).toContain('New model in root')
  })
})

describe('WorkspaceSelector — multi-project menu', () => {
  const fixture = () => ({
    workspace: project(
      '/repo',
      'root',
      [model('m-r', 'Root model', true), model('m-r2', 'Domain')],
      true
    ),
    subprojects: [
      project('/repo/sub-a', 'sub-a', [model('m-a', 'Sub-a primary', true)]),
      project('/repo/sub-b', 'sub-b', [model('m-b', 'Sub-b primary', true)], true),
    ],
  })

  it('renders one submenu entry per other project with ROOT suffix on isRoot subs', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    await w.find('button').trigger('click')
    await flushPromises()

    const body = document.body.textContent ?? ''
    expect(body).toContain('Other projects')
    expect(body).toContain('sub-a')
    expect(body).toContain('sub-b · ROOT')
  })

  it('renders the ROOT chip in the title-bar when the active project is isRoot AND siblings exist', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    expect(w.find('.v-chip').exists()).toBe(true)
    expect(w.text()).toContain('ROOT')
  })

  it('does NOT render the ROOT chip when the active project is the only workspace (no siblings)', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)], true),
      subprojects: [],
    })
    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    // No sibling projects → ROOT chip would be visual noise. Only the model
    // version chip is allowed in the title.
    const chipText = w.findAll('.v-chip').map((c) => c.text())
    expect(chipText.some((t) => t.includes('ROOT'))).toBe(false)
  })
})

describe('WorkspaceSelector — switching', () => {
  const fixture = () => ({
    workspace: project('/repo', 'root', [model('m-1', 'Main', true), model('m-2', 'Two')]),
    subprojects: [project('/repo/sub', 'sub', [model('m-s', 'S', true)])],
  })

  it('calls store.selectModel when clicking a non-active model in the active project', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()
    expect(store.activeModelId).toBe('m-1')

    await w.find('button').trigger('click')
    await flushPromises()

    const twoItem = Array.from(document.body.querySelectorAll('.v-list-item')).find((el) =>
      el.textContent?.includes('Two')
    ) as HTMLElement | undefined
    expect(twoItem).toBeDefined()
    twoItem!.click()
    await flushPromises()

    expect(store.activeModelId).toBe('m-2')
    expect(store.activeProjectRoot).toBe('/repo')
  })

  it('honours confirmSwitch === false: switch aborts and store state is unchanged', async () => {
    workspaceQueryMock.mockResolvedValueOnce(fixture())
    const w = makeWrapper({ confirmSwitch: () => false })
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    await w.find('button').trigger('click')
    await flushPromises()

    const twoItem = Array.from(document.body.querySelectorAll('.v-list-item')).find((el) =>
      el.textContent?.includes('Two')
    ) as HTMLElement | undefined
    twoItem!.click()
    await flushPromises()

    expect(store.activeModelId).toBe('m-1') // unchanged
  })
})

describe('WorkspaceSelector — creating a model', () => {
  it('prompts for a name, calls createModel on confirm, switches active selection', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)]),
      subprojects: [],
    })
    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    promptMock.mockResolvedValueOnce('Domain')
    const created = { id: 'm-new', name: 'Domain', version: '1.0.0', isPrimary: false }
    createModelMock.mockResolvedValueOnce(created)
    // Refresh after create.
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true), { ...created }]),
      subprojects: [],
    })

    await w.find('button').trigger('click')
    await flushPromises()

    const newItem = Array.from(document.body.querySelectorAll('.v-list-item')).find((el) =>
      el.textContent?.includes('New model in root')
    ) as HTMLElement | undefined
    newItem!.click()
    await flushPromises()

    expect(promptMock).toHaveBeenCalled()
    expect(createModelMock).toHaveBeenCalledWith({ root: '/repo', name: 'Domain' })
    expect(store.activeModelId).toBe('m-new')
  })

  it('cancels gracefully when the user dismisses the prompt', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)]),
      subprojects: [],
    })
    const w = makeWrapper()
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    promptMock.mockResolvedValueOnce(null) // dismissed

    await w.find('button').trigger('click')
    await flushPromises()
    const newItem = Array.from(document.body.querySelectorAll('.v-list-item')).find((el) =>
      el.textContent?.includes('New model in root')
    ) as HTMLElement | undefined
    newItem!.click()
    await flushPromises()

    expect(createModelMock).not.toHaveBeenCalled()
    expect(store.activeModelId).toBe('m-1')
  })

  it('hides the "New model" action when showCreateModel=false', async () => {
    workspaceQueryMock.mockResolvedValueOnce({
      workspace: project('/repo', 'root', [model('m-1', 'Main', true)]),
      subprojects: [],
    })
    const w = makeWrapper({ showCreateModel: false })
    const store = useWorkspaceStore()
    await store.load()
    await flushPromises()

    await w.find('button').trigger('click')
    await flushPromises()

    const body = document.body.textContent ?? ''
    expect(body).not.toContain('New model in')
  })
})
