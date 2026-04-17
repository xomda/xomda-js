import { CloseIcon, SaveIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'
import { VBtn, VTooltip } from 'vuetify/components'

import styles from './LayoutSavePill.module.scss'

/**
 * Floating top-center pill with Save / Cancel for pending diagram layout
 * changes. Shows only when `dirty` is true. No title — the icons carry
 * the affordance and tooltips spell out the action on hover.
 */
export const LayoutSavePill = defineComponent({
  name: 'LayoutSavePill',
  props: {
    dirty: { type: Boolean, default: false },
    onSave: { type: Function as PropType<() => void>, default: undefined },
    onCancel: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    return () => {
      if (!props.dirty) return null
      return (
        <div class={styles.pill} role="region" aria-label="Pending layout changes">
          <VTooltip text="Save layout" location="bottom">
            {{
              activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                <VBtn
                  {...tipProps}
                  icon={SaveIcon}
                  variant="tonal"
                  color="primary"
                  size="small"
                  density="comfortable"
                  aria-label="Save layout"
                  onClick={() => props.onSave?.()}
                />
              ),
            }}
          </VTooltip>
          <VTooltip text="Cancel layout changes" location="bottom">
            {{
              activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                <VBtn
                  {...tipProps}
                  icon={CloseIcon}
                  variant="text"
                  size="small"
                  density="comfortable"
                  aria-label="Cancel layout changes"
                  onClick={() => props.onCancel?.()}
                />
              ),
            }}
          </VTooltip>
        </div>
      )
    }
  },
})
