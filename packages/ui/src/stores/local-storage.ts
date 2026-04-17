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
      get: (): Record<string, number> =>
        (store.value.cellHeights as Record<string, number>) ?? {},
      set: (value: Record<string, number>) =>
        (store.value = { ...store.value, cellHeights: value }),
    }) as Ref<Record<string, number>>,

    fileViewMode: computed({
      get: (): 'list' | 'tree' => (store.value.fileViewMode === 'tree' ? 'tree' : 'list'),
      set: (value: 'list' | 'tree') => (store.value = { ...store.value, fileViewMode: value }),
    }) as Ref<'list' | 'tree'>,

    fileTreeExpanded: computed({
      get: (): string[] => (store.value.fileTreeExpanded as string[]) ?? [],
      set: (value: string[]) => (store.value = { ...store.value, fileTreeExpanded: value }),
    }) as Ref<string[]>,
  }
})
