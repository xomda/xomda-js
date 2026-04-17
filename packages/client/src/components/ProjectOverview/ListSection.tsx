import type { OverviewSection } from '@xomda/analysis-core'
import { defineComponent, type PropType } from 'vue'
import { VIcon, VList, VListItem, VListItemSubtitle, VListItemTitle } from 'vuetify/components'

import styles from './ProjectOverview.module.scss'

type ListSection = Extract<OverviewSection, { kind: 'list' }>

export const ListSection = defineComponent({
  name: 'ListSection',
  props: {
    section: { type: Object as PropType<ListSection>, required: true },
  },
  setup(props) {
    return () =>
      props.section.items.length === 0 ? (
        <div class={styles.empty}>No items.</div>
      ) : (
        <VList density="compact" lines="one">
          {props.section.items.map((item, i) => (
            <VListItem key={i}>
              {{
                prepend: item.icon ? () => <VIcon icon={item.icon} size={18} /> : undefined,
                default: () => (
                  <>
                    <VListItemTitle>{item.label}</VListItemTitle>
                    {item.sub ? <VListItemSubtitle>{item.sub}</VListItemSubtitle> : null}
                  </>
                ),
              }}
            </VListItem>
          ))}
        </VList>
      )
  },
})
