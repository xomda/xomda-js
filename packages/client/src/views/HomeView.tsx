import { getIconForPlugin } from '@xomda/analysis-client'
import {
  ArrowUpwardIcon,
  EditIcon,
  FolderIcon,
  HistoryIcon,
  HomeIcon,
  ModelIcon,
  TemplatesIcon,
} from '@xomda/icons'
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

import { AppTitleBar, ProjectOverview } from '../components'
import { EditProjectMetaPanel } from './EditProjectMetaPanel'
import { useHomeData } from './HomeView.logic'
import styles from './HomeView.module.scss'

interface SectionProps {
  icon: string
  title: string
  route: string
  color: string
}

const SECTIONS: Record<string, SectionProps> = {
  model: { icon: ModelIcon, title: 'Model', route: '/model', color: 'rgb(var(--v-theme-primary))' },
  templates: {
    icon: TemplatesIcon,
    title: 'Templates',
    route: '/templates',
    color: 'rgb(var(--v-theme-success))',
  },
  files: { icon: FolderIcon, title: 'Files', route: '/files', color: 'rgb(var(--v-theme-info))' },
  versions: {
    icon: HistoryIcon,
    title: 'Versions',
    route: '/versions',
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
    const heroSubtitle = computed(() => {
      if (data.meta.value?.description) return data.meta.value.description
      return data.context.value?.projectRoot ?? ' '
    })

    const editing = ref(false)
    const beginEdit = () => (editing.value = true)
    const cancelEdit = () => (editing.value = false)
    const onSaved = () => {
      editing.value = false
      data.reload()
    }

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
     * Header-area banners. Three independent strips so the user always
     * sees every relevant call to action at once:
     *   - in-subfolder hint (cwd has no .xomda but an ancestor does)
     *   - no-project hint
     *   - parent / sibling .xomda projects above this one (ancestorProjects)
     *   - nested .xomda subprojects discovered by the scan
     *
     * Switching is by re-running xomda from a different directory; we
     * just surface the paths so the user can copy/run them.
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
            <button class={styles.bannerBtn} disabled aria-label="Use that (run xomda from there)">
              Use that
            </button>
            <button class={styles.bannerBtn} disabled aria-label="Create here">
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

    const renderSubprojectBanner = () => {
      const subs = data.scan.value?.subprojects ?? []
      if (subs.length === 0) return null
      return (
        <div class={styles.banner} key="subprojects">
          <span>{subs.length === 1 ? '1 nested project' : `${subs.length} nested projects`}:</span>
          <div class={styles.subprojectChips}>
            {subs.map((s) => (
              <VTooltip
                key={s.path}
                text={`Run xomda from ${s.path} to use it${s.isRoot ? ' (workspace boundary)' : ''}`}
                location="top"
              >
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VChip
                      {...tipProps}
                      size="small"
                      label
                      class={styles.subprojectChip}
                      color={s.isRoot ? 'primary' : undefined}
                    >
                      {s.name}
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
        {renderSubprojectBanner()}
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
                          ? () => <VIcon icon={icon} size={14} class="mr-1" />
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
                          ? () => <VIcon icon={icon} size={14} class="mr-1" />
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
                  prepend: icon ? () => <VIcon icon={icon} size={14} class="mr-1" /> : undefined,
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

    const renderSection = (s: SectionProps, summary: () => unknown) => (
      <VCard
        key={s.route}
        class={styles.sectionCard}
        style={{ '--card-color': s.color }}
        onClick={() => router.push(s.route)}
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
        <VContainer fluid class={styles.container}>
          <div class={styles.hero}>
            {data.metaLoading.value && !data.meta.value ? (
              <h1 class={styles.heroTitle}>
                <VProgressCircular indeterminate size={32} width={3} />
              </h1>
            ) : (
              <VTooltip text="Edit project name" location="top" openDelay={400}>
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <button
                      {...tipProps}
                      type="button"
                      class={styles.heroEditButton}
                      onClick={beginEdit}
                      aria-label="Edit project name"
                    >
                      <h1 class={styles.heroTitle}>{heroTitle.value}</h1>
                      <VIcon icon={EditIcon} size={18} class={styles.heroEditIcon} />
                    </button>
                  ),
                }}
              </VTooltip>
            )}
            <p class={styles.heroSubtitle}>{heroSubtitle.value}</p>
            <div class={styles.heroBrand}>
              <VIcon icon={HomeIcon} size={14} />
              <span>xomda · Abstract Object Modelling</span>
            </div>
          </div>

          {renderBanners()}

          {editing.value && (
            <EditProjectMetaPanel
              initial={{
                name: data.meta.value?.name ?? folderFallback.value ?? '',
                description: data.meta.value?.description,
              }}
              onSaved={onSaved}
              onCancel={cancelEdit}
            />
          )}

          <div class={styles.sections}>
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

          {/*
           * Plugin-contributed overview for the resolved project root.
           * Shown when the cwd is in or below an xomda project; the
           * server's project.overview accepts a relative root which it
           * resolves against the process cwd, so '.' is the right
           * default for the in-process case. Falls back silently when
           * no plugins contribute anything.
           */}
          {data.context.value?.projectRoot ? (
            <div class="mt-6">
              <ProjectOverview path={data.context.value.projectRoot} />
            </div>
          ) : null}
        </VContainer>
      </div>
    )
  },
})
