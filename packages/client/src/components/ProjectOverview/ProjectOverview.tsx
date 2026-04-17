import { getIconForPlugin } from '@xomda/analysis-client'
import type { OverviewContribution, OverviewSection } from '@xomda/analysis-core'
import { useAsyncState } from '@xomda/ui'
import { defineComponent, onMounted, type PropType, ref, watch } from 'vue'
import { VCard, VDivider, VIcon, VProgressCircular } from 'vuetify/components'

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

    return () => {
      const contributions = props.contributions ?? fetched.value

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

      return (
        <div class={styles.root}>
          {contributions.map((c) => {
            const icon = c.icon ?? getIconForPlugin(c.pluginId)
            return (
              <div class={styles.contribution} key={c.pluginId}>
                <div class={styles.contributionHeader}>
                  {icon ? <VIcon icon={icon} size={18} /> : null}
                  <span>{c.pluginName}</span>
                </div>
                <VCard elevation={1} rounded="lg">
                  {c.sections.map((section, i) => (
                    <div key={section.id}>
                      {i > 0 ? <VDivider /> : null}
                      <div class={styles.section}>
                        <div class={styles.sectionTitle}>
                          {section.icon ? <VIcon icon={section.icon} size={16} /> : null}
                          {section.title}
                        </div>
                        {renderSection(section)}
                      </div>
                    </div>
                  ))}
                </VCard>
              </div>
            )
          })}
        </div>
      )
    }
  },
})
