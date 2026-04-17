import { getPreviewComponent } from '@xomda/analysis-client'
import type { OverviewSection } from '@xomda/analysis-core'
import { defineComponent, h, type PropType } from 'vue'

import styles from './ProjectOverview.module.scss'

type CustomSection = Extract<OverviewSection, { kind: 'custom' }>

/**
 * Renders a plugin-contributed custom section. The plugin's client half
 * must register the component under its `componentId` in `previewComponents`
 * (same registry used for custom file preview tabs). When the id can't be
 * resolved, we fall back to a small "not registered" hint so missing
 * client wiring is visible during development.
 */
export const CustomSection = defineComponent({
  name: 'CustomSection',
  props: {
    section: { type: Object as PropType<CustomSection>, required: true },
  },
  setup(props) {
    return () => {
      const Component = getPreviewComponent(props.section.componentId)
      if (!Component) {
        return (
          <div class={styles.empty}>No component registered for "{props.section.componentId}".</div>
        )
      }
      return h(Component, { data: props.section.data })
    }
  },
})
