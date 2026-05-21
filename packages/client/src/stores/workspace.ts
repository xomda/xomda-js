import type { WorkspaceProjectInfo } from '@xomda/model'
import { type ParsedTrpcError, parseTrpcError } from '@xomda/ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { trpc } from '../trpc'

/** One project in the discovered workspace (cwd-resolved + each subproject). */
export type WorkspaceProject = WorkspaceProjectInfo

/** Lightweight descriptor of one model inside a project. */
export type WorkspaceModelDescriptor = WorkspaceProjectInfo['models'][number]

/**
 * Pinia store for the workspace lens that overlays every Model and Templates
 * view. Single source of truth for "which project + which model" the active
 * server calls should target. The server process never moves cwd; every
 * tRPC call passes `{ root, modelId }` taken from here.
 *
 * State is intentionally session-scoped (not persisted) in v1 — see
 * `selectedModelByProject` below. Persisting per-project picks across reloads
 * is a follow-up the existing `useLocalStorageStore` can absorb without
 * changing this contract.
 */
export const useWorkspaceStore = defineStore('workspace', () => {
  const loading = ref(false)
  const error = ref<ParsedTrpcError | null>(null)
  /** Whether a `load()` call has resolved at least once. */
  const loaded = ref(false)
  /** The cwd-resolved project (a.k.a. the workspace root). `null` until first load. */
  const workspace = ref<WorkspaceProject | null>(null)
  /** Nested subprojects (the xomda plugin walks `.xomda/`s under workspace, honouring `isRoot`). */
  const subprojects = ref<WorkspaceProject[]>([])
  /** Absolute path of the currently selected project. Defaults to `workspace.root` after load. */
  const activeProjectRoot = ref<string | null>(null)
  /** Id of the currently selected model. Defaults to the active project's primary model. */
  const activeModelId = ref<string | null>(null)
  /**
   * Sticky per-project memory: the last model id the user picked inside each
   * project. Survives `selectProject` round-trips so switching back restores
   * the user's last view rather than snapping to primary every time.
   */
  const selectedModelByProject = ref<Record<string, string>>({})

  /** Every known project, workspace root first. Stable order across renders. */
  const projects = computed<WorkspaceProject[]>(() => {
    const ws = workspace.value
    return ws ? [ws, ...subprojects.value] : []
  })

  /** The currently active project, or `null` when no workspace exists yet. */
  const activeProject = computed<WorkspaceProject | null>(() => {
    const root = activeProjectRoot.value
    if (root === null) return null
    return projects.value.find((p) => p.root === root) ?? null
  })

  /** The currently active model descriptor, or `null`. */
  const activeModel = computed<WorkspaceModelDescriptor | null>(() => {
    const id = activeModelId.value
    const proj = activeProject.value
    if (!id || !proj) return null
    return proj.models.find((m) => m.id === id) ?? null
  })

  /** Primary model descriptor of a given project (the `.xomda/model.json` entry). */
  function primaryOf(project: WorkspaceProject): WorkspaceModelDescriptor | null {
    return project.models.find((m) => m.isPrimary) ?? project.models[0] ?? null
  }

  /**
   * Resolve which model id to surface as the active one inside `project`,
   * preferring the sticky per-project memory and falling back to the primary.
   */
  function defaultModelIdFor(project: WorkspaceProject): string | null {
    const sticky = selectedModelByProject.value[project.root]
    if (sticky && project.models.some((m) => m.id === sticky)) return sticky
    return primaryOf(project)?.id ?? null
  }

  /**
   * Fetch the workspace from the server. Safe to call multiple times — the
   * second call replaces state. Errors surface via `error` + a toast; callers
   * branch on the return value (`true` = success, `false` = failed).
   */
  async function load(): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const res = await trpc.project.workspace.query({ root: '.' })
      workspace.value = res.workspace
      subprojects.value = res.subprojects
      // Initialise active selection ONLY when nothing is set yet (preserves
      // user choice across a manual `refresh()` after `createModel`, etc.).
      if (activeProjectRoot.value === null) {
        activeProjectRoot.value = res.workspace.root
      }
      const active = projects.value.find((p) => p.root === activeProjectRoot.value)
      if (
        active &&
        (activeModelId.value === null || !active.models.some((m) => m.id === activeModelId.value))
      ) {
        activeModelId.value = defaultModelIdFor(active)
      }
      loaded.value = true
      loading.value = false
      return true
    } catch (e) {
      error.value = parseTrpcError(e)
      loading.value = false
      return false
    }
  }

  /** Re-fetch the workspace, preserving the current selection. */
  function refresh(): Promise<boolean> {
    return load()
  }

  /**
   * Switch the active project. Restores the project's sticky model pick (or
   * its primary if none). No-op when `root` is already active.
   */
  function selectProject(root: string): void {
    if (activeProjectRoot.value === root) return
    const project = projects.value.find((p) => p.root === root)
    if (!project) return
    activeProjectRoot.value = root
    activeModelId.value = defaultModelIdFor(project)
  }

  /**
   * Switch the active model within the active project. Persists the pick
   * into `selectedModelByProject` so a later `selectProject` returns here.
   */
  function selectModel(modelId: string): void {
    const project = activeProject.value
    if (!project) return
    if (!project.models.some((m) => m.id === modelId)) return
    activeModelId.value = modelId
    selectedModelByProject.value = {
      ...selectedModelByProject.value,
      [project.root]: modelId,
    }
  }

  /**
   * Create a new (secondary) model inside `root` and switch to it. Returns
   * the created descriptor on success, `null` on failure (error already
   * surfaced via toast through `useMutation`-style error path).
   */
  async function createModel(root: string, name: string): Promise<WorkspaceModelDescriptor | null> {
    try {
      const created = await trpc.model.createModel.mutate({ root, name })
      await load()
      selectProject(root)
      if (created) selectModel(created.id)
      return created ?? null
    } catch (e) {
      error.value = parseTrpcError(e)
      return null
    }
  }

  /** Rename a model by id. Re-fetches the workspace so descriptors stay coherent. */
  async function renameModel(
    root: string,
    modelId: string,
    name: string
  ): Promise<WorkspaceModelDescriptor | null> {
    try {
      const renamed = await trpc.model.renameModel.mutate({ root, modelId, name })
      await load()
      return renamed ?? null
    } catch (e) {
      error.value = parseTrpcError(e)
      return null
    }
  }

  /**
   * Delete a model. Storage layer refuses to remove the primary while
   * secondaries exist; the router rewraps as BAD_REQUEST and we surface
   * it via `error` + the caller-controlled toast.
   */
  async function deleteModel(root: string, modelId: string): Promise<boolean> {
    try {
      await trpc.model.deleteModel.mutate({ root, modelId })
      // Drop sticky memory for the removed model id.
      if (selectedModelByProject.value[root] === modelId) {
        const next = { ...selectedModelByProject.value }
        delete next[root]
        selectedModelByProject.value = next
      }
      if (activeModelId.value === modelId) {
        activeModelId.value = null
      }
      await load()
      return true
    } catch (e) {
      error.value = parseTrpcError(e)
      return false
    }
  }

  return {
    // state
    loading,
    error,
    loaded,
    workspace,
    subprojects,
    activeProjectRoot,
    activeModelId,
    selectedModelByProject,
    // getters
    projects,
    activeProject,
    activeModel,
    // actions
    load,
    refresh,
    selectProject,
    selectModel,
    createModel,
    renameModel,
    deleteModel,
  }
})
