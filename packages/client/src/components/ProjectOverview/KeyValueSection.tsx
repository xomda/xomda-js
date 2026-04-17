import type { OverviewSection } from '@xomda/analysis-core'
import { defineComponent, type PropType } from 'vue'

import styles from './ProjectOverview.module.scss'

type KeyValueSection = Extract<OverviewSection, { kind: 'key-value' }>

export const KeyValueSection = defineComponent({
  name: 'KeyValueSection',
  props: {
    section: { type: Object as PropType<KeyValueSection>, required: true },
  },
  setup(props) {
    return () =>
      props.section.rows.length === 0 ? (
        <div class={styles.empty}>No data.</div>
      ) : (
        <dl class={styles.kvTable}>
          {props.section.rows.map((row) => (
            <>
              <dt class={styles.kvKey}>{row.key}</dt>
              <dd class={styles.kvValue}>
                {row.href ? (
                  <a href={row.href} target="_blank" rel="noopener noreferrer">
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </>
          ))}
        </dl>
      )
  },
})
