import { defineComponent, type PropType } from 'vue'
import { VIcon } from 'vuetify/components'

import styles from './MultiIcon.module.scss'

export interface MultiIconEntry {
  /** SVG path or icon name. */
  icon: string
  /** Optional CSS color string. */
  color?: string
  /** Tooltip label for screen readers and hover. */
  label?: string
}

/**
 * Renders a horizontal row of small icons — one per entry. Use when a
 * single item is claimed by multiple "providers" (analysis plugins,
 * tags, …) and you want all their badges visible at once.
 *
 * The component caps the visible icons at `max` (default 4) and shows
 * a "+N" overflow indicator for the rest.
 */
export const MultiIcon = defineComponent({
  name: 'MultiIcon',
  props: {
    icons: { type: Array as PropType<MultiIconEntry[]>, required: true },
    size: { type: Number, default: 14 },
    max: { type: Number, default: 4 },
  },
  setup(props) {
    return () => {
      const visible = props.icons.slice(0, props.max)
      const overflow = props.icons.length - visible.length
      return (
        <span class={styles.row} role="img" aria-label={props.icons.map((i) => i.label).join(', ')}>
          {visible.map((entry, idx) => (
            <VIcon
              key={idx}
              icon={entry.icon}
              size={props.size}
              style={{ color: entry.color ?? undefined }}
              class={styles.icon}
              aria-label={entry.label}
            />
          ))}
          {overflow > 0 && (
            <span class={styles.overflow} style={{ fontSize: `${props.size - 2}px` }}>
              +{overflow}
            </span>
          )}
        </span>
      )
    }
  },
})
