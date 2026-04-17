import { AddIcon, EntityIcon } from '@xomda/icons'
import { defineComponent, type PropType, type SlotsType, type VNode } from 'vue'

import { useDragSort } from '../../composables'
import type { Attribute, EntityData } from '../../types'
import { DiagramIcon } from '../DiagramIcon'
import styles from './Entity.module.scss'
import { EntityAttribute } from './EntityAttribute'

export const Entity = defineComponent({
  name: 'XEntity',
  props: {
    entity: {
      type: Object as PropType<EntityData>,
      required: true,
    },
    inheritedAttributes: {
      type: Array as PropType<Attribute[]>,
      default: () => [],
    },
    showAddButton: {
      type: Boolean,
      default: false,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    selectedAttributeId: {
      type: String,
      default: null,
    },
  },
  emits: [
    'add-attribute',
    'edit-attribute',
    'edit-entity',
    'reorder-attributes',
    'move-to-package',
  ],
  slots: Object as SlotsType<{
    /** Injected at the start of the header row, before the entity name. */
    'header-prefix': () => VNode[]
    /** Injected at the end of the header row, after the entity name. */
    'header-suffix': () => VNode[]
    /** Injected between the header and the attribute list. */
    'header-after': () => VNode[]
    /** Injected before the first attribute row. */
    'attrs-before': () => VNode[]
    /** Injected after the last attribute row. */
    'attrs-after': () => VNode[]
    /** Injected at the leading edge of each attribute row. */
    'attribute-prefix': (props: { attribute: Attribute; index: number }) => VNode[]
    /** Injected at the trailing edge of each attribute row. */
    'attribute-suffix': (props: { attribute: Attribute; index: number }) => VNode[]
    /** Injected at the bottom of the entity, below all attributes. */
    footer: () => VNode[]
  }>,
  setup(props, { slots, emit }) {
    const { draggingId, dragOverId, onItemDragStart, onItemDragEnd, onItemDragOver, onItemDragLeave, onItemDrop } =
      useDragSort()

    const onEntityDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'application/x-xomda-diagram',
          JSON.stringify({ type: 'entity', id: props.entity.id })
        )
      }
    }

    return () => (
      <div class={[styles.entity, props.selected && styles.selected]}>
        <div
          class={styles.header}
          draggable={true}
          onDragstart={onEntityDragStart}
          onClick={(e) => {
            e.stopPropagation()
            emit('edit-entity', props.entity)
          }}
        >
          {slots['header-prefix']?.()}
          <DiagramIcon icon={EntityIcon} />
          <span class={styles.entityName}>{props.entity.name}</span>
          {slots['header-suffix']?.()}
          {props.showAddButton && (
            <button
              class={styles.addButton}
              onClick={(e) => {
                e.stopPropagation()
                emit('add-attribute', props.entity)
              }}
              title="Add attribute"
            >
              <DiagramIcon icon={AddIcon} size="20" />
            </button>
          )}
        </div>

        {slots['header-after']?.()}

        <div class={styles.attributes}>
          {slots['attrs-before']?.()}
          {props.inheritedAttributes.map((attribute) => (
            <div key={`inh-${attribute.id}`} class={styles.attributeRow}>
              <EntityAttribute
                attribute={attribute}
                selected={props.selectedAttributeId === attribute.id}
                inherited={true}
                onClick={() => emit('edit-attribute', props.entity, attribute)}
              />
            </div>
          ))}
          {props.entity.attributes.map((attribute, index) => (
            <div
              key={attribute.id}
              class={[
                styles.attributeRow,
                draggingId.value === attribute.id && styles.dragging,
                dragOverId.value === attribute.id && styles.dragOver,
              ]}
              draggable={true}
              onDragstart={(e) => onItemDragStart(e, attribute)}
              onDragend={onItemDragEnd}
              onDragover={(e) => onItemDragOver(e, attribute)}
              onDragleave={onItemDragLeave}
              onDrop={(e) => {
                const ids = onItemDrop(e, attribute, props.entity.attributes)
                if (ids) emit('reorder-attributes', props.entity, ids)
              }}
            >
              {slots['attribute-prefix']?.({ attribute, index })}
              <EntityAttribute
                attribute={attribute}
                selected={props.selectedAttributeId === attribute.id}
                onClick={() => emit('edit-attribute', props.entity, attribute)}
              />
              {slots['attribute-suffix']?.({ attribute, index })}
            </div>
          ))}
          {slots['attrs-after']?.()}
        </div>

        {slots.footer?.()}
      </div>
    )
  },
})
