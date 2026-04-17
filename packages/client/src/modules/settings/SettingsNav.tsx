import { defineComponent, type PropType } from 'vue'
import type { JSXComponent } from 'vuetify'
import { VIcon } from 'vuetify/components'

import styles from './SettingsNav.module.scss'

export interface SettingsNavItem {
  /** Stable id used as the URL hash and as the section anchor suffix. */
  id: string
  label: string
  icon: string | JSXComponent
}

/**
 * Left-rail navigation for the Preferences view. Each entry corresponds
 * to a section card on the right; clicking jumps to it and updates
 * `route.hash`. The IntelliJ / VS Code preference dialogs use the same
 * shape.
 */
export const SettingsNav = defineComponent({
  name: 'SettingsNav',
  props: {
    items: { type: Array as PropType<SettingsNavItem[]>, required: true },
    activeId: { type: String, required: true },
    onSelect: { type: Function as PropType<(id: string) => void>, required: true },
  },
  setup(props) {
    return () => (
      <nav class={styles.nav} aria-label="Preferences sections">
        <div class={styles.list} role="tablist" aria-orientation="vertical">
          {props.items.map((item) => {
            const active = item.id === props.activeId
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`settings-section-${item.id}`}
                class={[styles.item, active && styles.itemActive]}
                onClick={() => props.onSelect(item.id)}
              >
                <VIcon icon={item.icon} size={18} />
                <span class={styles.label}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    )
  },
})
