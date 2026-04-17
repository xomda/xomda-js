import { CloseIcon } from '@xomda/icons'
import { computed, defineComponent, type PropType } from 'vue'
import { VBtn, VCard, VIcon, VTooltip } from 'vuetify/components'

import styles from './SidePanel.module.scss'

export const SidePanel = defineComponent({
  name: 'SidePanel',
  props: {
    title: { type: String, required: true },
    icon: { type: String as PropType<string>, default: undefined },
    width: { type: Number as PropType<number>, default: undefined },
    elevation: { type: Number, default: 2 },
    rounded: { type: String, default: 'lg' },
    /** Padding inside the body. Pass `false` (or `0`) for no padding; default is `16px`. */
    contentPadding: { type: [String, Number, Boolean], default: undefined },
    closeTooltip: { type: String, default: 'Close' },
    /** When provided, a close button is rendered in the header. */
    onClose: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props, { slots }) {
    const contentStyle = computed<{ padding: string } | undefined>(() => {
      const p = props.contentPadding
      if (p === false || p === '0' || p === 0) return { padding: '0' }
      if (p == null) return undefined
      if (typeof p === 'boolean') return undefined
      return { padding: typeof p === 'number' ? `${p}px` : p }
    })

    return () => (
      <VCard
        class={styles.panel}
        style={props.width != null ? { width: `${props.width}px` } : undefined}
        elevation={props.elevation}
        rounded={props.rounded}
      >
        <div class={styles.header}>
          {props.icon && <VIcon icon={props.icon} size={16} />}
          <div class={styles.title}>{props.title}</div>
          {slots.headerActions?.()}
          {props.onClose && (
            <VTooltip text={props.closeTooltip} location="bottom">
              {{
                activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                  <VBtn
                    {...tipProps}
                    icon={CloseIcon}
                    variant="text"
                    size="small"
                    density="comfortable"
                    aria-label={props.closeTooltip}
                    onClick={() => props.onClose?.()}
                  />
                ),
              }}
            </VTooltip>
          )}
        </div>
        <div class={styles.content} style={contentStyle.value}>
          {slots.default?.()}
        </div>
        {slots.footer && <div class={styles.footer}>{slots.footer()}</div>}
      </VCard>
    )
  },
})
