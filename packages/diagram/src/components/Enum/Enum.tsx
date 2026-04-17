import { AddIcon, EnumIcon } from '@xomda/icons'
import { defineComponent, type PropType, ref } from 'vue'

import { findDropTarget, snap, useCanvasDrag, useCanvasZoom, useDragSort } from '../../composables'
import type { EnumData, LayoutEntry } from '../../types'
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
    layout: {
      type: Object as PropType<LayoutEntry>,
      default: () => ({ x: 0, y: 0 }),
    },
    absolute: {
      type: Boolean,
      default: false,
    },
    /** Id of the enclosing package, if rendered inside one. */
    parentPackageId: {
      type: String as PropType<string | undefined>,
      default: undefined,
    },
    /** Whether the enclosing package has a manually-set size (enables cross-package drag on release). */
    parentSizeFixed: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['add-value', 'edit-value', 'edit-enum', 'reorder-values', 'move-to-package', 'move'],
  setup(props, { emit }) {
    const { draggingId, dragOverId, onItemDragStart, onItemDragEnd, onItemDragOver, onItemDragLeave, onItemDrop } =
      useDragSort()
    const canvasDrag = useCanvasDrag()
    const { zoom } = useCanvasZoom()
    const enumEl = ref<HTMLElement | null>(null)

    // ── Pointer drag for repositioning ────────────────────────────────────────
    const dragging = ref(false)
    const dragMoved = ref(false)
    const dragStartPointer = ref({ x: 0, y: 0 })
    const dragStartLayout = ref({ x: 0, y: 0 })

    function onHeaderPointerDown(e: PointerEvent) {
      if (!props.absolute || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      dragging.value = true
      dragMoved.value = false
      dragStartPointer.value = { x: e.clientX, y: e.clientY }
      dragStartLayout.value = { x: props.layout.x, y: props.layout.y }
      canvasDrag.start(props.enum.id)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    function onHeaderPointerMove(e: PointerEvent) {
      if (!dragging.value) return
      const z = zoom.value || 1
      const dx = (e.clientX - dragStartPointer.value.x) / z
      const dy = (e.clientY - dragStartPointer.value.y) / z
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.value = true
      const newX = snap(Math.max(0, dragStartLayout.value.x + dx))
      const newY = snap(Math.max(0, dragStartLayout.value.y + dy))
      emit('move', props.enum.id, newX, newY)

      if (props.parentPackageId && enumEl.value) {
        const target = findDropTarget(e.clientX, e.clientY, enumEl.value, props.parentPackageId)
        canvasDrag.setDropTarget(target)
      }
    }

    function onHeaderPointerUp(e: PointerEvent) {
      if (!dragging.value) return
      dragging.value = false
      const target = canvasDrag.dropTargetPackageId.value
      if (target && props.parentPackageId) {
        emit('move-to-package', {
          type: 'enum',
          id: props.enum.id,
          targetPackageId: target,
        })
      }
      canvasDrag.end()
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    function onHeaderClick(e: MouseEvent) {
      if (dragMoved.value) {
        dragMoved.value = false
        e.stopPropagation()
        return
      }
      e.stopPropagation()
      emit('edit-enum', props.enum)
    }

    return () => {
      const positionStyle = props.absolute
        ? { position: 'absolute' as const, left: `${props.layout.x}px`, top: `${props.layout.y}px` }
        : {}

      return (
        <div
          ref={enumEl}
          class={[styles.enum, props.selected && styles.selected, dragging.value && styles.enumDragging]}
          style={positionStyle}
        >
          <div
            class={[styles.header, props.absolute && styles.headerClickable]}
            onClick={onHeaderClick}
          >
            <DiagramIcon icon={EnumIcon} />
            <div class={styles.titleClickable}>
              <span
                class={[styles.enumName, props.absolute && styles.nameDraggable]}
                onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
                onPointermove={props.absolute ? onHeaderPointerMove : undefined}
                onPointerup={props.absolute ? onHeaderPointerUp : undefined}
              >
                {props.enum.name}
              </span>
            </div>
            {props.showAddButton && (
              <button
                class={styles.addButton}
                onPointerdown={(e) => e.stopPropagation()}
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
