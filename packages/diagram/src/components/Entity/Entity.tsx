import { EntityIcon } from '@xomda/icons'
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
    selected: {
      type: Boolean,
      default: false,
    },
    /**
     * Fade to the canvas's `--xomda-dim-opacity` when true. Driven by the
     * top-level dim-non-selected pass so an inactive entity recedes
     * visually next to the selected one.
     */
    dimmed: {
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
    /**
     * Offset of this entity's coord space origin from the world grid origin,
     * used so drag-snap lands on world-grid lines for entities inside a
     * package (whose content area is inset by the parent's CSS padding +
     * header). `{ x: 0, y: 0 }` for top-level entities.
     */
    snapOrigin: {
      type: Object as PropType<{ x: number; y: number }>,
      default: () => ({ x: 0, y: 0 }),
    },
  },
  emits: ['edit-attribute', 'edit-entity', 'reorder-attributes', 'move-to-package', 'move'],
  slots: Object as SlotsType<{
    'header-prefix': () => VNode[]
    'header-suffix': () => VNode[]
    /**
     * Per-entity action affordance rendered at the right edge of the header.
     * Diagram is action-agnostic; host app supplies the UI (menu, buttons, …).
     */
    'header-actions': (props: { entity: EntityData }) => VNode[]
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
      pickedUp,
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerCancel,
      onKeyDown: onHeaderKeyDown,
    } = useNodeDrag({
      kind: 'entity' as const,
      id: () => props.entity.id,
      layout: () => props.layout,
      el: entityEl,
      parentPackageId: () => props.parentPackageId,
      zoom: () => zoom.value,
      absolute: () => props.absolute ?? false,
      snapOrigin: () => props.snapOrigin,
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
          data-entity-id={props.entity.id}
          class={[
            styles.entity,
            props.selected && styles.selected,
            props.dimmed && !props.selected && styles.dimmed,
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
                role={props.absolute ? 'button' : undefined}
                tabindex={props.absolute ? 0 : undefined}
                aria-grabbed={props.absolute ? pickedUp.value : undefined}
                aria-label={
                  props.absolute
                    ? `${props.entity.name} — press Space to pick up, arrow keys to move`
                    : undefined
                }
                onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
                onPointermove={props.absolute ? onHeaderPointerMove : undefined}
                onPointerup={props.absolute ? onHeaderPointerUp : undefined}
                onPointercancel={props.absolute ? onHeaderPointerCancel : undefined}
                onKeydown={props.absolute ? onHeaderKeyDown : undefined}
              >
                {props.entity.name}
              </span>
            </div>
            {slots['header-suffix']?.()}
            {slots['header-actions']?.({ entity: props.entity })}
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
