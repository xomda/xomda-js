import { getIconForPlugin } from '@xomda/analysis-client'
import type { OverviewContribution, OverviewSection } from '@xomda/analysis-core'
import { PluginIcon } from '@xomda/ui'
import { useAsyncState } from '@xomda/ui'
import { computed, defineComponent, onMounted, type PropType, ref, watch } from 'vue'
import { VCard, VDivider, VProgressCircular, VTab, VTabs } from 'vuetify/components'

import { trpc } from '../../trpc'
import { CustomSection } from './CustomSection'
import { KeyValueSection } from './KeyValueSection'
import { ListSection } from './ListSection'
import styles from './ProjectOverview.module.scss'
import { StatusSection } from './StatusSection'
import { TableSection } from './TableSection'

function renderSection(section: OverviewSection) {
  switch (section.kind) {
    case 'key-value':
      return <KeyValueSection section={section} />
    case 'table':
      return <TableSection section={section} />
    case 'list':
      return <ListSection section={section} />
    case 'status':
      return <StatusSection section={section} />
    case 'custom':
      return <CustomSection section={section} />
  }
}

/**
 * Renders every plugin-contributed overview section for a project root.
 *
 * Two modes:
 *  - Driven mode: pass `contributions` directly. Used by stories, tests,
 *    and the FileBrowserView's stubbed-payload phase.
 *  - Fetch mode: pass `path` (the project root). The component queries
 *    `trpc.project.overview` and renders the result.
 *
 * `xomdaRoot` is the outer xomda project that owns the `plugins`
 * allow-list (defaults to '.' — the server's cwd).
 */
export const ProjectOverview = defineComponent({
  name: 'ProjectOverview',
  props: {
    path: { type: String, default: undefined },
    xomdaRoot: { type: String, default: '.' },
    contributions: { type: Array as PropType<OverviewContribution[]>, default: undefined },
  },
  setup(props) {
    const fetched = ref<OverviewContribution[]>([])
    const { loading, run } = useAsyncState<OverviewContribution[]>()
    const activeTab = ref<string | null>(null)

    const load = async () => {
      if (!props.path) return
      await run(async () => {
        const r = await trpc.project.overview.query({
          root: props.path!,
          xomdaRoot: props.xomdaRoot,
        })
        fetched.value = r.contributions
        return r.contributions
      })
    }

    onMounted(() => {
      if (!props.contributions) void load()
    })
    watch(
      () => props.path,
      () => {
        if (!props.contributions) void load()
      }
    )

    const contributionsList = computed<OverviewContribution[]>(
      () => props.contributions ?? fetched.value
    )

    // Keep `activeTab` in sync with the contributions list: pick the first
    // contribution by default, and reset if the previously active one is
    // no longer present (e.g. after a re-fetch produced a new set).
    watch(
      contributionsList,
      (list) => {
        if (list.length === 0) {
          activeTab.value = null
          return
        }
        if (!activeTab.value || !list.some((c) => c.pluginId === activeTab.value)) {
          activeTab.value = list[0].pluginId
        }
      },
      { immediate: true }
    )

    // The plugin's client-side registration is the authoritative icon
    // (one of `@xomda/icons`' two shapes — an SVG path string or full
    // `<svg>…</svg>` markup, both handled by `PluginIcon`). Fall back to
    // the server-contributed value verbatim only when there's nothing
    // registered.
    const resolvePluginIcon = (
      contributedIcon: string | undefined,
      pluginId: string
    ): string | undefined => getIconForPlugin(pluginId) ?? contributedIcon

    const renderContribution = (c: OverviewContribution) => {
      const icon = resolvePluginIcon(c.icon, c.pluginId)
      return (
        <div class={styles.contribution} key={c.pluginId}>
          <div class={styles.contributionHeader}>
            {icon ? <PluginIcon icon={icon} size={18} label={c.pluginName} /> : null}
            <span>{c.pluginName}</span>
          </div>
          <VCard elevation={1} rounded="lg">
            {c.sections.map((section, i) => (
              <div key={section.id}>
                {i > 0 ? <VDivider /> : null}
                <div class={styles.section}>
                  <div class={styles.sectionTitle}>
                    {section.icon ? (
                      <PluginIcon icon={section.icon} size={16} label={section.title} />
                    ) : null}
                    {section.title}
                  </div>
                  {renderSection(section)}
                </div>
              </div>
            ))}
          </VCard>
        </div>
      )
    }

    return () => {
      const contributions = contributionsList.value

      if (loading.value) {
        return (
          <div class={styles.empty}>
            <VProgressCircular indeterminate size={20} />
          </div>
        )
      }

      if (contributions.length === 0) {
        return <div class={styles.empty}>No plugin overview available for this folder.</div>
      }

      // One tab per contributing plugin ("one tab per project"). With a
      // single contribution the tab bar is redundant, so skip it and just
      // render the card.
      if (contributions.length === 1) {
        return <div class={styles.root}>{renderContribution(contributions[0])}</div>
      }

      const active = contributions.find((c) => c.pluginId === activeTab.value) ?? contributions[0]

      return (
        <div class={styles.root}>
          <VTabs
            modelValue={activeTab.value}
            onUpdate:modelValue={(v: unknown) => (activeTab.value = (v as string | null) ?? null)}
            density="compact"
            color="primary"
            sliderColor="primary"
            class={styles.tabs}
          >
            {contributions.map((c) => {
              const icon = resolvePluginIcon(c.icon, c.pluginId)
              return (
                <VTab key={c.pluginId} value={c.pluginId}>
                  {{
                    prepend: icon
                      ? () => <PluginIcon icon={icon} size={16} label={c.pluginName} />
                      : undefined,
                    default: () => c.pluginName,
                  }}
                </VTab>
              )
            })}
          </VTabs>
          {renderContribution(active)}
        </div>
      )
    }
  },
})
