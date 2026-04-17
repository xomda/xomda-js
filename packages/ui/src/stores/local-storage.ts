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

    /**
     * Whether the template-editor Properties side panel is shown. Sticky
     * across reloads so a user who closes it once doesn't have to close it
     * again every session. Defaults to `true` for first-time users so the
     * affordance is discoverable.
     */
    templatePropertiesOpen: computed({
      get: (): boolean => store.value.templatePropertiesOpen !== false,
      set: (value: boolean) => (store.value = { ...store.value, templatePropertiesOpen: value }),
    }) as Ref<boolean>,

    generateViewMode: computed({
      get: (): 'list' | 'tree' => (store.value.generateViewMode === 'tree' ? 'tree' : 'list'),
      set: (value: 'list' | 'tree') => (store.value = { ...store.value, generateViewMode: value }),
    }) as Ref<'list' | 'tree'>,

    /**
     * Sticky generate action — the split-button's default click repeats
     * whichever mode the user last invoked, so a dry-run-then-iterate
     * workflow doesn't require re-opening the menu each time.
     */
    generateAction: computed({
      get: (): 'write' | 'dry-run' =>
        store.value.generateAction === 'dry-run' ? 'dry-run' : 'write',
      set: (value: 'write' | 'dry-run') =>
        (store.value = { ...store.value, generateAction: value }),
    }) as Ref<'write' | 'dry-run'>,

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
     * Canvas pan offsets (screen pixels, applied post-scale). Persist
     * alongside zoom so reopening the model keeps the user's framing.
     * Default 0 = legacy behaviour (no pan, native overflow scroll only).
     */
    diagramPanX: computed({
      get: (): number => {
        const n = Number(store.value.diagramPanX)
        return Number.isFinite(n) ? n : 0
      },
      set: (value: number) => (store.value = { ...store.value, diagramPanX: value }),
    }) as Ref<number>,
    diagramPanY: computed({
      get: (): number => {
        const n = Number(store.value.diagramPanY)
        return Number.isFinite(n) ? n : 0
      },
      set: (value: number) => (store.value = { ...store.value, diagramPanY: value }),
    }) as Ref<number>,

    /**
     * Model-view: collapse state of the left tree side panel. Defaults
     * to collapsed — the tree is opt-in; users summon it from the title
     * bar when they need an overview.
     */
    modelTreeCollapsed: computed({
      get: (): boolean =>
        store.value.modelTreeCollapsed === undefined ? true : !!store.value.modelTreeCollapsed,
      set: (value: boolean) => (store.value = { ...store.value, modelTreeCollapsed: value }),
    }) as Ref<boolean>,

    /**
     * Model-view option: when something is selected, dim everything else
     * on the canvas to draw the eye to the selection. Default ON — most
     * useful behaviour out of the box; the user can toggle it off in
     * Preferences if they prefer the legacy flat look.
     */
    diagramDimNonSelected: computed({
      get: (): boolean =>
        store.value.diagramDimNonSelected === undefined
          ? true
          : !!store.value.diagramDimNonSelected,
      set: (value: boolean) => (store.value = { ...store.value, diagramDimNonSelected: value }),
    }) as Ref<boolean>,

    /**
     * How much to dim non-selected items when `diagramDimNonSelected`
     * is on. Stored as the dim amount in 0..1 (0 = no dimming,
     * 1 = fully transparent); the canvas applies `opacity: 1 - amount`.
     * Default 0.65 → opacity 0.35.
     */
    diagramDimAmount: computed({
      get: (): number => {
        const raw = store.value.diagramDimAmount
        const n = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(n)) return 0.65
        return Math.min(1, Math.max(0, n))
      },
      set: (value: number) =>
        (store.value = {
          ...store.value,
          diagramDimAmount: Math.min(1, Math.max(0, value)),
        }),
    }) as Ref<number>,

    /**
     * Per-frame velocity-retention factor for the diagram's drag-pan
     * inertia, in 0..1. 0 = no inertia (motion stops the instant the
     * pointer is released); ~0.92 = "natural" Apple-trackpad glide that
     * fades over roughly half a second at 60 Hz. Local-only so each
     * user can tune the feel without polluting the project file.
     */
    diagramInertia: computed({
      get: (): number => {
        const raw = store.value.diagramInertia
        const n = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(n)) return 0.92
        return Math.min(1, Math.max(0, n))
      },
      set: (value: number) =>
        (store.value = {
          ...store.value,
          diagramInertia: Math.min(1, Math.max(0, value)),
        }),
    }) as Ref<number>,

    /**
     * Model-view drag-mode toggle. Determines what a left-mouse drag
     * starting on a node does:
     *   - 'items' (default): drag moves the node, like a card on a
     *     pinboard. Background drag still pans the canvas.
     *   - 'pan': drag on a node pans the canvas too — useful when
     *     navigating large models where every grab should slide the
     *     scene, regardless of what the pointer happens to land on.
     */
    diagramCanvasMode: computed({
      get: (): 'items' | 'pan' => (store.value.diagramCanvasMode === 'pan' ? 'pan' : 'items'),
      set: (value: 'items' | 'pan') => (store.value = { ...store.value, diagramCanvasMode: value }),
    }) as Ref<'items' | 'pan'>,

    /**
     * Model-view grid-snap pan toggle. When on, the camera advances
     * one grid cell at a time on drag/wheel/inertia — useful for
     * keeping the painted grid visually aligned to integer screen
     * positions while navigating. Default off so panning stays smooth
     * out of the box.
     */
    diagramGridSnap: computed({
      get: (): boolean => !!store.value.diagramGridSnap,
      set: (value: boolean) => (store.value = { ...store.value, diagramGridSnap: value }),
    }) as Ref<boolean>,

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
