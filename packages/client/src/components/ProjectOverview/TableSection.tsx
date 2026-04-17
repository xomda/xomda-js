import type { OverviewSection } from '@xomda/analysis-core'
import { defineComponent, type PropType } from 'vue'
import { VTable } from 'vuetify/components'

import styles from './ProjectOverview.module.scss'

type TableSection = Extract<OverviewSection, { kind: 'table' }>

export const TableSection = defineComponent({
  name: 'TableSection',
  props: {
    section: { type: Object as PropType<TableSection>, required: true },
  },
  setup(props) {
    return () =>
      props.section.rows.length === 0 ? (
        <div class={styles.empty}>No entries.</div>
      ) : (
        <div class={styles.tableScroll}>
          <VTable density="compact" hover>
            {{
              default: () => (
                <>
                  <thead>
                    <tr>
                      {props.section.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {props.section.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </>
              ),
            }}
          </VTable>
        </div>
      )
  },
})
