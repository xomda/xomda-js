import { useDropZone } from '@vueuse/core'
import { PackageIcon } from '@xomda/icons'
import { computed, defineComponent, type PropType, ref } from 'vue'

import { snap } from '../../composables'
import { type Attribute, type EntityData, type EnumData, type LayoutEntry, type PackageData } from '../../types'
import { Entity } from '../Entity'
import { Enum } from '../Enum'
import { DiagramIcon } from '../DiagramIcon'
import { DropZone } from './DropZone'
import styles from './Package.module.scss'

export const Package = defineComponent({
  name: 'XPackage',
  props: {
    package: {
      type: Object as PropType<PackageData>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    inheritedAttributesByEntityId: {
      type: Object as PropType<Record<string, Attribute[]>>,
      default: () => ({}),
    },
    layout: {
      type: Object as PropType<LayoutEntry>,
      default: () => ({ x: 0, y: 0 }),
    },
    /** When true, render as absolutely-positioned canvas element (top-level packages). */
    absolute: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'edit-package',
    'edit-entity',
    'add-attribute',
    'edit-attribute',
    'edit-enum',
    'add-value',
    'edit-value',
    'add-package',
    'add-entity',
    'add-enum',
    'reorder-attributes',
    'reorder-values',
    'move-to-package',
    /** Emitted when the package is dragged to a new canvas position: (id, x, y) */
    'move',
    /** Emitted when the package resize handle is dragged: (id, width, height) */
    'resize',
  ],
  setup(props, { emit }) {
    const packageEl = ref<HTMLElement | null>(null)

    // ── Drag-to-reposition ────────────────────────────────────────────────────
    const dragging = ref(false)
    const dragStartPointer = ref({ x: 0, y: 0 })
    const dragStartLayout = ref({ x: 0, y: 0 })

    function onHeaderPointerDown(e: PointerEvent) {
      if (!props.absolute) return
      // Only left-button drag
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      dragging.value = true
      dragStartPointer.value = { x: e.clientX, y: e.clientY }
      dragStartLayout.value = { x: props.layout.x, y: props.layout.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    function onHeaderPointerMove(e: PointerEvent) {
      if (!dragging.value) return
      const dx = e.clientX - dragStartPointer.value.x
      const dy = e.clientY - dragStartPointer.value.y
      const newX = snap(Math.max(0, dragStartLayout.value.x + dx))
      const newY = snap(Math.max(0, dragStartLayout.value.y + dy))
      emit('move', props.package.id, newX, newY)
    }

    function onHeaderPointerUp(e: PointerEvent) {
      if (!dragging.value) return
      dragging.value = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    // ── Resize handle ─────────────────────────────────────────────────────────
    const resizing = ref(false)
    const resizeStartPointer = ref({ x: 0, y: 0 })
    const resizeStartSize = ref({ width: 0, height: 0 })
    const MIN_SIZE = 96

    function onResizePointerDown(e: PointerEvent) {
      e.preventDefault()
      e.stopPropagation()
      resizing.value = true
      resizeStartPointer.value = { x: e.clientX, y: e.clientY }
      resizeStartSize.value = {
        width: props.layout.width ?? (packageEl.value?.offsetWidth ?? MIN_SIZE),
        height: props.layout.height ?? (packageEl.value?.offsetHeight ?? MIN_SIZE),
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    function onResizePointerMove(e: PointerEvent) {
      if (!resizing.value) return
      const dx = e.clientX - resizeStartPointer.value.x
      const dy = e.clientY - resizeStartPointer.value.y
      const newW = snap(Math.max(MIN_SIZE, resizeStartSize.value.width + dx))
      const newH = snap(Math.max(MIN_SIZE, resizeStartSize.value.height + dy))
      emit('resize', props.package.id, newW, newH)
    }

    function onResizePointerUp(e: PointerEvent) {
      if (!resizing.value) return
      resizing.value = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    // ── HTML5 DnD for move-to-package (only when not absolute) ───────────────
    const onPackageDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'application/x-xomda-diagram',
          JSON.stringify({ type: 'package', id: props.package.id })
        )
      }
    }

    // ── Drop zone (structural move-to-package) ────────────────────────────────
    const { isOverDropZone } = useDropZone(packageEl, {
      dataTypes: ['application/x-xomda-diagram'],
      onDrop(_, event) {
        const data = event.dataTransfer?.getData('application/x-xomda-diagram')
        if (!data) return
        event.preventDefault()
        event.stopPropagation()
        const parsed = JSON.parse(data) as { type: string; id: string }
        if (parsed.id !== props.package.id) {
          emit('move-to-package', {
            type: parsed.type,
            id: parsed.id,
            targetPackageId: props.package.id,
          })
        }
      },
    })

    // ── Sorted children ───────────────────────────────────────────────────────
    const sortedElements = computed(() => {
      const elements: {
        type: 'package' | 'entity' | 'enum'
        data: PackageData | EntityData | EnumData
      }[] = [
        ...props.package.packages.map((p) => ({ type: 'package' as const, data: p })),
        ...props.package.entities.map((e) => ({ type: 'entity' as const, data: e })),
        ...props.package.enums.map((e) => ({ type: 'enum' as const, data: e })),
      ]

      const order = props.package.elementsOrder || []
      if (order.length === 0) return elements

      return elements.sort((a, b) => {
        const idxA = order.indexOf(a.data.id)
        const idxB = order.indexOf(b.data.id)
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        return idxA - idxB
      })
    })

    const isEmpty = () =>
      props.package.packages.length === 0 &&
      props.package.entities.length === 0 &&
      props.package.enums.length === 0

    return () => {
      const positionStyle = props.absolute
        ? {
            position: 'absolute' as const,
            left: `${props.layout.x}px`,
            top: `${props.layout.y}px`,
            width: props.layout.width ? `${props.layout.width}px` : undefined,
            minHeight: props.layout.height ? `${props.layout.height}px` : undefined,
          }
        : {}

      return (
        <div
          ref={packageEl}
          class={[
            styles.package,
            props.selected && styles.selected,
            isOverDropZone.value && styles.dragOver,
            dragging.value && styles.dragging,
          ]}
          style={positionStyle}
        >
          <div
            class={[styles.header, props.absolute && styles.headerDraggable]}
            draggable={!props.absolute}
            onDragstart={!props.absolute ? onPackageDragStart : undefined}
            onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
            onPointermove={props.absolute ? onHeaderPointerMove : undefined}
            onPointerup={props.absolute ? onHeaderPointerUp : undefined}
            onClick={(e) => {
              if (dragging.value) return
              e.stopPropagation()
              emit('edit-package', props.package)
            }}
          >
            <DiagramIcon icon={PackageIcon} />
            <span class={styles.packageName}>{props.package.name}</span>
            <div class={styles.actions}>
              <button
                class={styles.addButton}
                onClick={(e) => {
                  e.stopPropagation()
                  emit('add-package', props.package)
                }}
                title="Add sub-package"
              >
                P
              </button>
              <button
                class={styles.addButton}
                onClick={(e) => {
                  e.stopPropagation()
                  emit('add-entity', props.package)
                }}
                title="Add entity"
              >
                T
              </button>
              <button
                class={styles.addButton}
                onClick={(e) => {
                  e.stopPropagation()
                  emit('add-enum', props.package)
                }}
                title="Add enum"
              >
                E
              </button>
            </div>
          </div>

          <div class={styles.content}>
            {isEmpty() && <div class={styles.empty}>Empty package</div>}

            <DropZone
              index={0}
              targetPackageId={props.package.id}
              onDrop-item={(p) => emit('move-to-package', p)}
            />

            {sortedElements.value.map((el, idx) => (
              <>
                {el.type === 'package' && (
                  <Package
                    key={el.data.id}
                    package={el.data as PackageData}
                    inheritedAttributesByEntityId={props.inheritedAttributesByEntityId}
                    onEdit-package={(p) => emit('edit-package', p)}
                    onEdit-entity={(e) => emit('edit-entity', e)}
                    onAdd-attribute={(e) => emit('add-attribute', e)}
                    onEdit-attribute={(e, a) => emit('edit-attribute', e, a)}
                    onEdit-enum={(en) => emit('edit-enum', en)}
                    onAdd-value={(en) => emit('add-value', en)}
                    onEdit-value={(en, v) => emit('edit-value', en, v)}
                    onAdd-package={(p) => emit('add-package', p)}
                    onAdd-entity={(p) => emit('add-entity', p)}
                    onAdd-enum={(p) => emit('add-enum', p)}
                    onReorder-attributes={(e, ids) => emit('reorder-attributes', e, ids)}
                    onReorder-values={(en, ids) => emit('reorder-values', en, ids)}
                    onMove-to-package={(payload) => emit('move-to-package', payload)}
                    onMove={(id, x, y) => emit('move', id, x, y)}
                    onResize={(id, w, h) => emit('resize', id, w, h)}
                  />
                )}
                {el.type === 'entity' && (
                  <Entity
                    key={el.data.id}
                    entity={el.data as EntityData}
                    inheritedAttributes={props.inheritedAttributesByEntityId[el.data.id] ?? []}
                    showAddButton={true}
                    onEdit-entity={(e) => emit('edit-entity', e)}
                    onAdd-attribute={(e) => emit('add-attribute', e)}
                    onEdit-attribute={(e, a) => emit('edit-attribute', e, a)}
                    onReorder-attributes={(e, ids) => emit('reorder-attributes', e, ids)}
                    onMove-to-package={(payload) => emit('move-to-package', payload)}
                  />
                )}
                {el.type === 'enum' && (
                  <Enum
                    key={el.data.id}
                    enum={el.data as EnumData}
                    showAddButton={true}
                    onEdit-enum={(e) => emit('edit-enum', e)}
                    onAdd-value={(e) => emit('add-value', e)}
                    onEdit-value={(e, v) => emit('edit-value', e, v)}
                    onReorder-values={(e, ids) => emit('reorder-values', e, ids)}
                    onMove-to-package={(payload) => emit('move-to-package', payload)}
                  />
                )}
                <DropZone
                  index={idx + 1}
                  targetPackageId={props.package.id}
                  onDrop-item={(p) => emit('move-to-package', p)}
                />
              </>
            ))}
          </div>

          {props.absolute && (
            <div
              class={styles.resizeHandle}
              onPointerdown={onResizePointerDown}
              onPointermove={onResizePointerMove}
              onPointerup={onResizePointerUp}
              title="Resize"
            />
          )}
        </div>
      )
    }
  },
})
