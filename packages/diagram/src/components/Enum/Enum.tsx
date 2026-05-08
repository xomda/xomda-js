import { AddIcon, EnumIcon } from '@xomda/icons'
import { defineComponent, inject, type PropType, ref } from 'vue'

import { snap, useDragSort } from '../../composables'
import type { EnumData, LayoutEntry } from '../../types'
import { DiagramIcon } from '../DiagramIcon'
import { CONTAINER_KEY } from '../Package/containerKey'
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
    layout: {
      type: Object as PropType<LayoutEntry>,
      default: () => ({ x: 0, y: 0 }),
    },
    absolute: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['add-value', 'edit-value', 'edit-enum', 'reorder-values', 'move-to-package', 'move'],
  setup(props, { emit }) {
    const { draggingId, dragOverId, onItemDragStart, onItemDragEnd, onItemDragOver, onItemDragLeave, onItemDrop } =
      useDragSort()

    const containerEl = inject(CONTAINER_KEY, ref(null))

    // ── Pointer drag for repositioning ────────────────────────────────────────
    const dragging = ref(false)
    const dragOffset = ref({ x: 0, y: 0 })

    function onHeaderPointerDown(e: PointerEvent) {
      if (!props.absolute || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      dragging.value = true
      const rect = containerEl.value?.getBoundingClientRect()
      const originX = rect?.left ?? 0
      const originY = rect?.top ?? 0
      dragOffset.value = { x: e.clientX - originX - props.layout.x, y: e.clientY - originY - props.layout.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    function onHeaderPointerMove(e: PointerEvent) {
      if (!dragging.value) return
      const rect = containerEl.value?.getBoundingClientRect()
      const originX = rect?.left ?? 0
      const originY = rect?.top ?? 0
      emit('move', props.enum.id, snap(Math.max(0, e.clientX - originX - dragOffset.value.x)), snap(Math.max(0, e.clientY - originY - dragOffset.value.y)))
    }

    function onHeaderPointerUp(e: PointerEvent) {
      if (!dragging.value) return
      dragging.value = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    const onEnumDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'application/x-xomda-diagram',
          JSON.stringify({ type: 'enum', id: props.enum.id })
        )
      }
    }

    return () => {
      const positionStyle = props.absolute
        ? { position: 'absolute' as const, left: `${props.layout.x}px`, top: `${props.layout.y}px` }
        : {}

      return (
        <div
          class={[styles.enum, props.selected && styles.selected, dragging.value && styles.enumDragging]}
          style={positionStyle}
        >
          <div
            class={[styles.header, props.absolute && styles.headerDraggable]}
            draggable={!props.absolute}
            onDragstart={!props.absolute ? onEnumDragStart : undefined}
            onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
            onPointermove={props.absolute ? onHeaderPointerMove : undefined}
            onPointerup={props.absolute ? onHeaderPointerUp : undefined}
            onClick={(e) => {
              if (dragging.value) return
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
    }
  },
})
