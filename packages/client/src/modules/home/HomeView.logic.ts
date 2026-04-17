import { useAsyncState } from '@xomda/ui'
import { onMounted, ref } from 'vue'

import { trpc } from '../../trpc'

export interface ProjectMeta {
  name: string
  description?: string
}

export interface AncestorProject {
  path: string
  name: string
  isRoot: boolean
}

export interface ProjectContext {
  kind: 'in-root' | 'in-subfolder' | 'none'
  projectRoot?: string
  cwdHasXomda: boolean
  suggestions: { useFound?: string; createHere?: string }
  ancestorProjects: AncestorProject[]
}

export interface ModelSummary {
  entityCount: number
  enumCount: number
  packageCount: number
}

export interface TemplateSummary {
  templateCount: number
  folders: string[]
}

export interface ScannedFeature {
  pluginId: string
  name: string
  icon?: string
}

export interface ScannedSubproject {
  path: string
  name: string
  isRoot: boolean
}

export interface DetectedProjectChip {
  path: string
  name: string
  kinds: string[]
  isRoot: boolean
}

export interface ScanSummary {
  features: ScannedFeature[]
  subprojects: ScannedSubproject[]
  /** Every folder claimed by any projectKind, root included. */
  projects: DetectedProjectChip[]
  /** Plugin ids that claim the rootPath itself (host project's kinds). */
  rootKinds: string[]
  /** pluginId → count of non-root nested folders that kind claims. */
  projectKinds: Record<string, number>
}

/**
 * Drives the homepage. Pulls four independent pieces of state in
 * parallel so the page can paint each section as soon as its data
 * arrives — `scan` is the slowest (full worker-thread analysis),
 * while `meta`/`context`/`modelSummary` settle quickly.
 */
export function useHomeData() {
  const meta = ref<ProjectMeta | null>(null)
  const context = ref<ProjectContext | null>(null)
  const modelSummary = ref<ModelSummary | null>(null)
  const modelVersion = ref<string | null>(null)
  const templateSummary = ref<TemplateSummary | null>(null)
  const scan = ref<ScanSummary | null>(null)

  const metaState = useAsyncState<void>()
  const contextState = useAsyncState<void>()
  const modelState = useAsyncState<void>()
  const templateState = useAsyncState<void>()
  const scanState = useAsyncState<void>()

  const loadMeta = () =>
    metaState.run(async () => {
      const result = await trpc.project.meta.query()
      if (result) {
        meta.value = {
          name: result.name,
          description: typeof result.description === 'string' ? result.description : undefined,
        }
      } else {
        meta.value = null
      }
    })

  const loadContext = () =>
    contextState.run(async () => {
      context.value = await trpc.project.context.query()
    })

  const loadModelSummary = () =>
    modelState.run(async () => {
      const model = await trpc.model.get.query()
      let entityCount = 0
      let enumCount = 0
      let packageCount = 0
      const walk = (
        packages: Array<{ entities?: unknown[]; enums?: unknown[]; packages?: unknown[] }>
      ) => {
        for (const pkg of packages ?? []) {
          packageCount++
          entityCount += pkg.entities?.length ?? 0
          enumCount += pkg.enums?.length ?? 0
          // Recurse if the schema allows nested packages.
          walk((pkg.packages as Array<never>) ?? [])
        }
      }
      walk((model.packages as Array<never>) ?? [])
      modelSummary.value = { entityCount, enumCount, packageCount }
      modelVersion.value = typeof model.version === 'string' ? model.version : null
    })

  const loadTemplateSummary = () =>
    templateState.run(async () => {
      const list = await trpc.template.list.query()
      const folders = [...new Set(list.map((t) => t.folder).filter((f): f is string => !!f))]
      templateSummary.value = { templateCount: list.length, folders }
    })

  const loadScan = () =>
    scanState.run(async () => {
      const result = await trpc.project.scan.query()
      const projects: DetectedProjectChip[] = result.projects.map((p) => ({
        path: p.path,
        name: p.name,
        kinds: p.kinds,
        isRoot: p.isRoot ?? false,
      }))
      const rootKinds = projects.find((p) => p.isRoot)?.kinds ?? []
      scan.value = {
        features: result.features.map((f) => ({
          pluginId: f.pluginId,
          name: f.name,
          icon: typeof f.icon === 'string' ? f.icon : undefined,
        })),
        subprojects: result.subprojects.map((s) => ({
          path: s.path,
          name: s.name,
          isRoot: s.isRoot ?? false,
        })),
        projects,
        rootKinds,
        projectKinds: result.projectKinds,
      }
    })

  onMounted(() => {
    void loadMeta()
    void loadContext()
    void loadModelSummary()
    void loadTemplateSummary()
    void loadScan()
  })

  return {
    meta,
    context,
    modelSummary,
    modelVersion,
    templateSummary,
    scan,
    metaLoading: metaState.loading,
    contextLoading: contextState.loading,
    modelLoading: modelState.loading,
    templateLoading: templateState.loading,
    scanLoading: scanState.loading,
    reload: () => {
      void loadMeta()
      void loadContext()
      void loadModelSummary()
      void loadTemplateSummary()
      void loadScan()
    },
  }
}
