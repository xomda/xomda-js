import { useDropZone } from '@vueuse/core'
import { PackageIcon } from '@xomda/icons'
import {
  type ComponentPublicInstance,
  computed,
  defineComponent,
  onBeforeUnmount,
  type PropType,
  ref,
  watch,
} from 'vue'

import { findDropTarget, snap, useCanvasDrag, useCanvasZoom } from '../../composables'
import {
  type Attribute,
  type EntityData,
  type EnumData,
  type Layout,
  type LayoutEntry,
  type PackageData,
} from '../../types'
import { DiagramIcon } from '../DiagramIcon'
import { Entity } from '../Entity'
import { Enum } from '../Enum'
import styles from './Package.module.scss'

const DEFAULT_CHILD_SIZE = { w: 240, h: 120 }
const CONTENT_PADDING = 16

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
    /** Layout map for descendants — each child looks up its own entry by id. */
    layouts: {
      type: Object as PropType<Layout>,
      default: () => ({}),
    },
    /** When true, render as absolutely-positioned canvas element (top-level packages). */
    absolute: {
      type: Boolean,
      default: false,
    },
    /** Id of the enclosing package, if this Package is nested. Undefined for top-level. */
    parentPackageId: {
      type: String as PropType<string | undefined>,
      default: undefined,
    },
    /** Whether the enclosing package has a manually-set size (locks auto-resize, enables cross-package drag). */
    parentSizeFixed: {
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
    const canvasDrag = useCanvasDrag()
    const { zoom } = useCanvasZoom()

    // ── Drag-to-reposition ────────────────────────────────────────────────────
    const dragging = ref(false)
    const dragMoved = ref(false)
    const dragStartPointer = ref({ x: 0, y: 0 })
    const dragStartLayout = ref({ x: 0, y: 0 })

    function onHeaderPointerDown(e: PointerEvent) {
      if (!props.absolute) return
      // Only left-button drag
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      dragging.value = true
      dragMoved.value = false
      dragStartPointer.value = { x: e.clientX, y: e.clientY }
      dragStartLayout.value = { x: props.layout.x, y: props.layout.y }
      canvasDrag.start(props.package.id)
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
      emit('move', props.package.id, newX, newY)

      if (props.parentPackageId && packageEl.value) {
        const target = findDropTarget(e.clientX, e.clientY, packageEl.value, props.parentPackageId)
        canvasDrag.setDropTarget(target)
      }
    }

    function onHeaderPointerUp(e: PointerEvent) {
      if (!dragging.value) return
      dragging.value = false
      const target = canvasDrag.dropTargetPackageId.value
      if (target && props.parentPackageId) {
        emit('move-to-package', {
          type: 'package',
          id: props.package.id,
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
      emit('edit-package', props.package)
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
      const z = zoom.value || 1
      const dx = (e.clientX - resizeStartPointer.value.x) / z
      const dy = (e.clientY - resizeStartPointer.value.y) / z
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

    // ── Track child sizes for auto-resizing the content area ─────────────────
    const childSizes = ref(new Map<string, { w: number; h: number }>())
    const observers = new Map<string, ResizeObserver>()

    function observeChild(id: string, instance: Element | ComponentPublicInstance | null) {
      const el =
        instance && '$el' in (instance as ComponentPublicInstance)
          ? ((instance as ComponentPublicInstance).$el as Element | null)
          : (instance as Element | null)
      const existing = observers.get(id)
      if (existing) {
        existing.disconnect()
        observers.delete(id)
      }
      if (!el) return
      const ro = new ResizeObserver(([entry]) => {
        const next = new Map(childSizes.value)
        next.set(id, { w: entry.contentRect.width, h: entry.contentRect.height })
        childSizes.value = next
      })
      ro.observe(el)
      observers.set(id, ro)
    }

    onBeforeUnmount(() => {
      observers.forEach((o) => o.disconnect())
      observers.clear()
    })

    const contentMinSize = computed(() => {
      let maxX = 0
      let maxY = 0
      for (const el of sortedElements.value) {
        const childLayout = props.layouts[el.data.id] ?? { x: 0, y: 0 }
        const size = childSizes.value.get(el.data.id) ?? DEFAULT_CHILD_SIZE
        maxX = Math.max(maxX, childLayout.x + size.w)
        maxY = Math.max(maxY, childLayout.y + size.h)
      }
      return { width: maxX + CONTENT_PADDING, height: maxY + CONTENT_PADDING }
    })

    const isEmpty = () =>
      props.package.packages.length === 0 &&
      props.package.entities.length === 0 &&
      props.package.enums.length === 0

    const sizeFixed = computed(() => props.layout.width != null || props.layout.height != null)
    const isDropTarget = computed(() => canvasDrag.dropTargetPackageId.value === props.package.id)

    // Auto-grow a manually-sized package when its content overflows the fixed
    // bounds (e.g. a child was dragged to a position outside the package).
    // Header takes ~58px (icon + title + 12px padding-bottom + 16px outer).
    const HEADER_OVERHEAD = 60
    watch([contentMinSize, sizeFixed], () => {
      if (!props.absolute || !sizeFixed.value) return
      const cur = props.layout
      const wantedW = contentMinSize.value.width + CONTENT_PADDING
      const wantedH = contentMinSize.value.height + CONTENT_PADDING + HEADER_OVERHEAD
      const newW = cur.width != null ? Math.max(cur.width, wantedW) : cur.width
      const newH = cur.height != null ? Math.max(cur.height, wantedH) : cur.height
      if (newW !== cur.width || newH !== cur.height) {
        emit(
          'resize',
          props.package.id,
          newW ?? cur.width ?? wantedW,
          newH ?? cur.height ?? wantedH
        )
      }
    })

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
          data-package-id={props.package.id}
          class={[
            styles.package,
            props.selected && styles.selected,
            (isOverDropZone.value || isDropTarget.value) && styles.dragOver,
            dragging.value && styles.dragging,
          ]}
          style={positionStyle}
        >
          <div
            class={[styles.header, props.absolute && styles.headerClickable]}
            draggable={!props.absolute}
            onDragstart={!props.absolute ? onPackageDragStart : undefined}
            onClick={onHeaderClick}
          >
            <DiagramIcon icon={PackageIcon} />
            <div class={styles.titleClickable}>
              <span
                class={[styles.packageName, props.absolute && styles.nameDraggable]}
                onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
                onPointermove={props.absolute ? onHeaderPointerMove : undefined}
                onPointerup={props.absolute ? onHeaderPointerUp : undefined}
              >
                {props.package.name}
              </span>
            </div>
            <div class={styles.actions}>
              <button
                class={styles.addButton}
                onPointerdown={(e) => e.stopPropagation()}
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
                onPointerdown={(e) => e.stopPropagation()}
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
                onPointerdown={(e) => e.stopPropagation()}
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

          <div
            class={styles.content}
            style={{
              minWidth: `${contentMinSize.value.width}px`,
              minHeight: `${contentMinSize.value.height}px`,
            }}
          >
            {isEmpty() && <div class={styles.empty}>Empty package</div>}

            {sortedElements.value.map((el) => {
              const childLayout = props.layouts[el.data.id] ?? { x: 0, y: 0 }
              const setRef = (c: Element | ComponentPublicInstance | null) =>
                observeChild(el.data.id, c)
              if (el.type === 'package') {
                return (
                  <Package
                    key={el.data.id}
                    ref={setRef}
                    package={el.data as PackageData}
                    inheritedAttributesByEntityId={props.inheritedAttributesByEntityId}
                    layout={childLayout}
                    layouts={props.layouts}
                    absolute={true}
                    parentPackageId={props.package.id}
                    parentSizeFixed={sizeFixed.value}
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
                )
              }
              if (el.type === 'entity') {
                return (
                  <Entity
                    key={el.data.id}
                    ref={setRef}
                    entity={el.data as EntityData}
                    inheritedAttributes={props.inheritedAttributesByEntityId[el.data.id] ?? []}
                    showAddButton={true}
                    layout={childLayout}
                    absolute={true}
                    parentPackageId={props.package.id}
                    parentSizeFixed={sizeFixed.value}
                    onEdit-entity={(e) => emit('edit-entity', e)}
                    onAdd-attribute={(e) => emit('add-attribute', e)}
                    onEdit-attribute={(e, a) => emit('edit-attribute', e, a)}
                    onReorder-attributes={(e, ids) => emit('reorder-attributes', e, ids)}
                    onMove-to-package={(payload) => emit('move-to-package', payload)}
                    onMove={(id, x, y) => emit('move', id, x, y)}
                  />
                )
              }
              return (
                <Enum
                  key={el.data.id}
                  ref={setRef}
                  enum={el.data as EnumData}
                  showAddButton={true}
                  layout={childLayout}
                  absolute={true}
                  parentPackageId={props.package.id}
                  parentSizeFixed={sizeFixed.value}
                  onEdit-enum={(e) => emit('edit-enum', e)}
                  onAdd-value={(e) => emit('add-value', e)}
                  onEdit-value={(e, v) => emit('edit-value', e, v)}
                  onReorder-values={(e, ids) => emit('reorder-values', e, ids)}
                  onMove-to-package={(payload) => emit('move-to-package', payload)}
                  onMove={(id, x, y) => emit('move', id, x, y)}
                />
              )
            })}
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
