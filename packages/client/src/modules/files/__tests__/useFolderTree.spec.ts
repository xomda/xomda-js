import { mount } from '@vue/test-utils'
import type { SortState } from '@xomda/ui'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import type { FileEntry, PreviewMap } from '../types'
import { useFolderTree } from '../useFolderTree'

const listMock = vi.fn<(args: { path: string; showHidden: boolean }) => Promise<FileEntry[]>>()

vi.mock('../../../trpc', () => ({
  trpc: {
    file: {
      list: { query: (args: { path: string; showHidden: boolean }) => listMock(args) },
    },
  },
}))

const entry = (name: string, isDirectory = false): FileEntry => ({
  name,
  isDirectory,
  size: isDirectory ? 0 : 10,
  mtime: '',
})

interface Harness {
  tree: ReturnType<typeof useFolderTree>
  showHidden: ReturnType<typeof ref<boolean>>
  showGenerated: ReturnType<typeof ref<boolean>>
  previewMap: ReturnType<typeof ref<PreviewMap>>
  currentPath: ReturnType<typeof ref<string>>
}

function mountHarness(initial: { previewMap?: PreviewMap; currentPath?: string } = {}): Harness {
  const showHidden = ref(false)
  const showGenerated = ref(true)
  const previewMap = ref<PreviewMap>(initial.previewMap ?? new Map())
  const currentPath = ref<string>(initial.currentPath ?? '.')
  const sort = ref<SortState>({ by: 'name', dir: 'asc' })
  let tree!: ReturnType<typeof useFolderTree>

  const Comp = defineComponent({
    setup() {
      tree = useFolderTree({ showHidden, showGenerated, previewMap, currentPath, sort })
      return () => h('div')
    },
  })
  mount(Comp)
  return { tree, showHidden, showGenerated, previewMap, currentPath }
}

function installFakeLocalStorage(seed: Record<string, string> = {}): void {
  const data = new Map<string, string>(Object.entries(seed))
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => void data.clear(),
      get length() {
        return data.size
      },
      key: (i: number) => Array.from(data.keys())[i] ?? null,
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  installFakeLocalStorage()
  listMock.mockReset()
})

afterEach(() => {
  vi.clearAllTimers()
})

describe('useFolderTree', () => {
  it('loads the root listing on mount', async () => {
    listMock.mockResolvedValue([entry('a', true), entry('b.txt')])
    const h = mountHarness()
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(listMock).toHaveBeenCalledWith({ path: '.', showHidden: false })
    expect(h.tree.visibleNodes.value.map((n) => n.path)).toEqual(['a', 'b.txt'])
  })

  it('expanding a folder fetches its children and renders them indented', async () => {
    listMock.mockImplementation(async ({ path }) => {
      if (path === '.') return [entry('a', true)]
      if (path === 'a') return [entry('child.txt')]
      return []
    })
    const h = mountHarness()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    h.tree.toggle('a')
    // toggle calls expand → fetch (async) → cache
    await nextTick()
    await Promise.resolve()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    const nodes = h.tree.visibleNodes.value
    expect(nodes.map((n) => `${n.path}@${n.depth}`)).toEqual(['a@0', 'a/child.txt@1'])
    expect(listMock).toHaveBeenCalledWith({ path: 'a', showHidden: false })
  })

  it('caches children — re-expanding does not re-fetch', async () => {
    listMock.mockImplementation(async ({ path }) =>
      path === '.' ? [entry('a', true)] : [entry('child.txt')]
    )
    const h = mountHarness()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    h.tree.toggle('a') // expand
    await nextTick()
    await Promise.resolve()
    await nextTick()
    h.tree.toggle('a') // collapse
    await nextTick()
    h.tree.toggle('a') // expand again
    await nextTick()

    const aCalls = listMock.mock.calls.filter((c) => c[0].path === 'a')
    expect(aCalls).toHaveLength(1)
  })

  it('collapses an expanded folder so its children are no longer visible', async () => {
    listMock.mockImplementation(async ({ path }) =>
      path === '.' ? [entry('a', true)] : [entry('child.txt')]
    )
    const h = mountHarness()
    await nextTick()
    await Promise.resolve()
    await nextTick()

    h.tree.toggle('a')
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(h.tree.visibleNodes.value.length).toBe(2)

    h.tree.toggle('a')
    await nextTick()
    expect(h.tree.visibleNodes.value.length).toBe(1)
  })

  it('toggling showHidden invalidates cache and re-fetches expanded paths', async () => {
    listMock.mockResolvedValue([entry('a', true)])
    const h = mountHarness()
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(listMock).toHaveBeenCalledTimes(1)

    h.showHidden.value = true
    await nextTick()
    await Promise.resolve()
    await nextTick()
    // root re-fetched with new showHidden
    expect(listMock).toHaveBeenLastCalledWith({ path: '.', showHidden: true })
  })

  it('merges virtual entries from previewMap into the tree at the right depth', async () => {
    listMock.mockResolvedValue([])
    const previewMap: PreviewMap = new Map([
      ['gen/a.ts', 'a'],
      ['gen/sub/b.ts', 'b'],
    ])
    const h = mountHarness({ previewMap })
    await nextTick()
    await Promise.resolve()
    await nextTick()

    expect(h.tree.visibleNodes.value.map((n) => n.path)).toEqual(['gen'])
    h.tree.toggle('gen')
    await nextTick()
    await Promise.resolve()
    await nextTick()
    const paths = h.tree.visibleNodes.value.map((n) => n.path)
    expect(paths).toContain('gen/a.ts')
    expect(paths).toContain('gen/sub')
  })

  it('does not auto-expand blocked paths (node_modules) from persisted state', async () => {
    installFakeLocalStorage({
      'xomda-config': JSON.stringify({ fileTreeExpanded: ['node_modules', 'src'] }),
    })
    setActivePinia(createPinia())
    listMock.mockResolvedValue([])
    const h = mountHarness()
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(Array.from(h.tree.expanded.value)).toEqual(['src'])
  })
})
