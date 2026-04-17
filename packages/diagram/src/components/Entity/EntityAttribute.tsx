import type { PropType } from 'vue'
import { defineComponent } from 'vue'

import type { Attribute } from '../../types'
import styles from './EntityAttribute.module.scss'

export const EntityAttribute = defineComponent({
  name: 'XEntityAttribute',
  props: {
    attribute: {
      type: Object as PropType<Attribute>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    inherited: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    click: () => true,
  },
  setup(props, { emit }) {
    return () => {
      const { attribute: attr, selected, inherited } = props
      return (
        <div
          class={[styles.attribute, selected && styles.selected, inherited && styles.inherited]}
          title={inherited ? `${attr.description ?? ''} (inherited)`.trim() : attr.description}
          onClick={(e) => {
            e.stopPropagation()
            emit('click')
          }}
        >
          <span class={styles.badges}>
            {inherited && <span class={[styles.badge, styles.badgeInh]}>INH</span>}
            {!inherited && attr.primaryKey && (
              <span class={[styles.badge, styles.badgePk]}>PK</span>
            )}
            {!inherited && attr.unique && !attr.primaryKey && (
              <span class={[styles.badge, styles.badgeUq]}>UQ</span>
            )}
          </span>
          <span class={styles.name}>{attr.name}</span>
          {attr.required && <span class={styles.required}>*</span>}
          {/* UML aggregation marker: filled diamond ◆ for composite (parent
              owns the related instances), open diamond ◇ for plain
              association. Rendered only when the attribute carries an
              aggregation kind — i.e. when it points at an Entity. */}
          {attr.aggregation === 'composite' && (
            <span
              class={[styles.aggregation, styles.aggregationComposite]}
              title="composite (one-to-many or one-to-one)"
              aria-label="composite aggregation"
            >
              ◆
            </span>
          )}
          {attr.aggregation === 'none' && (
            <span
              class={[styles.aggregation, styles.aggregationNone]}
              title="association (many-to-many or many-to-one)"
              aria-label="association"
            >
              ◇
            </span>
          )}
          <span class={[styles.type, attr.multiValue && styles.multiValue]}>{attr.type}</span>
        </div>
      )
    }
  },
})
