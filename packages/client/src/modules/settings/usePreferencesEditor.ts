import { defaultProjectSettings, type ProjectSettings } from '@xomda/core'
import { useEditBuffer, useMutation } from '@xomda/ui'
import {
  type ComputedRef,
  inject,
  type InjectionKey,
  provide,
  type Ref,
  ref,
  shallowRef,
} from 'vue'

import { trpc } from '../../trpc'

export interface PluginInfo {
  id: string
  name: string
  /** Core plugins are always on; the UI renders the switch disabled. */
  core: boolean
}

export interface PreferencesDraft {
  settings: ProjectSettings
  /** Sorted list of explicitly-enabled plugin ids. Empty = server-side "no filter". */
  plugins: string[]
}

export interface PreferencesEditor {
  /** True once the server confirmed a `.xomda/project.json` exists. */
  projectExists: Ref<boolean>
  loading: Ref<boolean>
  saving: Ref<boolean>
  refreshing: Ref<boolean>
  /**
   * The live edit buffer. Always non-null once `load()` has resolved:
   * we initialise with `emptyDraft()` so consumers never have to guard
   * against `null` in templates.
   */
  draft: Ref<PreferencesDraft>
  /** Read-only snapshot used to compute dirty / drive Cancel. */
  initial: Ref<PreferencesDraft>
  dirty: ComputedRef<boolean>
  allPlugins: Ref<PluginInfo[]>
  detectedPlugins: Ref<ReadonlySet<string>>
  load: () => Promise<void>
  save: () => Promise<void>
  revert: () => void
  /** Server-side rescan; persists immediately and rebaselines plugins. */
  refreshPluginsAutoDetect: () => Promise<void>
}

const KEY: InjectionKey<PreferencesEditor> = Symbol('PreferencesEditor')

const emptyDraft = (): PreferencesDraft => ({
  settings: defaultProjectSettings(),
  plugins: [],
})

/**
 * Single source of truth for the Preferences view's edit buffer. One
 * shared draft for every card on the page so the sticky Save / Cancel
 * bar at the bottom drives them all at once. Cards inject the editor
 * via `usePreferencesContext()` and mutate `draft.value` directly.
 *
 * Auto-detect is intentionally outside the dirty model — it persists
 * immediately (it *is* the user's intent), then rebaselines `plugins`
 * so other in-flight changes stay flagged dirty.
 *
 * The buffer + dirty tracking + revert are delegated to the canonical
 * `useEditBuffer` (AGENTS.md §"Canonical composables"). load/save are
 * wrapped in `useMutation` so failures surface as toasts via the
 * notifications store rather than silently rejecting.
 */
export const createPreferencesEditor = (): PreferencesEditor => {
  const projectExists = ref(false)
  const allPlugins = shallowRef<PluginInfo[]>([])
  const detectedPlugins = ref<ReadonlySet<string>>(new Set())

  const buffer = useEditBuffer<PreferencesDraft>(emptyDraft())
  // `useEditBuffer<T>` types draft/baseline as `Ref<T | null>`, but here we
  // initialise non-null and only `set()` with non-null values — so the cast
  // to `Ref<PreferencesDraft>` is sound at every observation point. Cards
  // bind directly to .value.settings etc. and don't need to null-check.
  const draft = buffer.draft as Ref<PreferencesDraft>
  const initial = buffer.baseline as Ref<PreferencesDraft>
  const dirty = buffer.dirty

  const loadMutation = useMutation(
    async () => {
      const [meta, plugins] = await Promise.all([
        trpc.project.meta.query(),
        trpc.project.listPlugins.query().catch(() => [] as PluginInfo[]),
      ])
      allPlugins.value = plugins
      try {
        const scan = await trpc.project.scan.query()
        detectedPlugins.value = new Set(scan.detectedIds)
      } catch {
        detectedPlugins.value = new Set()
      }
      if (meta) {
        projectExists.value = true
        const snapshot: PreferencesDraft = {
          settings: { ...meta.settings, excludeFromScan: [...meta.settings.excludeFromScan] },
          plugins: [...meta.plugins],
        }
        buffer.set(snapshot)
      } else {
        projectExists.value = false
        buffer.set(emptyDraft())
      }
      return undefined
    },
    { notify: true }
  )

  const saveMutation = useMutation(
    async () => {
      const existing = await trpc.project.meta.query()
      await trpc.project.updateMeta.mutate({
        meta: {
          name: existing?.name ?? 'project',
          description:
            existing && typeof existing.description === 'string' ? existing.description : undefined,
          versions: existing?.versions ?? { head: null, versions: [] },
          settings: {
            ...(existing?.settings ?? defaultProjectSettings()),
            ...draft.value.settings,
            excludeFromScan: [...draft.value.settings.excludeFromScan].sort(),
          },
          plugins: [...draft.value.plugins].sort(),
        },
      })
      // Rebaseline so dirty flips back to false.
      buffer.commit()
      projectExists.value = true
      return undefined
    },
    { notify: true, successMessage: 'Saved.' }
  )

  const refreshMutation = useMutation(
    async () => {
      const result = await trpc.project.refreshPlugins.mutate({})
      // refreshPlugins persists server-side, so the new list is *now* the
      // baseline for plugins. Other in-flight edits (sandbox / diagram /
      // boundaries) must survive — so we DON'T use buffer.set() (which
      // would rebaseline the whole draft and clean unrelated dirt).
      // Instead we mutate the baseline plugins field directly and apply
      // the same fresh list to the draft. `useEditBuffer.baseline` is
      // typed Readonly<Ref<T|null>> but its underlying ref is writable —
      // this is the one place we need to bypass the public API.
      const fresh = [...result.plugins].sort()
      const writableBaseline = buffer.baseline as Ref<PreferencesDraft>
      writableBaseline.value = { ...writableBaseline.value, plugins: fresh }
      draft.value = { ...draft.value, plugins: [...fresh] }
      detectedPlugins.value = new Set(result.detectedIds)
      return undefined
    },
    { notify: true }
  )

  return {
    projectExists,
    loading: loadMutation.loading,
    saving: saveMutation.loading,
    refreshing: refreshMutation.loading,
    draft,
    initial,
    dirty,
    allPlugins,
    detectedPlugins,
    load: async () => {
      await loadMutation.run()
    },
    save: async () => {
      await saveMutation.run()
    },
    revert: () => buffer.revert(),
    refreshPluginsAutoDetect: async () => {
      await refreshMutation.run()
    },
  }
}

/** Provide an editor instance to descendant cards. */
export const providePreferencesEditor = (editor: PreferencesEditor) => provide(KEY, editor)

/** Inject the editor — throws if no provider is present (cards have no fallback). */
export const usePreferencesContext = (): PreferencesEditor => {
  const editor = inject(KEY)
  if (!editor) {
    throw new Error(
      'usePreferencesContext() called outside <SettingsView>. Wrap the card in a provider.'
    )
  }
  return editor
}
