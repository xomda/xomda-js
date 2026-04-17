import { defineComponent, type PropType } from 'vue'
import { VCard, VIcon, VListSubheader, VProgressCircular } from 'vuetify/components'

import styles from './AppSearch.module.scss'
import type { SearchGroup } from './useAppSearch'

export const SearchResultsPanel = defineComponent({
  name: 'SearchResultsPanel',
  props: {
    id: { type: String, default: undefined },
    groups: { type: Array as PropType<SearchGroup[]>, required: true },
    activeIndex: { type: Number, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String as PropType<string | null>, default: null },
    query: { type: String, required: true },
  },
  emits: {
    select: (_index: number) => true,
    hover: (_index: number) => true,
  },
  setup(props, { emit }) {
    return () => {
      const flatLength = props.groups.reduce((n, g) => n + g.hits.length, 0)
      const showEmpty = !props.loading && flatLength === 0 && props.query.trim().length > 0

      let runningIndex = -1
      return (
        <VCard
          class={[styles.panel, 'pa-4']}
          elevation={8}
          rounded="lg"
          {...({ id: props.id, role: 'listbox' } as Record<string, unknown>)}
        >
          {props.error && <div class={[styles.empty, 'text-error']}>{props.error}</div>}
          {props.loading && flatLength === 0 ? (
            <div class={styles.empty}>
              <VProgressCircular indeterminate size={20} />
            </div>
          ) : showEmpty ? (
            <div class={styles.empty}>No results for "{props.query}"</div>
          ) : (
            props.groups.map((group) => (
              <div key={group.providerId} role="group" aria-label={group.label}>
                <VListSubheader>{group.label}</VListSubheader>
                {group.hits.map((hit) => {
                  runningIndex += 1
                  const idx = runningIndex
                  const active = idx === props.activeIndex
                  return (
                    <div
                      key={hit.id}
                      id={`app-search-result-${idx}`}
                      data-result-index={idx}
                      role="option"
                      aria-selected={active}
                      class={[styles.row, active && styles.active]}
                      onMouseenter={() => emit('hover', idx)}
                      onMousedown={(e: MouseEvent) => e.preventDefault()}
                      onClick={() => emit('select', idx)}
                    >
                      <VIcon icon={hit.icon} size={18} class={styles.icon} />
                      <div class={styles.body}>
                        <div class={styles.title}>{hit.title}</div>
                        {hit.subtitle && <div class={styles.subtitle}>{hit.subtitle}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </VCard>
      )
    }
  },
})
