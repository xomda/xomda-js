import { getIconForPlugin } from '@xomda/analysis-client'
import {
  ArrowUpwardIcon,
  EditIcon,
  FolderIcon,
  HistoryIcon,
  ModelIcon,
  TemplatesIcon,
  TreeViewIcon,
} from '@xomda/icons'
import { MenuButton, type MenuItemConfig, PluginIcon, Version } from '@xomda/ui'
import { computed, defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  VCard,
  VChip,
  VContainer,
  VDivider,
  VIcon,
  VProgressCircular,
  VSkeletonLoader,
  VTooltip,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider, ProjectOverview } from '../../components'
import { usePanelResize } from '../../composables'
import { FilesRoutes } from '../files'
import { ModelRoutes } from '../model'
import { TemplatesRoutes } from '../templates'
import { VersionsRoutes } from '../versions'
import { EditProjectMetaPanel } from './EditProjectMetaPanel'
import { useHomeData } from './HomeView.logic'
import styles from './HomeView.module.scss'

interface SectionProps {
  icon: string
  title: string
  routeName: string
  color: string
}

const SECTIONS: Record<string, SectionProps> = {
  projects: {
    icon: TreeViewIcon,
    title: 'Projects',
    routeName: FilesRoutes.browse,
    color: 'rgb(var(--v-theme-secondary))',
  },
  model: {
    icon: ModelIcon,
    title: 'Model',
    routeName: ModelRoutes.view,
    color: 'rgb(var(--v-theme-primary))',
  },
  templates: {
    icon: TemplatesIcon,
    title: 'Templates',
    routeName: TemplatesRoutes.view,
    color: 'rgb(var(--v-theme-success))',
  },
  files: {
    icon: FolderIcon,
    title: 'Files',
    routeName: FilesRoutes.browse,
    color: 'rgb(var(--v-theme-info))',
  },
  versions: {
    icon: HistoryIcon,
    title: 'Versions',
    routeName: VersionsRoutes.view,
    color: 'rgb(var(--v-theme-warning))',
  },
}

