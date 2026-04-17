import { defineStore } from 'pinia'
import type { JsonObject } from 'type-fest'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

export const LOCAL_STORAGE_KEY = 'xomda-config'

export type LocalStorageConfig = JsonObject

export const useLocalStorage = (key: string, defaultValue: unknown = {}) => {
  const defaultFn = typeof defaultValue === 'function' ? defaultValue : () => defaultValue
  const getInitialValue = (): LocalStorageConfig => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultFn()
    } catch {
      return defaultFn()
    }
  }

  const state = ref<LocalStorageConfig>(getInitialValue())

  watch(
    state,
    (value) => {
      localStorage.setItem(key, JSON.stringify(value))
    },
    { deep: true }
  )

  const clear = () => {
    localStorage.removeItem(key)
    state.value = defaultFn()
  }

  return {
    state,
    clear,
  }
}

export type SortBy = 'name' | 'type' | 'modified' | 'size'
export type SortDir = 'asc' | 'desc'
export type SortState = { by: SortBy; dir: SortDir }

const SORT_BY: ReadonlyArray<SortBy> = ['name', 'type', 'modified', 'size']
const SORT_DIR: ReadonlyArray<SortDir> = ['asc', 'desc']

const normalizeSort = (raw: unknown, fallback: SortState): SortState => {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Partial<SortState>
  const by = SORT_BY.includes(r.by as SortBy) ? (r.by as SortBy) : fallback.by
  const dir = SORT_DIR.includes(r.dir as SortDir) ? (r.dir as SortDir) : fallback.dir
  return { by, dir }
}

export const useLocalStorageStore = defineStore('local-storage', () => {
  const { state: store, clear } = useLocalStorage(LOCAL_STORAGE_KEY, () => ({}))
  return {
    clear,

    localStorage: store,

    darkMode: computed({
      get: (): boolean => !!store.value.darkMode,
      set: (value: boolean) => (store.value = { ...store.value, darkMode: value }),
    }) as Ref<boolean>,

    navExpanded: computed({
      get: (): boolean => !!store.value.navExpanded,
      set: (value: boolean) => (store.value = { ...store.value, navExpanded: value }),
    }) as Ref<boolean>,

    cellHeights: computed({
      get: (): Record<string, number> => (store.value.cellHeights as Record<string, number>) ?? {},
      set: (value: Record<string, number>) =>
        (store.value = { ...store.value, cellHeights: value }),
    }) as Ref<Record<string, number>>,

    fileViewMode: computed({
      get: (): 'list' | 'tree' => (store.value.fileViewMode === 'list' ? 'list' : 'tree'),
      set: (value: 'list' | 'tree') => (store.value = { ...store.value, fileViewMode: value }),
    }) as Ref<'list' | 'tree'>,

    fileTreeExpanded: computed({
      get: (): string[] => (store.value.fileTreeExpanded as string[]) ?? [],
      set: (value: string[]) => (store.value = { ...store.value, fileTreeExpanded: value }),
    }) as Ref<string[]>,

    templateViewMode: computed({
      get: (): 'list' | 'tree' => (store.value.templateViewMode === 'list' ? 'list' : 'tree'),
      set: (value: 'list' | 'tree') => (store.value = { ...store.value, templateViewMode: value }),
    }) as Ref<'list' | 'tree'>,

    templateTreeExpanded: computed({
      get: (): string[] => (store.value.templateTreeExpanded as string[]) ?? [],
      set: (value: string[]) => (store.value = { ...store.value, templateTreeExpanded: value }),
    }) as Ref<string[]>,

    fileSort: computed({
      get: (): SortState => normalizeSort(store.value.fileSort, { by: 'name', dir: 'asc' }),
      set: (value: SortState) => (store.value = { ...store.value, fileSort: value }),
    }) as Ref<SortState>,

    templateSort: computed({
      get: (): SortState => normalizeSort(store.value.templateSort, { by: 'name', dir: 'asc' }),
      set: (value: SortState) => (store.value = { ...store.value, templateSort: value }),
    }) as Ref<SortState>,

    diagramZoom: computed({
      get: (): number => {
        const n = Number(store.value.diagramZoom)
        return Number.isFinite(n) ? n : 1
      },
      set: (value: number) => (store.value = { ...store.value, diagramZoom: value }),
    }) as Ref<number>,

    /**
     * Sticky tab selection for plugin-contributed multi-view files,
     * keyed by `fileTypeId` (NOT by path) — when the user opens a
     * second pom.xml after switching one to the Info tab, they land on
     * Info again. Matches JetBrains' "remember view per kind" UX.
     */
    fileTypeView: computed({
      get: (): Record<string, string> => (store.value.fileTypeView as Record<string, string>) ?? {},
      set: (value: Record<string, string>) =>
        (store.value = { ...store.value, fileTypeView: value }),
    }) as Ref<Record<string, string>>,
  }
})
