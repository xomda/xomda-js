import { defaultProjectSettings } from '@xomda/core'
import { vi } from 'vitest'
import { computed, defineComponent, h, type Ref, ref, shallowRef, type VNode } from 'vue'

import {
  type PluginInfo,
  type PreferencesDraft,
  type PreferencesEditor,
  providePreferencesEditor,
} from '../usePreferencesEditor'

const clonePreferencesDraft = (d: PreferencesDraft): PreferencesDraft => structuredClone(d)
const preferencesDraftsEqual = (a: PreferencesDraft, b: PreferencesDraft): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

interface EditorOverrides {
  projectExists?: boolean
  draft?: Partial<PreferencesDraft>
  initial?: Partial<PreferencesDraft>
  allPlugins?: PluginInfo[]
  detectedPlugins?: Iterable<string>
}

const baseDraft = (overrides?: Partial<PreferencesDraft>): PreferencesDraft => ({
  settings: { ...defaultProjectSettings(), ...overrides?.settings },
  plugins: overrides?.plugins ? [...overrides.plugins] : [],
})

/**
 * Build an in-memory `PreferencesEditor` for tests. Mirrors the real
 * composable's contract (reactive refs + computed `dirty`) but replaces
 * the tRPC-backed actions with `vi.fn()` spies so test code can assert
 * on save/revert/refresh invocations without a live server.
 */
export const createTestEditor = (overrides: EditorOverrides = {}) => {
  const projectExists = ref(overrides.projectExists ?? true)
  const loading = ref(false)
  const saving = ref(false)
  const refreshing = ref(false)
  const draft: Ref<PreferencesDraft> = ref(baseDraft(overrides.draft))
  const initial: Ref<PreferencesDraft> = ref(baseDraft(overrides.initial ?? overrides.draft))
  const allPlugins = shallowRef<PluginInfo[]>(overrides.allPlugins ?? [])
  const detectedPlugins = ref<ReadonlySet<string>>(new Set(overrides.detectedPlugins ?? []))

  const dirty = computed(() => !preferencesDraftsEqual(draft.value, initial.value))

  const load = vi.fn(async () => {})
  const save = vi.fn(async () => {
    initial.value = clonePreferencesDraft(draft.value)
  })
  const revert = vi.fn(() => {
    draft.value = clonePreferencesDraft(initial.value)
  })
  const refreshPluginsAutoDetect = vi.fn(async () => {})

  const editor: PreferencesEditor = {
    projectExists,
    loading,
    saving,
    refreshing,
    draft,
    initial,
    dirty,
    allPlugins,
    detectedPlugins,
    load,
    save,
    revert,
    refreshPluginsAutoDetect,
  }

  return { editor, spies: { load, save, revert, refreshPluginsAutoDetect } }
}

/**
 * Wrap a card in a tiny host that provides a (test-built) editor, so
 * the card under test can `inject` it via `usePreferencesContext()`.
 */
export const provideHost = (editor: PreferencesEditor, slot: () => VNode) =>
  defineComponent({
    name: 'PreferencesTestHost',
    setup() {
      providePreferencesEditor(editor)
      return () => h('div', [slot()])
    },
  })
