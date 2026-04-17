import { AddIcon, EnumIcon } from '@xomda/icons'
import { defineComponent, type PropType, ref } from 'vue'

import { useCanvasZoom, useDragSort, useNodeDrag } from '../../composables'
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
    const {
      draggingId,
      dragOverId,
      onItemDragStart,
      onItemDragEnd,
      onItemDragOver,
      onItemDragLeave,
      onItemDrop,
    } = useDragSort()
    const { zoom } = useCanvasZoom()
    const enumEl = ref<HTMLElement | null>(null)

    // ── Pointer drag for repositioning ────────────────────────────────────────
    const {
      dragging,
      dragMoved,
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerCancel,
    } = useNodeDrag({
      kind: 'enum' as const,
      id: () => props.enum.id,
      layout: () => props.layout,
      el: enumEl,
      parentPackageId: () => props.parentPackageId,
      zoom: () => zoom.value,
      absolute: () => props.absolute ?? false,
      onMove: (id, x, y) => emit('move', id, x, y),
      onMoveToPackage: (payload) => emit('move-to-package', payload),
    })

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
          class={[
            styles.enum,
            props.selected && styles.selected,
            dragging.value && styles.enumDragging,
          ]}
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
                onPointercancel={props.absolute ? onHeaderPointerCancel : undefined}
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
