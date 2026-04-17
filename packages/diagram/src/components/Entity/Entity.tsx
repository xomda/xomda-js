import { AddIcon, EntityIcon } from '@xomda/icons'
import { defineComponent, type PropType, ref, type SlotsType, type VNode } from 'vue'

import { findDropTarget, snap, useCanvasDrag, useDragSort } from '../../composables'
import type { Attribute, EntityData, LayoutEntry } from '../../types'
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
    layout: {
      type: Object as PropType<LayoutEntry>,
      default: () => ({ x: 0, y: 0 }),
    },
    /** When true, renders as absolutely-positioned canvas element and enables pointer drag. */
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
  emits: ['add-attribute', 'edit-attribute', 'edit-entity', 'reorder-attributes', 'move-to-package', 'move'],
  slots: Object as SlotsType<{
    'header-prefix': () => VNode[]
    'header-suffix': () => VNode[]
    'header-after': () => VNode[]
    'attrs-before': () => VNode[]
    'attrs-after': () => VNode[]
    'attribute-prefix': (props: { attribute: Attribute; index: number }) => VNode[]
    'attribute-suffix': (props: { attribute: Attribute; index: number }) => VNode[]
    footer: () => VNode[]
  }>,
  setup(props, { slots, emit }) {
    const { draggingId, dragOverId, onItemDragStart, onItemDragEnd, onItemDragOver, onItemDragLeave, onItemDrop } =
      useDragSort()
    const canvasDrag = useCanvasDrag()
    const entityEl = ref<HTMLElement | null>(null)

    // ── Pointer drag for repositioning ────────────────────────────────────────
    const dragging = ref(false)
    const dragStartPointer = ref({ x: 0, y: 0 })
    const dragStartLayout = ref({ x: 0, y: 0 })

    function onHeaderPointerDown(e: PointerEvent) {
      if (!props.absolute || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      dragging.value = true
      dragStartPointer.value = { x: e.clientX, y: e.clientY }
      dragStartLayout.value = { x: props.layout.x, y: props.layout.y }
      canvasDrag.start(props.entity.id)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    function onHeaderPointerMove(e: PointerEvent) {
      if (!dragging.value) return
      const dx = e.clientX - dragStartPointer.value.x
      const dy = e.clientY - dragStartPointer.value.y
      const newX = snap(Math.max(0, dragStartLayout.value.x + dx))
      const newY = snap(Math.max(0, dragStartLayout.value.y + dy))
      emit('move', props.entity.id, newX, newY)

      if (props.parentPackageId && props.parentSizeFixed && entityEl.value) {
        const target = findDropTarget(e.clientX, e.clientY, entityEl.value, props.parentPackageId)
        canvasDrag.setDropTarget(target)
      }
    }

    function onHeaderPointerUp(e: PointerEvent) {
      if (!dragging.value) return
      dragging.value = false
      const target = canvasDrag.dropTargetPackageId.value
      if (target && props.parentPackageId && props.parentSizeFixed) {
        emit('move-to-package', {
          type: 'entity',
          id: props.entity.id,
          targetPackageId: target,
        })
      }
      canvasDrag.end()
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    return () => {
      const positionStyle = props.absolute
        ? { position: 'absolute' as const, left: `${props.layout.x}px`, top: `${props.layout.y}px` }
        : {}

      return (
        <div
          ref={entityEl}
          class={[styles.entity, props.selected && styles.selected, dragging.value && styles.entityDragging]}
          style={positionStyle}
        >
          <div
            class={[styles.header, props.absolute && styles.headerDraggable]}
            onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
            onPointermove={props.absolute ? onHeaderPointerMove : undefined}
            onPointerup={props.absolute ? onHeaderPointerUp : undefined}
            onClick={(e) => {
              if (dragging.value) return
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
    }
  },
})
