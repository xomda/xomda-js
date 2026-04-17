import { useDropZone } from '@vueuse/core'
import { PackageIcon } from '@xomda/icons'
import {
  type ComponentPublicInstance,
  computed,
  defineComponent,
  onBeforeUnmount,
  type PropType,
  ref,
  type SlotsType,
  type VNode,
  watch,
} from 'vue'

import { useCanvasDrag, useCanvasZoom, useNodeDrag, useNodeResize } from '../../composables'
import { GRID_SIZE } from '../../composables/useCanvasLayout'
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
// Sides + bottom padding on `.package` (top padding is 0 — the header
// itself is the vertical header zone). Equal to GRID_SIZE so nested
// children land on world-grid lines at local x=0. See the matching
// `padding` declaration in Package.module.scss.
const CONTENT_PADDING = GRID_SIZE

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
    /**
     * When true, render this package at reduced opacity to deemphasize it
     * relative to a selected element elsewhere on the canvas. Has no effect
     * if `selected` is also true.
     */
    dimmed: {
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
    /**
     * Offset of this package's coord space origin from the world grid origin,
     * used so drag-snap lands on world-grid lines for nested packages whose
     * content area is inset by the parent's CSS padding + header. `{ x: 0, y: 0 }`
     * for top-level packages.
     */
    snapOrigin: {
      type: Object as PropType<{ x: number; y: number }>,
      default: () => ({ x: 0, y: 0 }),
    },
    /**
     * Ids of nodes on the selection's lineage (the selected node + every
     * ancestor package). Children whose id is NOT in this set get the
     * `dimmed` treatment when `dimNonSelected` is true. The set being
     * empty means "no dim pass active." Pass the same set down through
     * nested packages so leaf nodes can decide their own dim status.
     */
    preservedIds: {
      type: Object as PropType<Set<string>>,
      default: () => new Set<string>(),
    },
    /** Master switch for the dim pass — usually `selectionPresent && pref-on`. */
    dimNonSelected: {
      type: Boolean,
      default: false,
    },
    /**
     * Id of the currently-selected diagram node (entity/enum/package), or
     * null when nothing is selected. Passed down so every child can
     * render its own `selected` state without ModelView needing to thread
     * a `selected` prop through every render call.
     */
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  emits: [
    'edit-package',
    'edit-entity',
    'edit-attribute',
    'edit-enum',
    'edit-value',
    'reorder-attributes',
    'reorder-values',
    'move-to-package',
    /** Emitted when the package is dragged to a new canvas position: (id, x, y) */
    'move',
    /** Emitted when the package resize handle is dragged: (id, width, height) */
    'resize',
    /**
     * Emitted when the user clicks on the package's empty content area
     * (i.e. inside the package box but not on a node or the header).
     * Mirrors the canvas-background click so the consumer can treat it as
     * "click off the selection" without the user having to find truly
     * empty canvas.
     */
    'background-click',
  ],
  slots: Object as SlotsType<{
    /**
     * Action affordance for the package's own header. Scoped with the package.
     * Diagram is action-agnostic — the host app supplies the UI.
     */
    'header-actions': (props: { package: PackageData }) => VNode[]
    /**
     * Action affordance for each nested entity. Forwarded into the inner
     * `<Entity>`'s `header-actions` slot. Scoped with the entity and its
     * enclosing package.
     */
    'entity-actions': (props: { entity: EntityData; package: PackageData }) => VNode[]
    /**
     * Action affordance for each nested enum. Forwarded into the inner
     * `<Enum>`'s `header-actions` slot. Scoped with the enum and its
     * enclosing package.
     */
    'enum-actions': (props: { enum: EnumData; package: PackageData }) => VNode[]
  }>,
  setup(props, { slots, emit }) {
    const packageEl = ref<HTMLElement | null>(null)
    const headerEl = ref<HTMLElement | null>(null)
    const headerHeight = ref(0)
    const canvasDrag = useCanvasDrag()
    const { zoom } = useCanvasZoom()

    // Track the rendered header's *outer* height (incl. padding) so the
    // child snap origin reflects the real distance from the package's
    // outer-top to `.content`'s top edge — children at local y=0 start at
    // world-y = parent.y + CONTENT_PADDING + headerOuterHeight. The header
    // is pinned to a GRID_SIZE multiple in CSS so the offset is normally
    // 0 mod grid; this observer keeps the snap math honest if a long
    // package name ever wraps and pushes the header taller.
    let headerObserver: ResizeObserver | null = null
    watch(headerEl, (el, _prev, onCleanup) => {
      headerObserver?.disconnect()
      if (!el) {
        headerHeight.value = 0
        return
      }
      headerObserver = new ResizeObserver(() => {
        headerHeight.value = el.offsetHeight
      })
      headerObserver.observe(el)
      headerHeight.value = el.offsetHeight
      onCleanup(() => headerObserver?.disconnect())
    })
    onBeforeUnmount(() => headerObserver?.disconnect())

    // Snap origin to pass to children. `.content`'s top-left in world coords
    // = parent's snap origin + (CONTENT_PADDING, headerHeight). The package
    // has zero top padding now — the header itself is the entire vertical
    // header zone — so only the header height contributes to the Y offset.
    // Modulo GRID_SIZE keeps the value compact for snap math. (This
    // package's own local position is always grid-aligned, so it contributes
    // 0 mod GRID_SIZE.)
    const childSnapOrigin = computed(() => {
      const ox = (props.snapOrigin.x + CONTENT_PADDING) % GRID_SIZE
      const oy = (props.snapOrigin.y + headerHeight.value) % GRID_SIZE
      return { x: (ox + GRID_SIZE) % GRID_SIZE, y: (oy + GRID_SIZE) % GRID_SIZE }
    })

    // ── Drag-to-reposition ────────────────────────────────────────────────────
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
      kind: 'package' as const,
      id: () => props.package.id,
      layout: () => props.layout,
      el: packageEl,
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
      emit('edit-package', props.package)
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

    const childElements = computed(() => {
      const elements: {
        type: 'package' | 'entity' | 'enum'
        data: PackageData | EntityData | EnumData
      }[] = [
        ...props.package.packages.map((p) => ({ type: 'package' as const, data: p })),
        ...props.package.entities.map((e) => ({ type: 'entity' as const, data: e })),
        ...props.package.enums.map((e) => ({ type: 'enum' as const, data: e })),
      ]
      return elements
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

    // Treat a child as "measured" if either the ResizeObserver has reported
    // its DOM size OR the layout map already carries an explicit width/height
    // for it. Sub-packages with a saved size cascade immediately on layout
    // updates (no need to wait a frame for the ResizeObserver to catch up).
    const allChildrenMeasured = computed(() =>
      childElements.value.every((el) => {
        const layoutEntry = props.layouts[el.data.id]
        if (layoutEntry?.width != null && layoutEntry?.height != null) return true
        return childSizes.value.has(el.data.id)
      })
    )

    // Tight bounding box of the children in .content-local coordinates —
    // no padding baked in. The CSS `padding` on .package handles
    // breathing room on the sides + bottom, and `HEADER_OVERHEAD` on top
    // — adding any of that here would double-count it and leave a
    // 2-grid-unit gap on the right/bottom where only one was intended.
    const contentMinSize = computed(() => {
      let maxX = 0
      let maxY = 0
      for (const el of childElements.value) {
        const childLayout = props.layouts[el.data.id] ?? { x: 0, y: 0 }
        // Take the *max* of the saved layout size and the observed DOM size.
        // A child can be larger than its saved size when its own content
        // CSS-grows past the saved floor (the saved width/height is a min,
        // not a max, since switching to `min-width`/`min-height` on
        // .package). Using only the saved value here would silently lose
        // that growth and break the cascade — the parent wouldn't know the
        // child got bigger until the child's own auto-grow watch persisted
        // a new layout entry (which can lag a frame, or never fire for
        // unsized children).
        const observed = childSizes.value.get(el.data.id)
        const w = Math.max(childLayout.width ?? 0, observed?.w ?? 0) || DEFAULT_CHILD_SIZE.w
        const h = Math.max(childLayout.height ?? 0, observed?.h ?? 0) || DEFAULT_CHILD_SIZE.h
        maxX = Math.max(maxX, childLayout.x + w)
        maxY = Math.max(maxY, childLayout.y + h)
      }
      return { width: maxX, height: maxY }
    })

    // ── Resize handle ─────────────────────────────────────────────────────────
    // Floored by the package's actual content min size so the handle can't
    // be dragged smaller than the rectangle that encloses every child —
    // matches the auto-grow math (sides padding for W, header height for
    // H; contentMinSize already carries a right/bottom safety pad).
    const {
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
      onPointerCancel: onResizePointerCancel,
    } = useNodeResize({
      el: packageEl,
      initialSize: () => ({ width: props.layout.width, height: props.layout.height }),
      zoom: () => zoom.value,
      minSize: () => ({
        // Outer box = content bounds + horizontal padding on both sides
        // for width, header (top) + content + bottom padding for height.
        // Matches the auto-grow math below.
        width: contentMinSize.value.width + CONTENT_PADDING * 2,
        height: contentMinSize.value.height + GRID_SIZE * 2 + CONTENT_PADDING,
      }),
      onResize: (width, height) => emit('resize', props.package.id, width, height),
    })

    const isEmpty = () =>
      props.package.packages.length === 0 &&
      props.package.entities.length === 0 &&
      props.package.enums.length === 0

    const sizeFixed = computed(() => props.layout.width != null || props.layout.height != null)
    const isDropTarget = computed(() => canvasDrag.dropTargetPackageId.value === props.package.id)

    // If *this* package is itself dimmed, its CSS opacity already fades
    // everything inside — so we suppress per-child dim to avoid stacking
    // two opacities. Children render at their normal opacity; the package
    // wrapper's opacity does the dimming for them.
    const propagateDimToChildren = computed(
      () => props.dimNonSelected && !(props.dimmed && !props.selected)
    )
    const isChildDimmed = (id: string) =>
      propagateDimToChildren.value && !props.preservedIds.has(id)

    // Auto-grow the package when content overflows its outer bounds. Fires
    // whenever a child moves/resizes (incl. when *this* package was just
    // resized in response to its own child cascade — that's how the chain
    // bubbles up to grandparent packages).
    //
    // The watch is per-dimension: if a side has an explicit saved size we
    // grow it to fit; if it's null we leave it null (the package still
    // CSS-grows via `fit-content` + `.content`'s min-width/min-height, so
    // visually it always contains its children).
    //
    // The header is pinned to GRID_SIZE * 2 in CSS and the package has no
    // top padding, so the total chrome above content is exactly the header
    // height — keeps the package's outer height on the grid.
    // Leftmost / topmost child offset in this package's content coords.
    // Used by the auto-shift watch to detect overflow off the left/top edge.
    const contentMinOffsets = computed(() => {
      let minX = Infinity
      let minY = Infinity
      for (const el of childElements.value) {
        const cl = props.layouts[el.data.id] ?? { x: 0, y: 0 }
        if (cl.x < minX) minX = cl.x
        if (cl.y < minY) minY = cl.y
      }
      return {
        x: Number.isFinite(minX) ? minX : 0,
        y: Number.isFinite(minY) ? minY : 0,
      }
    })

    // Auto-shift on left/top overflow. When a child has been moved past the
    // content area's left or top edge (negative coordinates in content-local
    // space), shift *this* package left/up and slide every child right/down
    // by the same amount so each child's world position is unchanged.
    //
    // Only fires while no node is being dragged — `useNodeDrag` captures the
    // child's layout at pointer-down and computes new positions relative to
    // that baseline. Shifting layout out from under an in-flight drag would
    // make the entity jump on the next pointer move. Waiting for drag end
    // means the entity briefly sticks out of the package outline mid-drag,
    // then the package "absorbs" it on release.
    watch([contentMinOffsets, () => canvasDrag.draggingId.value, allChildrenMeasured], () => {
      if (!props.absolute) return
      if (canvasDrag.draggingId.value != null) return
      if (!allChildrenMeasured.value) return
      const { x: minX, y: minY } = contentMinOffsets.value
      // Snap shifts up to the next grid cell so the package's outer edges
      // stay grid-aligned (matches the auto-grow on the right/bottom).
      const ceilGrid = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE
      const shiftX = minX < 0 ? ceilGrid(-minX) : 0
      const shiftY = minY < 0 ? ceilGrid(-minY) : 0
      if (shiftX === 0 && shiftY === 0) return
      const cur = props.layout
      // Move the package left/up by the shift so the children's world
      // positions stay put after we slide them right/down by the same
      // amount below.
      emit('move', props.package.id, cur.x - shiftX, cur.y - shiftY)
      // If the package has explicit dimensions, grow them; for unsized
      // packages CSS (`fit-content` + `.content`'s min-width/min-height)
      // grows them naturally as the children move into positive space.
      if (cur.width != null || cur.height != null) {
        // `undefined` for the auto-sized dimension means "leave it alone";
        // the consumer treats it as a no-op for that axis.
        emit(
          'resize',
          props.package.id,
          cur.width != null ? cur.width + shiftX : undefined,
          cur.height != null ? cur.height + shiftY : undefined
        )
      }
      // Compensate every child so they end up in the same world position.
      for (const el of childElements.value) {
        const cl = props.layouts[el.data.id] ?? { x: 0, y: 0 }
        emit('move', el.data.id, cl.x + shiftX, cl.y + shiftY)
      }
    })

    const HEADER_OVERHEAD = GRID_SIZE * 2
    watch([contentMinSize, allChildrenMeasured], () => {
      if (!props.absolute) return
      // Wait until every child has reported its real size — the default
      // placeholder (DEFAULT_CHILD_SIZE) would otherwise produce a phantom
      // overflow on initial mount and grow the package against the saved
      // layout.
      if (!allChildrenMeasured.value) return
      const cur = props.layout
      // Nothing to grow if neither dimension is locked — CSS handles the
      // visual size, no need to materialise a width/height on a previously
      // unsized package.
      if (cur.width == null && cur.height == null) return
      // Round up to the nearest grid cell so the package's right/bottom edge
      // lands on a grid line (and child snap math stays consistent with it).
      const ceilToGrid = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE
      // Outer box = tight content bounds + chrome on each side:
      //   width  = left padding + content + right padding
      //   height = header (top) + content + bottom padding
      // (Top CSS padding is 0 — the header is the entire top zone.)
      const wantedW = ceilToGrid(contentMinSize.value.width + CONTENT_PADDING * 2)
      const wantedH = ceilToGrid(contentMinSize.value.height + HEADER_OVERHEAD + CONTENT_PADDING)
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
            // Use min-width / min-height (not fixed width/height) so the
            // package can always CSS-grow to enclose its content — the
            // saved layout is the *floor*, the content is the ceiling.
            // This is what makes growth cascade naturally up the ancestor
            // chain: when a child package's `.content` min-width/min-height
            // grows, the parent's `width: fit-content` picks it up, the
            // parent's DOM size changes, and the grandparent's
            // ResizeObserver fires — all the way to the root.
            minWidth: props.layout.width ? `${props.layout.width}px` : undefined,
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
            props.dimmed && !props.selected && styles.dimmed,
            (isOverDropZone.value || isDropTarget.value) && styles.dragOver,
            dragging.value && styles.dragging,
          ]}
          style={positionStyle}
        >
          <div
            ref={headerEl}
            class={[styles.header, props.absolute && styles.headerClickable]}
            draggable={!props.absolute}
            onDragstart={!props.absolute ? onPackageDragStart : undefined}
            onClick={onHeaderClick}
          >
            <DiagramIcon icon={PackageIcon} />
            <div class={styles.titleClickable}>
              <span
                class={[styles.packageName, props.absolute && styles.nameDraggable]}
                role={props.absolute ? 'button' : undefined}
                tabindex={props.absolute ? 0 : undefined}
                aria-grabbed={props.absolute ? pickedUp.value : undefined}
                aria-label={
                  props.absolute
                    ? `${props.package.name} — press Space to pick up, arrow keys to move`
                    : undefined
                }
                onPointerdown={props.absolute ? onHeaderPointerDown : undefined}
                onPointermove={props.absolute ? onHeaderPointerMove : undefined}
                onPointerup={props.absolute ? onHeaderPointerUp : undefined}
                onPointercancel={props.absolute ? onHeaderPointerCancel : undefined}
                onKeydown={props.absolute ? onHeaderKeyDown : undefined}
              >
                {props.package.name}
              </span>
            </div>
            <div class={styles.actions}>
              {slots['header-actions']?.({ package: props.package })}
            </div>
          </div>

          <div
            class={styles.content}
            style={{
              minWidth: `${contentMinSize.value.width}px`,
              minHeight: `${contentMinSize.value.height}px`,
            }}
            onClick={(e: MouseEvent) => {
              // The package header owns "select this package" — clicks on
              // the empty body deselect, matching the canvas background.
              // Guarded to the content element itself so clicks on child
              // nodes (which bubble up through .content) don't deselect.
              if (e.target === e.currentTarget) {
                e.stopPropagation()
                emit('background-click')
              }
            }}
          >
            {isEmpty() && <div class={styles.empty}>Empty package</div>}

            {childElements.value.map((el) => {
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
                    snapOrigin={childSnapOrigin.value}
                    selected={props.selectedId === el.data.id}
                    selectedId={props.selectedId}
                    dimmed={isChildDimmed(el.data.id)}
                    dimNonSelected={propagateDimToChildren.value}
                    preservedIds={props.preservedIds}
                    onEdit-package={(p) => emit('edit-package', p)}
                    onEdit-entity={(e) => emit('edit-entity', e)}
                    onEdit-attribute={(e, a) => emit('edit-attribute', e, a)}
                    onEdit-enum={(en) => emit('edit-enum', en)}
                    onEdit-value={(en, v) => emit('edit-value', en, v)}
                    onReorder-attributes={(e, ids) => emit('reorder-attributes', e, ids)}
                    onReorder-values={(en, ids) => emit('reorder-values', en, ids)}
                    onMove-to-package={(payload) => emit('move-to-package', payload)}
                    onMove={(id, x, y) => emit('move', id, x, y)}
                    onResize={(id, w, h) => emit('resize', id, w, h)}
                    onBackground-click={() => emit('background-click')}
                  >
                    {{
                      'header-actions': slots['header-actions']
                        ? (s: { package: PackageData }) => slots['header-actions']!(s)
                        : undefined,
                      'entity-actions': slots['entity-actions']
                        ? (s: { entity: EntityData; package: PackageData }) =>
                            slots['entity-actions']!(s)
                        : undefined,
                      'enum-actions': slots['enum-actions']
                        ? (s: { enum: EnumData; package: PackageData }) => slots['enum-actions']!(s)
                        : undefined,
                    }}
                  </Package>
                )
              }
              if (el.type === 'entity') {
                const childEntity = el.data as EntityData
                return (
                  <Entity
                    key={el.data.id}
                    ref={setRef}
                    entity={childEntity}
                    inheritedAttributes={props.inheritedAttributesByEntityId[el.data.id] ?? []}
                    layout={childLayout}
                    absolute={true}
                    parentPackageId={props.package.id}
                    parentSizeFixed={sizeFixed.value}
                    snapOrigin={childSnapOrigin.value}
                    selected={props.selectedId === el.data.id}
                    dimmed={isChildDimmed(el.data.id)}
                    onEdit-entity={(e) => emit('edit-entity', e)}
                    onEdit-attribute={(e, a) => emit('edit-attribute', e, a)}
                    onReorder-attributes={(e, ids) => emit('reorder-attributes', e, ids)}
                    onMove-to-package={(payload) => emit('move-to-package', payload)}
                    onMove={(id, x, y) => emit('move', id, x, y)}
                  >
                    {{
                      'header-actions': slots['entity-actions']
                        ? () =>
                            slots['entity-actions']!({
                              entity: childEntity,
                              package: props.package,
                            })
                        : undefined,
                    }}
                  </Entity>
                )
              }
              const childEnum = el.data as EnumData
              return (
                <Enum
                  key={el.data.id}
                  ref={setRef}
                  enum={childEnum}
                  layout={childLayout}
                  absolute={true}
                  parentPackageId={props.package.id}
                  parentSizeFixed={sizeFixed.value}
                  snapOrigin={childSnapOrigin.value}
                  selected={props.selectedId === el.data.id}
                  dimmed={isChildDimmed(el.data.id)}
                  onEdit-enum={(e) => emit('edit-enum', e)}
                  onEdit-value={(e, v) => emit('edit-value', e, v)}
                  onReorder-values={(e, ids) => emit('reorder-values', e, ids)}
                  onMove-to-package={(payload) => emit('move-to-package', payload)}
                  onMove={(id, x, y) => emit('move', id, x, y)}
                >
                  {{
                    'header-actions': slots['enum-actions']
                      ? () => slots['enum-actions']!({ enum: childEnum, package: props.package })
                      : undefined,
                  }}
                </Enum>
              )
            })}
          </div>

          {props.absolute && (
            <div
              class={styles.resizeHandle}
              onPointerdown={onResizePointerDown}
              onPointermove={onResizePointerMove}
              onPointerup={onResizePointerUp}
              onPointercancel={onResizePointerCancel}
              title="Resize"
              role="separator"
              aria-label="Resize package"
            />
          )}
        </div>
      )
    }
  },
})
