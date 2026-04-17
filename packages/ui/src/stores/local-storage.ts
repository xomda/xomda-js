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
  }
})
