import { AddIcon, EntityIcon } from '@xomda/icons'
import { defineComponent, type PropType, ref, type SlotsType, type VNode } from 'vue'

import { useCanvasZoom, useDragSort, useNodeDrag } from '../../composables'
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
  emits: [
    'add-attribute',
    'edit-attribute',
    'edit-entity',
    'reorder-attributes',
    'move-to-package',
    'move',
  ],
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
    const entityEl = ref<HTMLElement | null>(null)

    // ── Pointer drag for repositioning ────────────────────────────────────────
    const {
      dragging,
      dragMoved,
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerCancel,
    } = useNodeDrag({
      kind: 'entity' as const,
      id: () => props.entity.id,
      layout: () => props.layout,
      el: entityEl,
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
      emit('edit-entity', props.entity)
    }

    return () => {
      const positionStyle = props.absolute
        ? { position: 'absolute' as const, left: `${props.layout.x}px`, top: `${props.layout.y}px` }
        : {}

      return (
        <div
          ref={entityEl}
          class={[
            styles.entity,
            props.selected && styles.selected,
            dragging.value && styles.entityDragging,
          ]}
          style={positionStyle}
        >
          <div
            class={[styles.header, props.absolute && styles.headerClickable]}
            onClick={onHeaderClick}
          >
            {slots['header-prefix']?.()}
            <DiagramIcon icon={EntityIcon} />
            <div class={styles.titleClickable}>
              <span
                class={[styles.entityName, props.absolute && styles.nameDraggable]}
                onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
                onPointermove={props.absolute ? onHeaderPointerMove : undefined}
                onPointerup={props.absolute ? onHeaderPointerUp : undefined}
                onPointercancel={props.absolute ? onHeaderPointerCancel : undefined}
              >
                {props.entity.name}
              </span>
            </div>
            {slots['header-suffix']?.()}
            {props.showAddButton && (
              <button
                class={styles.addButton}
                onPointerdown={(e) => e.stopPropagation()}
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
