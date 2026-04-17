import { AddIcon, EnumIcon } from '@xomda/icons'
import { defineComponent, type PropType } from 'vue'

import { useDragSort } from '../../composables'
import type { EnumData } from '../../types'
import { DiagramIcon } from '../DiagramIcon'
import styles from './Enum.module.scss'

export const Enum = defineComponent({
  name: 'XEnum',
  props: {
    enum: {
      type: Object as PropType<EnumData>,
      required: true,
    },
    showAddButton: {
      type: Boolean,
      default: false,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    selectedValueId: {
      type: String,
      default: null,
    },
  },
  emits: ['add-value', 'edit-value', 'edit-enum', 'reorder-values', 'move-to-package'],
  setup(props, { emit }) {
    const { draggingId, dragOverId, onItemDragStart, onItemDragEnd, onItemDragOver, onItemDragLeave, onItemDrop } =
      useDragSort()

    const onEnumDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'application/x-xomda-diagram',
          JSON.stringify({ type: 'enum', id: props.enum.id })
        )
      }
    }

    return () => (
      <div class={[styles.enum, props.selected && styles.selected]}>
        <div
          class={styles.header}
          draggable={true}
          onDragstart={onEnumDragStart}
          onClick={(e) => {
            e.stopPropagation()
            emit('edit-enum', props.enum)
          }}
        >
          <DiagramIcon icon={EnumIcon} />
          <span class={styles.enumName}>{props.enum.name}</span>
          {props.showAddButton && (
            <button
              class={styles.addButton}
              onClick={(e) => {
                e.stopPropagation()
                emit('add-value', props.enum)
              }}
              title="Add value"
            >
              <DiagramIcon icon={AddIcon} size="20" />
            </button>
          )}
        </div>

        <div class={styles.values}>
          {props.enum.values.map((value) => (
            <div
              key={value.id}
              class={[
                styles.valueRow,
                props.selectedValueId === value.id && styles.selectedValue,
                draggingId.value === value.id && styles.dragging,
                dragOverId.value === value.id && styles.dragOver,
              ]}
              draggable={true}
              onDragstart={(e) => onItemDragStart(e, value)}
              onDragend={onItemDragEnd}
              onDragover={(e) => onItemDragOver(e, value)}
              onDragleave={onItemDragLeave}
              onDrop={(e) => {
                const ids = onItemDrop(e, value, props.enum.values)
                if (ids) emit('reorder-values', props.enum, ids)
              }}
              onClick={(e) => {
                e.stopPropagation()
                emit('edit-value', props.enum, value)
              }}
            >
              {value.name}
            </div>
          ))}
        </div>
      </div>
    )
  },
})