export const HomeView = defineComponent({
  name: 'HomeView',
  setup() {
    const router = useRouter()
    const data = useHomeData()

    // When project.json doesn't exist yet, fall back to the folder name —
    // it's what the user already calls the project. Last-resort label is
    // "Untitled project" only when we have no path to base it on at all.
    const folderFallback = computed(() => {
      const path = data.context.value?.projectRoot ?? data.context.value?.suggestions.createHere
      if (!path) return null
      const segments = path.split(/[\\/]/).filter(Boolean)
      return segments.pop() ?? null
    })
    const heroTitle = computed(
      () => data.meta.value?.name ?? folderFallback.value ?? 'Untitled project'
    )

    const editing = ref(false)
    const beginEdit = () => (editing.value = true)
    const cancelEdit = () => (editing.value = false)
    const onSaved = () => {
      editing.value = false
      data.reload()
    }
    // The edit panel shares the home view's horizontal space; let the user
    // resize it via PanelDivider, in the same way as TemplatesView. Clamps
    // keep the panel readable on narrow viewports and the home content
    // from being squeezed to nothing.
    const { width: editPanelWidth, onResize: onResizeEditPanel } = usePanelResize(380, 280, 640)

    const heroMenuItems = computed<MenuItemConfig[]>(() => [
      { key: 'edit-meta', title: 'Edit project name…', icon: EditIcon, onClick: beginEdit },
    ])

    const modelSummaryText = computed(() => {
      const s = data.modelSummary.value
      if (!s) return null
      const parts: string[] = []
      if (s.entityCount) parts.push(`${s.entityCount} entit${s.entityCount === 1 ? 'y' : 'ies'}`)
      if (s.enumCount) parts.push(`${s.enumCount} enum${s.enumCount === 1 ? '' : 's'}`)
      if (s.packageCount) parts.push(`${s.packageCount} package${s.packageCount === 1 ? '' : 's'}`)
      return parts.length > 0 ? parts.join(' · ') : 'Empty model'
    })

    const templateSummaryText = computed(() => {
      const s = data.templateSummary.value
      if (!s) return null
      if (s.templateCount === 0) return 'No templates yet'
      const folderText = s.folders.length > 0 ? ` · ${s.folders.join(', ')}` : ''
      return `${s.templateCount} template${s.templateCount === 1 ? '' : 's'}${folderText}`
    })

    /**
     * Header-area banners. Independent strips so the user always sees
     * every relevant call to action at once:
     *   - in-subfolder hint (cwd has no .xomda but an ancestor does)
     *   - no-project hint
     *   - parent / sibling .xomda projects above this one (ancestorProjects)
     *
     * Nested subprojects are surfaced as a "Projects" section card below
     * (not a banner) so they sit alongside Model / Templates / Files.
     */
    const renderInSubfolderBanner = () => {
      const ctx = data.context.value
      if (ctx?.kind !== 'in-subfolder' || !ctx.suggestions.useFound) return null
      return (
        <div class={styles.banner} key="in-subfolder">
          <span>
            No <code>.xomda</code> here. Found one at <code>{ctx.suggestions.useFound}</code>.
          </span>
          <div class={styles.bannerActions}>
            <button
              class={styles.bannerBtn}
              disabled
              aria-disabled="true"
              title="Not yet wired up — switch directories on the command line for now."
              aria-label="Use that (run xomda from there) — not yet available, switch directories on the command line for now"
            >
              Use that
            </button>
            <button
              class={styles.bannerBtn}
              disabled
              aria-disabled="true"
              title="Not yet wired up — run `xomda init` in this directory for now."
              aria-label="Create here — not yet available, run xomda init in this directory for now"
            >
              Create here
            </button>
          </div>
        </div>
      )
    }

    const renderNoProjectBanner = () => {
      const ctx = data.context.value
      if (ctx?.kind !== 'none') return null
      return (
        <div class={styles.banner} key="none">
          <span>
            No project file yet. Click the project name above to create{' '}
            <code>.xomda/project.json</code>.
          </span>
        </div>
      )
    }

    const renderAncestorBanner = () => {
      const ancestors = data.context.value?.ancestorProjects ?? []
      if (ancestors.length === 0) return null
      return (
        <div class={[styles.banner, styles.bannerAncestors]} key="ancestors">
          <span>{ancestors.length === 1 ? 'Parent project' : 'Parent projects'}:</span>
          <div class={styles.subprojectChips}>
            {ancestors.map((a) => (
              <VTooltip key={a.path} text={`Run xomda from ${a.path} to use it`} location="top">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VChip {...tipProps} size="small" label class={styles.subprojectChip}>
                      {{
                        prepend: () => <VIcon icon={ArrowUpwardIcon} size={12} />,
                        default: () => a.name,
                      }}
                    </VChip>
                  ),
                }}
              </VTooltip>
            ))}
          </div>
        </div>
      )
    }

    const renderBanners = () => (
      <>
        {renderInSubfolderBanner()}
        {renderNoProjectBanner()}
        {renderAncestorBanner()}
      </>
    )

    /**
     * "Projects" row: the host project's kinds (e.g. Node + xomda for
     * the xomda.js repo root) plus a count chip per kind of nested
     * subproject (e.g. "12 Node packages"). Pure technology breakdown —
     * the xomda-specific actionable banner is separate.
     */
    const renderProjects = () => {
      const scan = data.scan.value
      if (!scan && data.scanLoading.value) return <VSkeletonLoader type="chip" />
      if (!scan) return null
      const rootKinds = scan.rootKinds
      const counts = scan.projectKinds
      if (rootKinds.length === 0 && Object.keys(counts).length === 0) {
        return <span class={styles.summaryMuted}>No project detected</span>
      }
      return (
        <div class={styles.chipRow}>
          {rootKinds.map((id) => {
            const icon = getIconForPlugin(id)
            return (
              <VTooltip key={`root-${id}`} text={`This project is a ${id} project`} location="top">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VChip
                      {...tipProps}
                      size="small"
                      label
                      color="primary"
                      class={styles.projectChip}
                    >
                      {{
                        prepend: icon
                          ? () => (
                              <span class="d-inline-flex align-center mr-1">
                                <PluginIcon icon={icon} size={14} label={id} />
                              </span>
                            )
                          : undefined,
                        default: () => id,
                      }}
                    </VChip>
                  ),
                }}
              </VTooltip>
            )
          })}
          {Object.entries(counts).map(([id, count]) => {
            const icon = getIconForPlugin(id)
            const label = `${count} ${id}`
            const tooltip =
              count === 1 ? `1 nested ${id} project` : `${count} nested ${id} projects`
            return (
              <VTooltip key={`nested-${id}`} text={tooltip} location="top">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VChip {...tipProps} size="small" label class={styles.projectChip}>
                      {{
                        prepend: icon
                          ? () => (
                              <span class="d-inline-flex align-center mr-1">
                                <PluginIcon icon={icon} size={14} label={id} />
                              </span>
                            )
                          : undefined,
                        default: () => label,
                      }}
                    </VChip>
                  ),
                }}
              </VTooltip>
            )
          })}
        </div>
      )
    }

    /**
     * "Technologies" row: feature chips (Vite, Webpack, ESLint, …).
     * Excludes plugin ids that are *also* project kinds so Node / Maven
     * / Gradle only appear in the Projects row above.
     */
    const renderTechnologies = () => {
      const scan = data.scan.value
      if (!scan && data.scanLoading.value) return <VSkeletonLoader type="chip" />
      const projectKindIds = new Set([
        ...(scan?.rootKinds ?? []),
        ...Object.keys(scan?.projectKinds ?? {}),
      ])
      const features = (scan?.features ?? []).filter((f) => !projectKindIds.has(f.pluginId))
      if (features.length === 0) {
        return <span class={styles.summaryMuted}>No technologies detected</span>
      }
      return (
        <div class={styles.chipRow}>
          {features.map((f) => {
            const icon = getIconForPlugin(f.pluginId)
            return (
              <VChip key={f.pluginId} size="small" label class={styles.techChip}>
                {{
                  prepend: icon
                    ? () => (
                        <span class="d-inline-flex align-center mr-1">
                          <PluginIcon icon={icon} size={14} label={f.name} />
                        </span>
                      )
                    : undefined,
                  default: () => f.name,
                }}
              </VChip>
            )
          })}
        </div>
      )
    }

    const renderFilesSummary = () => (
      <div class={styles.filesSummaryStack}>
        <div class={styles.filesSummaryRow}>
          <span class={styles.filesSummaryLabel}>Projects</span>
          {renderProjects()}
        </div>
        <div class={styles.filesSummaryRow}>
          <span class={styles.filesSummaryLabel}>Technologies</span>
          {renderTechnologies()}
        </div>
      </div>
    )

    /**
     * Whether to surface a dedicated "Projects" section card above
     * Model. We show it when the scan found more than one project
     * (either the root has nested subprojects, or the cwd is a parent
     * of several detected projects without itself being one).
     */
    const hasMultipleProjects = computed(() => (data.scan.value?.projects.length ?? 0) > 1)

    const renderProjectsSectionSummary = () => {
      const scan = data.scan.value
      if (!scan && data.scanLoading.value) return <VSkeletonLoader type="chip" />
      const projects = scan?.projects ?? []
      if (projects.length === 0) {
        return <span class={styles.summaryMuted}>No projects detected</span>
      }
      // Project-kind chips: one per detected project (root first), each
      // showing the project's name and a plugin icon. Capped so a
      // sprawling monorepo doesn't overflow the card; the user can hit
      // the section to drill into the full file browser.
      const sorted = [...projects].sort((a, b) => {
        if (a.isRoot && !b.isRoot) return -1
        if (!a.isRoot && b.isRoot) return 1
        return a.path.localeCompare(b.path)
      })
      const MAX = 12
      const visible = sorted.slice(0, MAX)
      const remaining = sorted.length - visible.length
      return (
        <div class={styles.chipRow}>
          {visible.map((p) => {
            const primaryKind = p.kinds[0]
            const icon = primaryKind ? getIconForPlugin(primaryKind) : undefined
            const tooltip = `${p.kinds.join(' · ')} · ${p.path === '.' ? 'project root' : p.path}`
            return (
              <VTooltip key={p.path} text={tooltip} location="top">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VChip
                      {...tipProps}
                      size="small"
                      label
                      class={styles.projectChip}
                      color={p.isRoot ? 'primary' : undefined}
                    >
                      {{
                        prepend: icon
                          ? () => (
                              <span class="d-inline-flex align-center mr-1">
                                <PluginIcon icon={icon} size={14} label={p.name} />
                              </span>
                            )
                          : undefined,
                        default: () => p.name,
                      }}
                    </VChip>
                  ),
                }}
              </VTooltip>
            )
          })}
          {remaining > 0 ? (
            <VChip size="small" label class={styles.projectChip}>
              +{remaining} more
            </VChip>
          ) : null}
        </div>
      )
    }

    const renderSection = (s: SectionProps, summary: () => unknown) => (
      <VCard
        key={s.routeName}
        class={styles.sectionCard}
        style={{ '--card-color': s.color }}
        onClick={() => router.push({ name: s.routeName })}
        elevation={0}
        rounded="lg"
      >
        <div class={styles.sectionHeader}>
          <VIcon icon={s.icon} size={28} class={styles.sectionIcon} />
          <span class={styles.sectionTitle}>{s.title}</span>
        </div>
        <div class={styles.sectionSummary}>{summary()}</div>
      </VCard>
    )

    return () => (
      <div class={styles.main}>
        <AppTitleBar transparent />
        <div class={styles.body}>
          <VContainer fluid class={styles.container}>
            <div class={styles.hero}>
              <div class={styles.heroLeft}>
                {data.metaLoading.value && !data.meta.value ? (
                  <h1 class={styles.heroTitle}>
                    <VProgressCircular indeterminate size={32} width={3} />
                  </h1>
                ) : (
                  <h1 class={styles.heroTitle}>{heroTitle.value}</h1>
                )}
              </div>
              <div class={[styles.heroSeparator]}>
                <MenuButton
                  tooltip="Project actions"
                  ariaLabel="Project actions"
                  items={heroMenuItems.value}
                  size="x-small"
                  density="compact"
                  class={[styles.heroMenuButton, 'rounded']}
                />
                <VDivider
                  vertical
                  class={['opacity-50', styles.heroDivider]}
                  style={{ marginLeft: '.1px' }}
                />
              </div>
              <div class={styles.heroRight}>
                {data.meta.value?.description && (
                  <p class={styles.heroDescription}>{data.meta.value.description}</p>
                )}
                {data.context.value?.projectRoot && (
                  <p class={styles.heroPath}>
                    <VIcon icon={FolderIcon} size={14} class="me-1" />
                    {data.context.value.projectRoot}
                  </p>
                )}
                {data.modelVersion.value && (
                  <div class={styles.heroVersion}>
                    <span class="text-medium-emphasis">Model</span>
                    <Version
                      version={data.modelVersion.value}
                      prefix="v"
                      chip
                      size="x-small"
                      to="/versions"
                    />
                  </div>
                )}
              </div>
            </div>

            {renderBanners()}

            {/*
             * Two-column layout: 4 section cards on the left, plugin-
             * contributed overview on the right. When the cwd is not
             * inside an xomda project we have nothing to put on the right
             * and the grid collapses to one filled column. On narrow
             * viewports the overview drops below the cards (see SCSS).
             */}
            <div class={styles.mainGrid}>
              <div class={styles.sections}>
                {hasMultipleProjects.value && (
                  <>
                    {renderSection(SECTIONS.projects, renderProjectsSectionSummary)}
                    <VDivider />
                  </>
                )}
                {renderSection(
                  SECTIONS.model,
                  () => modelSummaryText.value ?? <VSkeletonLoader type="text" />
                )}
                <VDivider />
                {renderSection(
                  SECTIONS.templates,
                  () => templateSummaryText.value ?? <VSkeletonLoader type="text" />
                )}
                <VDivider />
                {renderSection(SECTIONS.files, renderFilesSummary)}
                <VDivider />
                {renderSection(SECTIONS.versions, () => (
                  <span class={styles.summaryMuted}>Browse history & snapshots</span>
                ))}
              </div>
              {data.context.value?.projectRoot ? (
                <div class={styles.overviewColumn}>
                  <ProjectOverview path={data.context.value.projectRoot} />
                </div>
              ) : null}
            </div>
          </VContainer>
          {editing.value && (
            <>
              <PanelDivider onResize={onResizeEditPanel} />
              <div class={styles.editPanelHost} style={{ width: `${editPanelWidth.value}px` }}>
                <EditProjectMetaPanel
                  initial={{
                    name: data.meta.value?.name ?? folderFallback.value ?? '',
                    description: data.meta.value?.description,
                  }}
                  onSaved={onSaved}
                  onCancel={cancelEdit}
                />
              </div>
            </>
          )}
        </div>
      </div>
    )
  },
})
