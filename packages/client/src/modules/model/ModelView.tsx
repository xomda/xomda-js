import {
  findEntityById,
  findEnumById,
  findPackageById,
  getAllEntities,
  getAllEnums,
  getAllPackages,
  getInheritedAttributes,
  type Model,
  PRIMITIVE_TYPES,
  type ProjectSettings,
} from '@xomda/core'
import {
  type Attribute,
  DiagramCanvas,
  type EntityData,
  type EnumData,
  GRID_SIZE,
  type Layout,
  normalizeLayoutToGrid,
  Package,
  type PackageData,
  snap,
} from '@xomda/diagram'
import {
  AddIcon,
  DeleteIcon,
  EntityIcon,
  EnumIcon,
  Grid3x3RoundedIcon,
  PackageIcon,
  PropertiesIcon,
  SaveIcon,
} from '@xomda/icons'
import {
  MenuButton,
  type MenuItemConfig,
  type ParsedTrpcError,
  parseTrpcError,
  SidePanel,
  useConfirm,
  useDelayedLoading,
  useEditBuffer,
  useLocalStorageStore,
  useModelEntity,
  useMutation,
  useNotificationsStore,
  useVersion,
} from '@xomda/ui'
import type { JsonObject } from 'type-fest'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  VAlert,
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VDivider,
  VEmptyState,
  VProgressCircular,
  VSelect,
  VSpacer,
  VTextField,
  VTooltip,
} from 'vuetify/components'

import {
  AppTitleBar,
  CommitModal,
  DynamicForm,
  LayoutSavePill,
  ModelMiniToolbar,
  ModelTree,
  PanelDivider,
  SceneMiniToolbar,
  WorkspaceSelector,
} from '../../components'
import { usePanelResize } from '../../composables'
import { useWorkspaceStore } from '../../stores'
import { trpc } from '../../trpc'
import { useModelSelectionStore } from '.'
import styles from './ModelView.module.scss'
import { ModelRoutes } from './routes'

export const ModelView = defineComponent({
  name: 'ModelView',
  setup() {
    const workspace = useWorkspaceStore()
    const model = ref<Model | null>(null)
    const loading = ref(false)
    const showLoading = useDelayedLoading(loading)
    const error = ref<string | null>(null)
    const detailedErrors = ref<{ message: string; path?: (string | number)[] }[] | null>(null)
    const commitOpen = ref(false)
    const versionLabels = ref<string[]>([])

    /**
     * tRPC selector forwarded to every `model.*` call so the active project +
     * model in the workspace store drive the request. Omitting either falls
     * back to the server's default (cwd + primary model) — the same shape
     * the CLI uses, so we degrade gracefully when the workspace hasn't
     * finished loading yet.
     */
    const selectorInput = computed(() => {
      const root = workspace.activeProjectRoot ?? undefined
      const modelId = workspace.activeModelId ?? undefined
      return root || modelId ? { root, modelId } : undefined
    })

    async function loadVersionLabels(): Promise<void> {
      try {
        const list = await trpc.model.listVersions.query()
        versionLabels.value = list.map((v) => v.label)
      } catch {
        versionLabels.value = []
      }
    }

    // Canvas layout: UUID → {x, y, width?, height?}
    // useEditBuffer tracks the user's pending moves vs. the last persisted
    // snapshot; the Save/Cancel pill in the canvas reads `layoutBuffer.dirty`.
    const layoutBuffer = useEditBuffer<Layout>({})
    /** Convenience read accessor — draft is never null in practice (we always seed it). */
    const layout = computed<Layout>(() => layoutBuffer.draft.value ?? {})

    function onPackageMove(id: string, x: number, y: number) {
      const current = layout.value
      layoutBuffer.draft.value = { ...current, [id]: { ...current[id], x, y } }
      scheduleCascade()
    }

    function onPackageResize(id: string, width: number | undefined, height: number | undefined) {
      const current = layout.value
      const prev = current[id] ?? { x: 0, y: 0 }
      // The auto-shift in Package.tsx passes `undefined` for an axis that
      // wasn't explicitly sized — preserve the existing value rather than
      // materialising a width/height the user never asked for.
      const next = {
        ...prev,
        width: width !== undefined ? width : prev.width,
        height: height !== undefined ? height : prev.height,
      }
      layoutBuffer.draft.value = { ...current, [id]: next }
      scheduleCascade()
    }

    // ── Cascading auto-grow ──────────────────────────────────────────────────
    // Walks the package tree post-order and grows each sized package's saved
    // width/height so it always encloses its children. Lives at ModelView
    // level (rather than per-Package via watch) because the per-package
    // reactive chain misses cases like:
    //   - the inner package CSS-grew past its saved size (the parent's
    //     contentMinSize watch fires off the saved size, not the rendered
    //     one);
    //   - more than one level of nesting where a single tick's worth of
    //     reactivity hasn't propagated to the grandparent yet.
    // Reads each child's *actual* rendered size off the DOM via offsetWidth/
    // offsetHeight (unaffected by the canvas's transform: scale), so growth
    // cascades from leaf to root in a single deterministic pass.
    const DEFAULT_NODE_SIZE = { w: 240, h: 120 }
    function findDiagramEl(id: string): HTMLElement | null {
      const root = canvasAreaRef.value
      if (!root) return null
      return root.querySelector(
        `[data-package-id="${CSS.escape(id)}"], [data-entity-id="${CSS.escape(id)}"], [data-enum-id="${CSS.escape(id)}"]`
      ) as HTMLElement | null
    }
    function cascadeAutoGrowOnce(): boolean {
      const m = model.value
      if (!m) return false
      const cur = layout.value
      const next: Layout = { ...cur }
      let changed = false
      const visit = (pkg: PackageData): void => {
        // Post-order — descend first so children's persisted sizes are up
        // to date by the time we measure them.
        for (const child of pkg.packages) visit(child)
        const allChildren: { id: string }[] = [...pkg.packages, ...pkg.entities, ...pkg.enums]
        let maxX = 0
        let maxY = 0
        for (const child of allChildren) {
          const cl = next[child.id] ?? { x: 0, y: 0 }
          const el = findDiagramEl(child.id)
          const observedW = el?.offsetWidth ?? 0
          const observedH = el?.offsetHeight ?? 0
          const w = Math.max(cl.width ?? 0, observedW) || DEFAULT_NODE_SIZE.w
          const h = Math.max(cl.height ?? 0, observedH) || DEFAULT_NODE_SIZE.h
          maxX = Math.max(maxX, cl.x + w)
          maxY = Math.max(maxY, cl.y + h)
        }
        const pl = next[pkg.id]
        if (!pl) return
        // Unsized packages let CSS handle growth (fit-content + .content
        // min-width/min-height) — no need to materialise a saved size.
        if (pl.width == null && pl.height == null) return
        const ceilGrid = (v: number) => Math.ceil(v / GRID_SIZE) * GRID_SIZE
        const wantedW = ceilGrid(maxX + CONTENT_PADDING * 2)
        const wantedH = ceilGrid(maxY + HEADER_OVERHEAD + CONTENT_PADDING)
        const newW = pl.width != null ? Math.max(pl.width, wantedW) : pl.width
        const newH = pl.height != null ? Math.max(pl.height, wantedH) : pl.height
        if (newW !== pl.width || newH !== pl.height) {
          next[pkg.id] = { ...pl, width: newW, height: newH }
          changed = true
        }
      }
      for (const top of m.packages) visit(top)
      if (changed) layoutBuffer.draft.value = next
      return changed
    }
    // Chrome dimensions used by the cascade math — must match Package.tsx.
    const CONTENT_PADDING = GRID_SIZE
    const HEADER_OVERHEAD = GRID_SIZE * 2
    let cascadeRaf = 0
    function scheduleCascade() {
      if (cascadeRaf) return
      cascadeRaf = requestAnimationFrame(() => {
        cascadeRaf = 0
        // One pass is usually enough (post-order visits children first), but
        // if the DOM hasn't reflowed yet for the new layout we may need a
        // follow-up tick to pick up cascade-driven size changes.
        if (cascadeAutoGrowOnce()) {
          requestAnimationFrame(() => {
            cascadeAutoGrowOnce()
          })
        }
      })
    }
    onBeforeUnmount(() => {
      if (cascadeRaf) cancelAnimationFrame(cascadeRaf)
    })

    /** Push the parsed Zod fields into the inline error pane (no toast — useMutation already toasted). */
    function applyFieldsError(parsed: ParsedTrpcError) {
      if (parsed.fields.length > 0) {
        detailedErrors.value = parsed.fields.map((f) => ({ message: f.message, path: f.path }))
        error.value = null
      } else {
        detailedErrors.value = null
        error.value = parsed.message
      }
    }

    const updateLayoutMutation = useMutation(
      (next: Layout) => trpc.model.updateLayout.mutate({ layout: next }),
      { onError: applyFieldsError, onSuccess: () => layoutBuffer.commit() }
    )
    /** Layout cleanup after moveToPackage — silent (compound op already toasted on failure). */
    const updateLayoutSilentMutation = useMutation(
      (next: Layout) => trpc.model.updateLayout.mutate({ layout: next }),
      { notify: false, onSuccess: () => layoutBuffer.commit() }
    )

    function saveLayout() {
      void updateLayoutMutation.run(layout.value)
    }

    function cancelLayout() {
      layoutBuffer.revert()
    }

    // ── Zero-point reset (C5) ───────────────────────────────────────────────
    // Crosshair-driven re-origin: user picks a point on the canvas; we shift
    // every top-level package's layout entry so the clicked point becomes
    // the new (0,0). Nested entities are package-relative, so their stored
    // x/y stays valid — only the top-level frame moves.
    const zeroPointMode = ref(false)
    function enterZeroPointMode() {
      zeroPointMode.value = true
    }
    function cancelZeroPoint() {
      zeroPointMode.value = false
    }
    function onPickZeroPoint(pt: { x: number; y: number }) {
      if (!model.value) return
      zeroPointMode.value = false
      // Snap the picked origin to the canvas grid so top-level packages
      // remain grid-aligned after re-centring (otherwise the shift would
      // bake the pick's sub-pixel jitter into every saved layout entry).
      const dx = snap(pt.x, GRID_SIZE)
      const dy = snap(pt.y, GRID_SIZE)
      const next: Layout = { ...layout.value }
      for (const pkg of model.value.packages) {
        const entry = next[pkg.id] ?? { x: 0, y: 0 }
        next[pkg.id] = { ...entry, x: (entry.x ?? 0) - dx, y: (entry.y ?? 0) - dy }
      }
      layoutBuffer.draft.value = next
      void updateLayoutMutation.run(next)
    }

    // Add-entity dialog state. The dialog `loading`/`saving` state comes from
    // the corresponding useMutation's `loading` ref — no parallel saving refs.
    const entityDialog = ref(false)
    const makeBlankEntity = (): JsonObject => ({ name: '' })
    const newEntity = ref<JsonObject>(makeBlankEntity())
    const targetPackage = ref<PackageData | null>(null)

    // Add-enum dialog state
    const enumDialog = ref(false)
    const makeBlankEnum = (): JsonObject => ({ name: '' })
    const newEnum = ref<JsonObject>(makeBlankEnum())

    // Add-package dialog state
    const pkgDialog = ref(false)
    const makeBlankPkg = (): Record<string, unknown> => ({ name: '' })
    const newPkg = ref<Record<string, unknown>>(makeBlankPkg())

    // Add-attribute dialog state — driven by Attribute entity definition
    const attrDialog = ref(false)
    const targetEntity = ref<EntityData | null>(null)
    const makeBlankAttribute = (): Record<string, unknown> => ({
      name: '',
      type: 'string',
      required: false,
      multiValue: false,
      primaryKey: false,
      unique: false,
    })
    const newAttribute = ref<Record<string, unknown>>(makeBlankAttribute())

    // Side-panel edit buffers. baseline = last-saved snapshot; draft = pending
    // edits; dirty drives the Save/Cancel pill. Attribute also carries its
    // owning entity (the buffer only holds the attribute itself).
    const attrBuffer = useEditBuffer<Attribute>()
    const selectedAttrEntity = ref<EntityData | null>(null)
    const entityBuffer = useEditBuffer<EntityData>()
    const enumBuffer = useEditBuffer<EnumData>()
    const packageBuffer = useEditBuffer<PackageData>()
    const modelBuffer = useEditBuffer<Model>()

    // Selection mirror — exposed to the rest of the app via the `model`
    // module's `useModelSelectionStore` (cross-module access pattern).
    // The five edit buffers above stay as the local source of truth for
    // form state; this store carries only the kind+id for observers.
    const selectionStore = useModelSelectionStore()
    const prefs = useLocalStorageStore()
    // Left structure tree panel width — drag-resizable via PanelDivider.
    // Clamp matches the other resizable panels in the app (180–420).
    const { width: treePanelWidth, onResize: onResizeTreePanel } = usePanelResize(260, 180, 420)
    watch(
      [
        attrBuffer.baseline,
        entityBuffer.baseline,
        enumBuffer.baseline,
        packageBuffer.baseline,
        modelBuffer.baseline,
      ],
      ([a, e, en, p, m]) => {
        if (a)
          selectionStore.select({
            kind: 'attribute',
            id: a.id,
            entityId: selectedAttrEntity.value?.id,
          })
        else if (e) selectionStore.select({ kind: 'entity', id: e.id })
        else if (en) selectionStore.select({ kind: 'enum', id: en.id })
        else if (p) selectionStore.select({ kind: 'package', id: p.id })
        else if (m) selectionStore.select({ kind: 'model', id: m.id })
        else selectionStore.clear()
      }
    )
    // True when the user has any element selected (a property panel is
    // open). Drives the "dim non-selected" view option.
    const hasSelection = computed(() => selectionStore.current != null)

    /**
     * Ids of nodes on the current selection's lineage: the selected node
     * itself plus every ancestor package up to the root. Used by the
     * "dim non-selected" pass so the selected node and the path leading
     * to it stay at full opacity while everything else fades. Empty set
     * when nothing is selected (i.e. dim pass is off).
     */
    const preservedIds = computed<Set<string>>(() => {
      const m = model.value
      const sel = selectionStore.current
      if (!m || !sel) return new Set()
      const targetId = sel.kind === 'attribute' && sel.entityId ? sel.entityId : sel.id
      const ids = new Set<string>([targetId])
      // DFS through the package tree; on hit, register every ancestor.
      const visit = (pkg: PackageData, path: string[]): boolean => {
        const here = [...path, pkg.id]
        const hit =
          pkg.id === targetId ||
          pkg.entities.some((e) => e.id === targetId) ||
          pkg.enums.some((e) => e.id === targetId)
        if (hit) {
          for (const id of here) ids.add(id)
          return true
        }
        for (const child of pkg.packages) {
          if (visit(child, here)) return true
        }
        return false
      }
      for (const top of m.packages) visit(top, [])
      return ids
    })

    /** Master switch for the dim pass — pref on + something selected. */
    const dimNonSelected = computed(
      () => prefs.diagramDimNonSelected && selectionStore.current != null
    )

    /**
     * Id of the diagram node that should render the primary "selected" ring.
     * For attribute selections the *owning entity* is the visible target
     * (we don't render attributes as their own diagram nodes). Threaded
     * through the Package tree so every Entity/Enum/Package can light up
     * without ModelView having to pass a `selected` prop into every nested
     * render.
     */
    const selectedDiagramId = computed<string | null>(() => {
      const sel = selectionStore.current
      if (!sel) return null
      if (sel.kind === 'attribute') return sel.entityId ?? null
      if (sel.kind === 'entity' || sel.kind === 'enum' || sel.kind === 'package') {
        return sel.id
      }
      return null
    })

    // Live selection of an entity / enum / package — drives the mini
    // toolbar (which add-actions to surface, what to move). Attribute
    // selection deliberately excluded: attributes are scoped to an
    // entity and aren't first-class draggable diagram nodes.
    type Selection =
      | { kind: 'entity'; entity: EntityData; packageId: string | undefined }
      | { kind: 'enum'; enum: EnumData; packageId: string | undefined }
      | { kind: 'package'; package: PackageData }
    const selection = computed<Selection | null>(() => {
      const e = entityBuffer.baseline.value
      if (e) {
        const m = model.value
        const owner = m
          ? getAllPackages(m).find((p) => p.entities.some((x) => x.id === e.id))
          : undefined
        return { kind: 'entity', entity: e, packageId: owner?.id }
      }
      const en = enumBuffer.baseline.value
      if (en) {
        const m = model.value
        const owner = m
          ? getAllPackages(m).find((p) => p.enums.some((x) => x.id === en.id))
          : undefined
        return { kind: 'enum', enum: en, packageId: owner?.id }
      }
      const p = packageBuffer.baseline.value
      if (p) return { kind: 'package', package: p }
      return null
    })

    /**
     * Flat list of packages eligible as a move target for the current
     * selection. Excludes the selection itself, the selection's own
     * package (already there), and — for package moves — any descendant
     * of the selection. Labels carry the dotted path so duplicate names
     * in different parents disambiguate.
     */
    const movableTargets = computed<{ id: string; label: string }[]>(() => {
      const m = model.value
      if (!m || !selection.value) return []
      const all = getAllPackages(m)
      const paths = new Map<string, string>()
      const walk = (pkgs: PackageData[], prefix: string) => {
        for (const p of pkgs) {
          const path = prefix ? `${prefix}.${p.name}` : p.name
          paths.set(p.id, path)
          walk(p.packages, path)
        }
      }
      walk(m.packages, '')
      const excluded = new Set<string>()
      const sel = selection.value
      if (sel.kind === 'package') {
        excluded.add(sel.package.id)
        const collectDescendants = (pkg: PackageData) => {
          for (const c of pkg.packages) {
            excluded.add(c.id)
            collectDescendants(c)
          }
        }
        collectDescendants(sel.package)
      } else if (sel.packageId) {
        excluded.add(sel.packageId)
      }
      return all
        .filter((p) => !excluded.has(p.id))
        .map((p) => ({ id: p.id, label: paths.get(p.id) ?? p.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
    })

    function moveSelectionToPackage(targetPackageId: string) {
      const sel = selection.value
      if (!sel) return
      const payload =
        sel.kind === 'entity'
          ? { type: 'entity' as const, id: sel.entity.id, targetPackageId }
          : sel.kind === 'enum'
            ? { type: 'enum' as const, id: sel.enum.id, targetPackageId }
            : { type: 'package' as const, id: sel.package.id, targetPackageId }
      void moveToPackage(payload)
    }

    /**
     * Anchor (canvas-area-local pixel coords) at which to float the mini
     * toolbar so it pops up next to the selected node. Recomputed every
     * frame while a selection is active — the canvas pans/zooms and the
     * node may drag, all of which change the screen position. When no
     * node DOM element is found (selection just landed, not yet
     * rendered, or item is off-screen), `null` falls back to the
     * default top-left placement.
     */
    const canvasAreaRef = ref<HTMLElement | null>(null)
    const toolbarAnchor = ref<{ top: number; left: number } | null>(null)
    const TOOLBAR_GAP = 8

    function recomputeToolbarAnchor() {
      const sel = selection.value
      const root = canvasAreaRef.value
      if (!sel || !root) {
        toolbarAnchor.value = null
        return
      }
      const selector =
        sel.kind === 'entity'
          ? `[data-entity-id="${CSS.escape(sel.entity.id)}"]`
          : sel.kind === 'enum'
            ? `[data-enum-id="${CSS.escape(sel.enum.id)}"]`
            : `[data-package-id="${CSS.escape(sel.package.id)}"]`
      const el = root.querySelector(selector) as HTMLElement | null
      if (!el) {
        toolbarAnchor.value = null
        return
      }
      const nodeRect = el.getBoundingClientRect()
      const areaRect = root.getBoundingClientRect()
      // Measure the toolbar's own size so we can clamp it inside the
      // canvasArea — otherwise a node near the right edge would let
      // the toolbar overflow into the side property panel.
      const toolbarEl = root.querySelector(
        '[role="toolbar"][aria-label="Model view toolbar"]'
      ) as HTMLElement | null
      const tbW = toolbarEl?.offsetWidth ?? 0
      const tbH = toolbarEl?.offsetHeight ?? 0
      const maxLeft = Math.max(0, areaRect.width - tbW - TOOLBAR_GAP)
      const maxTop = Math.max(0, areaRect.height - tbH - TOOLBAR_GAP)
      // Anchor above the node, aligned to the node's left edge so the
      // toolbar appears at the corner the user is most likely looking at.
      const next = {
        top: Math.min(maxTop, Math.max(0, nodeRect.top - areaRect.top - 44 - TOOLBAR_GAP)),
        left: Math.min(maxLeft, Math.max(0, nodeRect.left - areaRect.left)),
      }
      // Skip reactive updates when the change is sub-pixel — keeps the
      // rAF loop from triggering 60 toolbar re-renders per second when
      // nothing visibly moves.
      const prev = toolbarAnchor.value
      if (!prev || Math.abs(prev.top - next.top) >= 0.5 || Math.abs(prev.left - next.left) >= 0.5) {
        toolbarAnchor.value = next
      }
    }

    let anchorRafId = 0
    function tickAnchor() {
      if (!selection.value) {
        anchorRafId = 0
        return
      }
      recomputeToolbarAnchor()
      anchorRafId = requestAnimationFrame(tickAnchor)
    }
    watch(selection, (s) => {
      if (anchorRafId) cancelAnimationFrame(anchorRafId)
      if (s) {
        anchorRafId = requestAnimationFrame(tickAnchor)
      } else {
        toolbarAnchor.value = null
        anchorRafId = 0
      }
    })
    onBeforeUnmount(() => {
      if (anchorRafId) cancelAnimationFrame(anchorRafId)
    })

    /**
     * Scene toolbar visibility + anchor. Pops up when the user clicks
     * the empty canvas background (DiagramCanvas emits
     * `background-click`); cleared by the toolbar's close button or
     * when the user selects an item (which lets the item toolbar take
     * over instead).
     */
    const sceneToolbarAnchor = ref<{ top: number; left: number } | null>(null)
    function onCanvasBackgroundClick(payload: { top: number; left: number }) {
      // If something is selected, treat the empty-canvas click as a
      // deselect — that's the common-sense behavior for any selection
      // tool. The scene toolbar stays hidden so the click reads as
      // "clear" rather than "open a different menu."
      if (selectionStore.current) {
        closeSelection()
        return
      }
      // Slight offset so the toolbar appears next to the cursor, not
      // exactly under it (which would block the click target).
      sceneToolbarAnchor.value = {
        top: Math.max(0, payload.top + 8),
        left: Math.max(0, payload.left + 8),
      }
    }
    watch(selection, (s) => {
      if (s) sceneToolbarAnchor.value = null
    })

    /** Clear every panel buffer — used by the toolbar's close button. */
    function closeSelection() {
      clearAllPanelsExcept('none')
    }

    // Self-describing forms: editors render from model.json's own definitions
    const attributeEntity = useModelEntity(model, 'Attribute')
    const entityEntity = useModelEntity(model, 'Entity')
    const enumEntity = useModelEntity(model, 'Enum')
    const packageEntity = useModelEntity(model, 'Package')
    const modelEntity = useModelEntity(model, 'Model')

    type MoveToPackagePayload = {
      type: 'entity' | 'enum' | 'package'
      id: string
      targetPackageId?: string
      index?: number
    }
    const moveToPackageMutation = useMutation(
      (payload: MoveToPackagePayload) => trpc.model.moveToPackage.mutate(payload),
      {
        onError: applyFieldsError,
        onSuccess: (result, payload) => {
          model.value = result
          // Reset layout for the moved item — its previous (x,y) was relative
          // to the old parent. Drop the entry so it appears at (0,0) in the
          // new parent, then persist the cleanup as the new baseline.
          if (layout.value[payload.id]) {
            const next = { ...layout.value }
            delete next[payload.id]
            layoutBuffer.draft.value = next
            void updateLayoutSilentMutation.run(next)
          }
        },
      }
    )

    async function moveToPackage(payload: MoveToPackagePayload) {
      if (!model.value) return
      await moveToPackageMutation.run(payload)
    }

    const notifications = useNotificationsStore()

    /**
     * Surface a tRPC failure. Server-returned Zod field errors land in
     * `detailedErrors` for inline rendering; the top-level message goes to
     * `error` and (unless `{ silent: true }`) a toast. Replaces the legacy
     * hand-rolled JSON.parse(e.message) heuristic which mis-classified every
     * non-Zod failure as a transport error.
     */
    function reportError(e: unknown, opts: { silent?: boolean } = {}) {
      const parsed = parseTrpcError(e)
      if (parsed.fields.length > 0) {
        detailedErrors.value = parsed.fields.map((f) => ({ message: f.message, path: f.path }))
        error.value = null
      } else {
        detailedErrors.value = null
        error.value = parsed.message
      }
      if (!opts.silent) notifications.error(parsed.message)
    }

    async function loadModel() {
      loading.value = true
      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.get.query(selectorInput.value)
        // Normalise to grid multiples so any legacy layout authored before
        // CSS padding was aligned with GRID_SIZE doesn't carry sub-grid
        // values into the canvas. Saved values from then on are always
        // grid-aligned (drag and resize snap on every event).
        layoutBuffer.set(normalizeLayoutToGrid(model.value?.layout ?? {}))
      } catch (e) {
        // Silent: the full-page error banner shows the failure; no toast on top.
        reportError(e, { silent: true })
      } finally {
        loading.value = false
      }
    }

    // Reload the editor whenever the workspace selection changes. The store's
    // `selectModel` / `selectProject` actions only mutate refs — the actual
    // model.json fetch lives here so ModelView owns its own loading lifecycle.
    watch(
      () => [workspace.activeProjectRoot, workspace.activeModelId] as const,
      ([root, modelId], prev) => {
        if (!root) return
        // Skip the initial fire — onMounted already calls loadModel once.
        // Only reload on actual changes after first hydration.
        if (prev && prev[0] === root && prev[1] === modelId) return
        if (!prev) return
        void loadModel()
      }
    )

    type AddEntityArgs = Parameters<typeof trpc.model.addEntity.mutate>[0]
    const addEntityMutation = useMutation(
      (args: AddEntityArgs) => trpc.model.addEntity.mutate(args),
      {
        onError: applyFieldsError,
        onSuccess: (result) => {
          model.value = result
          entityDialog.value = false
          newEntity.value = makeBlankEntity()
        },
      }
    )

    async function addEntity() {
      const name = String(newEntity.value.name ?? '').trim()
      if (!name || !model.value || !targetPackage.value) return
      // Uniqueness is enforced server-side by PackageSchema.superRefine; any
      // violation surfaces via the toast + applyFieldsError → inline VAlert.
      error.value = null
      detailedErrors.value = null
      await addEntityMutation.run({
        packageId: targetPackage.value.id,
        entity: {
          ...newEntity.value,
          id: crypto.randomUUID(),
          name,
          attributes: [],
        } as AddEntityArgs['entity'],
      })
    }

    type AddPackageArgs = Parameters<typeof trpc.model.addPackage.mutate>[0]
    const addPackageMutation = useMutation(
      (args: AddPackageArgs) => trpc.model.addPackage.mutate(args),
      {
        onError: applyFieldsError,
        onSuccess: (result) => {
          model.value = result
          pkgDialog.value = false
          newPkg.value = makeBlankPkg()
        },
      }
    )

    async function addPackage(parentId?: string) {
      const name = String(newPkg.value.name ?? '').trim()
      if (!name || !model.value) return
      // Server-side uniqueness via PackageSchema.superRefine.
      error.value = null
      detailedErrors.value = null
      await addPackageMutation.run({
        parentId,
        package: {
          ...newPkg.value,
          id: crypto.randomUUID(),
          name,
          packages: [],
          enums: [],
          entities: [],
        } as AddPackageArgs['package'],
      })
    }

    type AddEnumArgs = Parameters<typeof trpc.model.addEnum.mutate>[0]
    const addEnumMutation = useMutation((args: AddEnumArgs) => trpc.model.addEnum.mutate(args), {
      onError: applyFieldsError,
      onSuccess: (result) => {
        model.value = result
        enumDialog.value = false
        newEnum.value = makeBlankEnum()
      },
    })

    async function addEnum() {
      const name = String(newEnum.value.name ?? '').trim()
      if (!name || !model.value || !targetPackage.value) return
      // Server-side uniqueness via PackageSchema.superRefine.
      error.value = null
      detailedErrors.value = null
      await addEnumMutation.run({
        packageId: targetPackage.value.id,
        enum: {
          ...newEnum.value,
          id: crypto.randomUUID(),
          name,
          values: [],
        } as AddEnumArgs['enum'],
      })
    }

    watch(
      [entityDialog, enumDialog, pkgDialog, attrDialog],
      ([entity, en, pkg, attr]: boolean[]) => {
        if (!entity && !en && !pkg && !attr) {
          error.value = null
          detailedErrors.value = null
        }
      }
    )

    async function openAddEntity(pkg: PackageData) {
      targetPackage.value = pkg
      newEntity.value = makeBlankEntity()
      detailedErrors.value = null
      entityDialog.value = true
    }

    async function openAddEnum(pkg: PackageData) {
      targetPackage.value = pkg
      newEnum.value = makeBlankEnum()
      detailedErrors.value = null
      enumDialog.value = true
    }

    async function openAddPackage(pkg?: PackageData) {
      targetPackage.value = pkg || null
      newPkg.value = makeBlankPkg()
      // Seed the very first top-level package with the project name so the
      // user can confirm with Enter instead of typing it out. Sub-packages
      // and any subsequent root packages start blank.
      if (!pkg && (model.value?.packages.length ?? 0) === 0 && projectName.value) {
        newPkg.value.name = projectName.value
      }
      detailedErrors.value = null
      pkgDialog.value = true
    }

    async function openAddAttribute(entity: EntityData) {
      targetEntity.value = entity
      newAttribute.value = makeBlankAttribute()
      detailedErrors.value = null
      attrDialog.value = true
    }

    type AddAttributeArgs = Parameters<typeof trpc.model.addAttribute.mutate>[0]
    const addAttributeMutation = useMutation(
      (args: AddAttributeArgs) => trpc.model.addAttribute.mutate(args),
      {
        onError: applyFieldsError,
        onSuccess: (result) => {
          model.value = result
          attrDialog.value = false
        },
      }
    )

    async function addAttribute() {
      const name = String(newAttribute.value.name ?? '').trim()
      if (!name || !targetEntity.value || !model.value) return
      // Server-side uniqueness via EntitySchema.superRefine.
      error.value = null
      detailedErrors.value = null
      await addAttributeMutation.run({
        entityId: targetEntity.value.id,
        attribute: {
          ...newAttribute.value,
          id: crypto.randomUUID(),
          name,
        } as AddAttributeArgs['attribute'],
      })
    }

    /** Clear all side-panel buffers except the one we're about to populate. */
    function clearAllPanelsExcept(keep: 'attr' | 'entity' | 'enum' | 'package' | 'model' | 'none') {
      if (keep !== 'attr') {
        attrBuffer.set(null)
        selectedAttrEntity.value = null
      }
      if (keep !== 'entity') entityBuffer.set(null)
      if (keep !== 'enum') enumBuffer.set(null)
      if (keep !== 'package') packageBuffer.set(null)
      if (keep !== 'model') modelBuffer.set(null)
    }

    function selectAttribute(entity: EntityData, attribute: Attribute) {
      clearAllPanelsExcept('attr')
      selectedAttrEntity.value = entity
      attrBuffer.set(attribute)
    }

    function selectEntity(entity: EntityData) {
      clearAllPanelsExcept('entity')
      entityBuffer.set(entity)
    }

    function selectEnum(en: EnumData) {
      clearAllPanelsExcept('enum')
      enumBuffer.set(en)
    }

    function selectPackage(pkg: PackageData) {
      clearAllPanelsExcept('package')
      packageBuffer.set(pkg)
    }

    type UpdateAttributeArgs = Parameters<typeof trpc.model.updateAttribute.mutate>[0]
    const updateAttributeMutation = useMutation(
      (args: UpdateAttributeArgs) => trpc.model.updateAttribute.mutate(args),
      {
        onError: (e) => {
          applyFieldsError(e)
          attrBuffer.revert()
        },
        onSuccess: (result) => {
          model.value = result
          attrBuffer.commit()
        },
      }
    )

    async function updateAttribute() {
      const draft = attrBuffer.draft.value
      const entity = selectedAttrEntity.value
      const baseline = attrBuffer.baseline.value
      if (!draft || !entity || !baseline || !model.value) return
      // Server-side uniqueness via EntitySchema.superRefine.
      error.value = null
      detailedErrors.value = null
      await updateAttributeMutation.run({ entityId: entity.id, attribute: draft })
    }

    const updateEntityMutation = useMutation(
      (entity: EntityData) => trpc.model.updateEntity.mutate({ entity }),
      {
        onError: (e) => {
          applyFieldsError(e)
          entityBuffer.revert()
        },
        onSuccess: (result) => {
          model.value = result
          entityBuffer.commit()
        },
      }
    )

    async function updateEntity() {
      const draft = entityBuffer.draft.value
      if (!draft || !entityBuffer.baseline.value || !model.value) return
      // Server-side uniqueness via PackageSchema.superRefine.
      error.value = null
      detailedErrors.value = null
      await updateEntityMutation.run(draft)
    }

    const updateEnumMutation = useMutation(
      (en: EnumData) => trpc.model.updateEnum.mutate({ enum: en }),
      {
        onError: (e) => {
          applyFieldsError(e)
          enumBuffer.revert()
        },
        onSuccess: (result) => {
          model.value = result
          enumBuffer.commit()
        },
      }
    )

    async function updateEnum() {
      const draft = enumBuffer.draft.value
      if (!draft || !enumBuffer.baseline.value || !model.value) return
      // Server-side uniqueness via PackageSchema.superRefine (name) +
      // EnumSchema.superRefine (value names).
      error.value = null
      detailedErrors.value = null
      await updateEnumMutation.run(draft)
    }

    const updatePackageMutation = useMutation(
      (pkg: PackageData) => trpc.model.updatePackage.mutate({ package: pkg }),
      {
        onError: (e) => {
          applyFieldsError(e)
          packageBuffer.revert()
        },
        onSuccess: (result) => {
          model.value = result
          packageBuffer.commit()
        },
      }
    )

    async function updatePackage() {
      const draft = packageBuffer.draft.value
      if (!draft || !packageBuffer.baseline.value || !model.value) return
      // Server-side uniqueness via PackageSchema.superRefine.
      error.value = null
      detailedErrors.value = null
      await updatePackageMutation.run(draft)
    }

    const saveModelMutation = useMutation(
      (next: Model) => trpc.model.save.mutate({ model: next }),
      {
        onError: (e) => {
          applyFieldsError(e)
          modelBuffer.revert()
        },
        onSuccess: (result) => {
          model.value = result
          modelBuffer.commit()
        },
      }
    )

    async function updateModelProperties() {
      const draft = modelBuffer.draft.value
      if (!draft) return
      error.value = null
      detailedErrors.value = null
      await saveModelMutation.run(draft)
    }

    type ReorderAttributesArgs = Parameters<typeof trpc.model.reorderAttributes.mutate>[0]
    const reorderAttributesMutation = useMutation(
      (args: ReorderAttributesArgs) => trpc.model.reorderAttributes.mutate(args),
      { onError: applyFieldsError, onSuccess: (result) => (model.value = result) }
    )
    type ReorderEnumValuesArgs = Parameters<typeof trpc.model.reorderEnumValues.mutate>[0]
    const reorderEnumValuesMutation = useMutation(
      (args: ReorderEnumValuesArgs) => trpc.model.reorderEnumValues.mutate(args),
      { onError: applyFieldsError, onSuccess: (result) => (model.value = result) }
    )

    const { confirm } = useConfirm()

    type DeleteAttributeArgs = Parameters<typeof trpc.model.deleteAttribute.mutate>[0]
    const deleteAttributeMutation = useMutation(
      (args: DeleteAttributeArgs) => trpc.model.deleteAttribute.mutate(args),
      {
        onError: applyFieldsError,
        onSuccess: (result) => {
          model.value = result
          attrBuffer.set(null)
          selectedAttrEntity.value = null
        },
      }
    )
    const deleteEntityMutation = useMutation(
      (id: string) => trpc.model.deleteEntity.mutate({ id }),
      {
        onError: applyFieldsError,
        onSuccess: (result) => {
          model.value = result
          entityBuffer.set(null)
        },
      }
    )
    const deleteEnumMutation = useMutation((id: string) => trpc.model.deleteEnum.mutate({ id }), {
      onError: applyFieldsError,
      onSuccess: (result) => {
        model.value = result
        enumBuffer.set(null)
      },
    })
    const deletePackageMutation = useMutation(
      (id: string) => trpc.model.deletePackage.mutate({ id }),
      {
        onError: applyFieldsError,
        onSuccess: (result) => {
          model.value = result
          packageBuffer.set(null)
        },
      }
    )

    async function deleteAttribute() {
      const attr = attrBuffer.baseline.value
      const entity = selectedAttrEntity.value
      if (!attr || !entity || !model.value) return

      confirm({
        title: 'Delete Attribute',
        message: `Are you sure you want to delete attribute "${attr.name}"?`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: () =>
          deleteAttributeMutation.run({ entityId: entity.id, attributeId: attr.id }).then(() => {}),
      })
    }

    async function deleteEntity() {
      const entity = entityBuffer.baseline.value
      if (!entity || !model.value) return

      confirm({
        title: 'Delete Entity',
        message: `Are you sure you want to delete entity "${entity.name}"? This will also delete all its attributes.`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: () => deleteEntityMutation.run(entity.id).then(() => {}),
      })
    }

    async function deleteEnum() {
      const en = enumBuffer.baseline.value
      if (!en || !model.value) return

      confirm({
        title: 'Delete Enum',
        message: `Are you sure you want to delete enum "${en.name}"?`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: () => deleteEnumMutation.run(en.id).then(() => {}),
      })
    }

    async function deletePackage() {
      const pkg = packageBuffer.baseline.value
      if (!pkg || !model.value) return

      await confirm({
        title: 'Delete Package',
        message: `Are you sure you want to delete package "${pkg.name}"? This will also delete all its contents recursively.`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: () => deletePackageMutation.run(pkg.id).then(() => {}),
      })
    }

    function addEnumValue() {
      const draft = enumBuffer.draft.value
      if (!draft) return

      const existingNames = new Set(draft.values.map((v) => v.name))
      let newName = 'NEW_VALUE'
      let counter = 1
      while (existingNames.has(newName)) {
        newName = `NEW_VALUE_${counter}`
        counter++
      }

      draft.values.push({ id: crypto.randomUUID(), name: newName })
    }

    function deleteEnumValue(valueId: string) {
      const draft = enumBuffer.draft.value
      if (!draft) return
      draft.values = draft.values.filter((v) => v.id !== valueId)
    }

    const versionApi = useVersion()
    const modelVersionError = computed(() => {
      const v = (modelBuffer.draft.value?.version as string | undefined) ?? ''
      return versionApi.validateEdit(v, versionLabels.value)
    })

    // Cancel handlers: discard buffer + clear inline validation errors.
    function cancelAttribute() {
      attrBuffer.set(null)
      selectedAttrEntity.value = null
      detailedErrors.value = null
    }
    function cancelEntity() {
      entityBuffer.set(null)
      detailedErrors.value = null
    }
    function cancelEnum() {
      enumBuffer.set(null)
      detailedErrors.value = null
    }
    function cancelPackage() {
      packageBuffer.set(null)
      detailedErrors.value = null
    }
    function cancelModelProperties() {
      modelBuffer.set(null)
      detailedErrors.value = null
    }

    // Diagram-relevant project settings (list-cap thresholds), loaded once on
    // mount. Fed to DiagramCanvas as CSS custom properties so Entity / Enum
    // SCSS can cap their scrollable lists without each component
    // re-fetching the settings.
    const diagramMaxEntityAttributes = ref(10)
    const diagramMaxEnumValues = ref(10)
    // Project name — used to suggest the name of the very first package the
    // user creates in an otherwise empty model.
    const projectName = ref<string>('')
    async function loadDiagramSettings() {
      try {
        const meta = await trpc.project.meta.query()
        if (!meta) return
        if (typeof meta.name === 'string') projectName.value = meta.name
        if (typeof meta.settings !== 'object' || meta.settings === null) return
        const s: Partial<ProjectSettings> = meta.settings
        if (typeof s.diagramMaxEntityAttributes === 'number') {
          diagramMaxEntityAttributes.value = s.diagramMaxEntityAttributes
        }
        if (typeof s.diagramMaxEnumValues === 'number') {
          diagramMaxEnumValues.value = s.diagramMaxEnumValues
        }
      } catch {
        // No project file yet, or load failed — defaults remain.
      }
    }
    /**
     * Effective dim opacity for non-selected diagram items:
     *   1 (full opacity) when the toggle is off or nothing is selected;
     *   `1 - diagramDimAmount` otherwise.
     * Surfaced as a CSS custom property so Package / Entity / Enum stay
     * pure-CSS — no per-component prop plumbing required.
     */
    const dimOpacity = computed(() => {
      if (!prefs.diagramDimNonSelected || !hasSelection.value) return 1
      return Math.max(0, Math.min(1, 1 - prefs.diagramDimAmount))
    })

    const diagramSettingsStyle = computed(() => ({
      '--diagram-max-entity-attributes': String(diagramMaxEntityAttributes.value),
      '--diagram-max-enum-values': String(diagramMaxEnumValues.value),
      '--xomda-dim-opacity': String(dimOpacity.value),
    }))

    onMounted(() => {
      loadModel()
      loadVersionLabels()
      loadDiagramSettings()
    })

    const route = useRoute()
    const router = useRouter()

    /** All user-defined type names (entities + enums), sorted — for attribute-type pickers. */
    function userDefinedTypeNames(): string[] {
      const m = model.value
      if (!m) return []
      return [...getAllEntities(m), ...getAllEnums(m)].map((x) => x.name).sort()
    }

    function findAndSelect(id: string): boolean {
      const m = model.value
      if (!m) return false
      const pkg = findPackageById(m, id)
      if (pkg) {
        selectPackage(pkg)
        return true
      }
      const entity = findEntityById(m, id)
      if (entity) {
        selectEntity(entity)
        return true
      }
      const enm = findEnumById(m, id)
      if (enm) {
        selectEnum(enm)
        return true
      }
      return false
    }

    watch(
      [() => route.query.select, model],
      ([selectId]) => {
        const id = typeof selectId === 'string' ? selectId : ''
        if (!id || !model.value) return
        if (findAndSelect(id)) {
          // One-shot: clear the query param so re-clicking the same hit re-fires.
          void router.replace({ name: ModelRoutes.view, query: {} })
        }
      },
      { immediate: true }
    )

    const inheritedAttributesByEntityId = computed<Record<string, Attribute[]>>(() => {
      const m = model.value
      if (!m) return {}
      const out: Record<string, Attribute[]> = {}
      const collectFromPackage = (pkg: Model['packages'][number]) => {
        for (const e of pkg.entities) {
          out[e.id] = getInheritedAttributes(e, m)
        }
        for (const child of pkg.packages) collectFromPackage(child)
      }
      for (const p of m.packages) collectFromPackage(p)
      return out
    })

    const rootElements = computed(() => {
      if (!model.value) return []
      return model.value.packages.map((p) => ({ type: 'package' as const, data: p }))
    })

    return () => (
      <div class="d-flex flex-column h-100">
        <AppTitleBar>
          {{
            title: () => {
              const viewMenuItems = (): MenuItemConfig[] => [
                { subheader: 'View' },
                {
                  title: prefs.modelTreeCollapsed ? 'Show structure panel' : 'Hide structure panel',
                  onClick: () => (prefs.modelTreeCollapsed = !prefs.modelTreeCollapsed),
                },
              ]
              return (
                <div class="d-flex align-center ga-3">
                  <MenuButton
                    tooltip="Model view options"
                    ariaLabel="Model view options"
                    items={viewMenuItems()}
                  />
                  <WorkspaceSelector labelPrefix="Model" />
                  <VBtn
                    prepend-icon={AddIcon}
                    variant="tonal"
                    color="primary"
                    size="small"
                    onClick={() => openAddPackage()}
                  >
                    Add package
                  </VBtn>
                  <VDivider vertical class="mx-1" />
                  <VTooltip
                    text={
                      prefs.diagramGridSnap
                        ? 'Snap to grid (on): pan moves in grid steps'
                        : 'Snap to grid: pan moves in grid steps'
                    }
                    location="bottom"
                  >
                    {{
                      activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                        <VBtn
                          {...tipProps}
                          icon={Grid3x3RoundedIcon}
                          variant={prefs.diagramGridSnap ? 'tonal' : 'text'}
                          color={prefs.diagramGridSnap ? 'primary' : undefined}
                          size="small"
                          density="comfortable"
                          aria-label="Snap scene panning to grid"
                          aria-pressed={prefs.diagramGridSnap ? 'true' : 'false'}
                          onClick={() => (prefs.diagramGridSnap = !prefs.diagramGridSnap)}
                        />
                      ),
                    }}
                  </VTooltip>
                </div>
              )
            },
            actions: () => {
              // Per-model version histories are scoped to the primary model
              // in v1 (commitVersion throws BAD_REQUEST otherwise — see
              // model.router.ts). Hide Publish entirely on secondaries; a
              // disabled chip with a tooltip explains the constraint without
              // crowding the toolbar.
              const isSecondary = workspace.activeModel ? !workspace.activeModel.isPrimary : false
              if (isSecondary) {
                return (
                  <VTooltip
                    text="Per-model version histories are a follow-up — publish from the primary model."
                    location="bottom"
                  >
                    {{
                      activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                        <VBtn
                          {...tipProps}
                          variant="tonal"
                          disabled
                          aria-label="Publish disabled for secondary models"
                        >
                          Publish
                        </VBtn>
                      ),
                    }}
                  </VTooltip>
                )
              }
              return (
                <VBtn
                  prepend-icon={SaveIcon}
                  variant="tonal"
                  color="primary"
                  onClick={() => (commitOpen.value = true)}
                >
                  Publish
                </VBtn>
              )
            },
          }}
        </AppTitleBar>
        <CommitModal
          v-model={commitOpen.value}
          currentVersion={model.value?.version ?? ''}
          knownVersionLabels={versionLabels.value}
          onCommitted={() => {
            loadModel()
            loadVersionLabels()
          }}
        />

        <div class={styles.main}>
          {showLoading.value && (
            <div class={styles.center}>
              <VProgressCircular indeterminate color="primary" />
            </div>
          )}

          {(error.value || detailedErrors.value) &&
            !entityDialog.value &&
            !enumDialog.value &&
            !pkgDialog.value &&
            !attrDialog.value && (
              <div class={[styles.center, 'flex-column']}>
                {detailedErrors.value ? (
                  <div class={['w-100', styles.errorList, 'px-4']}>
                    {detailedErrors.value.map((err, i) => (
                      <VAlert
                        key={i}
                        type="error"
                        variant="tonal"
                        class="mb-2"
                        title="Validation error"
                        text={err.message}
                      />
                    ))}
                  </div>
                ) : (
                  <p class={styles.error}>{error.value}</p>
                )}
                <VBtn variant="tonal" onClick={loadModel}>
                  Retry
                </VBtn>
              </div>
            )}

          {model.value && !loading.value && (
            <div class={styles.canvasContainer}>
              {!prefs.modelTreeCollapsed && (
                <>
                  <div class={styles.treePanel} style={{ width: `${treePanelWidth.value}px` }}>
                    <div class={styles.treePanelHeader}>
                      <div class={styles.treePanelTitle}>Structure</div>
                      <VBtn
                        icon="$close"
                        variant="text"
                        size="small"
                        density="compact"
                        aria-label="Collapse tree panel"
                        onClick={() => (prefs.modelTreeCollapsed = true)}
                      />
                    </div>
                    <div class={styles.treePanelBody}>
                      <ModelTree
                        packages={model.value.packages}
                        onSelectPackage={selectPackage}
                        onSelectEntity={selectEntity}
                        onSelectEnum={selectEnum}
                      />
                    </div>
                  </div>
                  <PanelDivider onResize={onResizeTreePanel} />
                </>
              )}
              <div
                class={styles.canvasArea}
                ref={(el) => {
                  canvasAreaRef.value = el as HTMLElement | null
                }}
              >
                {sceneToolbarAnchor.value && !selection.value && (
                  <SceneMiniToolbar
                    anchor={sceneToolbarAnchor.value}
                    mode={prefs.diagramCanvasMode}
                    onModeChange={(m) => (prefs.diagramCanvasMode = m)}
                    onResetZeroPoint={enterZeroPointMode}
                    onAddPackage={() => {
                      sceneToolbarAnchor.value = null
                      void openAddPackage()
                    }}
                    onClose={() => (sceneToolbarAnchor.value = null)}
                  />
                )}
                <LayoutSavePill
                  dirty={layoutBuffer.dirty.value}
                  onSave={saveLayout}
                  onCancel={cancelLayout}
                />
                <ModelMiniToolbar
                  selection={selection.value}
                  anchor={toolbarAnchor.value}
                  movableTargets={movableTargets.value}
                  onClose={closeSelection}
                  onSwitchToPanMode={() => {
                    prefs.diagramCanvasMode = 'pan'
                    // Hand off to the scene toolbar at the same anchor the
                    // model toolbar was floating at, then clear selection
                    // so the scene toolbar's visibility gate flips on.
                    sceneToolbarAnchor.value = toolbarAnchor.value ?? { top: 16, left: 16 }
                    closeSelection()
                  }}
                  onAddAttribute={() => {
                    const sel = selection.value
                    if (sel?.kind === 'entity') void openAddAttribute(sel.entity)
                  }}
                  onAddEnumValue={() => {
                    const sel = selection.value
                    if (sel?.kind === 'enum') {
                      selectEnum(sel.enum)
                      addEnumValue()
                    }
                  }}
                  onAddEntity={() => {
                    const sel = selection.value
                    if (sel?.kind === 'package') void openAddEntity(sel.package)
                  }}
                  onAddEnum={() => {
                    const sel = selection.value
                    if (sel?.kind === 'package') void openAddEnum(sel.package)
                  }}
                  onAddNestedPackage={() => {
                    const sel = selection.value
                    if (sel?.kind === 'package') void openAddPackage(sel.package)
                  }}
                  onMoveTo={moveSelectionToPackage}
                />
                {model.value.packages.length === 0 && (
                  <div class={styles.emptyModelOverlay}>
                    <VEmptyState
                      icon={PackageIcon}
                      title="No model defined yet"
                      text="Start by adding a package first."
                    >
                      {{
                        actions: () => (
                          <VBtn
                            color="primary"
                            variant="tonal"
                            prependIcon={AddIcon}
                            onClick={() => openAddPackage()}
                          >
                            Add Package
                          </VBtn>
                        ),
                      }}
                    </VEmptyState>
                  </div>
                )}
                <DiagramCanvas
                  class={styles.canvas}
                  layout={layout.value}
                  style={diagramSettingsStyle.value}
                  zeroPointMode={zeroPointMode.value}
                  wheelPanDisabled={hasSelection.value}
                  onPick-zero-point={onPickZeroPoint}
                  onCancel-zero-point={cancelZeroPoint}
                  onBackground-click={onCanvasBackgroundClick}
                >
                  {{
                    default: () => (
                      <>
                        {rootElements.value.map((el) => (
                          <>
                            {el.type === 'package' && (
                              <Package
                                key={el.data.id}
                                package={el.data}
                                inheritedAttributesByEntityId={inheritedAttributesByEntityId.value}
                                selected={selectedDiagramId.value === el.data.id}
                                selectedId={selectedDiagramId.value}
                                dimmed={dimNonSelected.value && !preservedIds.value.has(el.data.id)}
                                dimNonSelected={dimNonSelected.value}
                                preservedIds={preservedIds.value}
                                layout={layout.value[el.data.id] ?? { x: 0, y: 0 }}
                                layouts={layout.value}
                                absolute={true}
                                onEdit-package={selectPackage}
                                onEdit-entity={selectEntity}
                                onEdit-attribute={selectAttribute}
                                onEdit-enum={selectEnum}
                                onEdit-value={selectEnum}
                                onReorder-attributes={(
                                  entity: EntityData,
                                  attributeIds: string[]
                                ) =>
                                  void reorderAttributesMutation.run({
                                    entityId: entity.id,
                                    attributeIds,
                                  })
                                }
                                onReorder-values={(en: EnumData, valueIds: string[]) =>
                                  void reorderEnumValuesMutation.run({ enumId: en.id, valueIds })
                                }
                                onMove-to-package={moveToPackage}
                                onMove={onPackageMove}
                                onResize={onPackageResize}
                                onBackground-click={() => {
                                  // Click on an empty area inside a package
                                  // body deselects, matching the canvas
                                  // background behavior.
                                  if (selectionStore.current) closeSelection()
                                }}
                              >
                                {{
                                  'header-actions': ({
                                    package: pkg,
                                  }: {
                                    package: PackageData
                                  }) => (
                                    <MenuButton
                                      ariaLabel="Package actions"
                                      tooltip="Package actions"
                                      items={[
                                        {
                                          key: 'add-package',
                                          title: 'Add sub-package',
                                          icon: PackageIcon,
                                          onClick: () => openAddPackage(pkg),
                                        },
                                        {
                                          key: 'add-entity',
                                          title: 'Add entity',
                                          icon: EntityIcon,
                                          onClick: () => openAddEntity(pkg),
                                        },
                                        {
                                          key: 'add-enum',
                                          title: 'Add enum',
                                          icon: EnumIcon,
                                          onClick: () => openAddEnum(pkg),
                                        },
                                      ]}
                                    />
                                  ),
                                  'entity-actions': ({ entity }: { entity: EntityData }) => (
                                    <MenuButton
                                      ariaLabel="Entity actions"
                                      tooltip="Entity actions"
                                      items={[
                                        {
                                          key: 'add-attribute',
                                          title: 'Add attribute',
                                          icon: AddIcon,
                                          onClick: () => openAddAttribute(entity),
                                        },
                                      ]}
                                    />
                                  ),
                                  'enum-actions': ({ enum: en }: { enum: EnumData }) => (
                                    <MenuButton
                                      ariaLabel="Enum actions"
                                      tooltip="Enum actions"
                                      items={[
                                        {
                                          key: 'add-value',
                                          title: 'Add value',
                                          icon: AddIcon,
                                          onClick: () => {
                                            selectEnum(en)
                                            addEnumValue()
                                          },
                                        },
                                      ]}
                                    />
                                  ),
                                }}
                              </Package>
                            )}
                          </>
                        ))}
                      </>
                    ),
                  }}
                </DiagramCanvas>
              </div>

              {(attrBuffer.baseline.value ||
                entityBuffer.baseline.value ||
                enumBuffer.baseline.value ||
                packageBuffer.baseline.value ||
                modelBuffer.baseline.value) && (
                <>
                  {attrBuffer.baseline.value && attrBuffer.draft.value && (
                    <SidePanel
                      class={styles.propertiesPanel}
                      title="Properties"
                      icon={PropertiesIcon}
                      elevation={4}
                      onClose={cancelAttribute}
                    >
                      {{
                        default: () => (
                          <>
                            <div class="text-overline mb-4">Attribute</div>

                            {attributeEntity.value ? (
                              <DynamicForm
                                v-model={attrBuffer.draft.value}
                                entity={attributeEntity.value}
                                model={model.value}
                                fieldOverrides={{
                                  type: ({ value, onUpdate }) => (
                                    <VSelect
                                      modelValue={value == null ? null : String(value)}
                                      label="Type"
                                      items={[...PRIMITIVE_TYPES, ...userDefinedTypeNames()]}
                                      variant="outlined"
                                      density="compact"
                                      class="mb-2"
                                      onUpdate:modelValue={(v: string | null) => onUpdate(v)}
                                    />
                                  ),
                                }}
                              />
                            ) : null}

                            <VDivider class="mb-6" />

                            <VBtn
                              color="error"
                              variant="tonal"
                              block
                              prepend-icon={DeleteIcon}
                              onClick={deleteAttribute}
                            >
                              Delete Attribute
                            </VBtn>
                          </>
                        ),
                        footer: () => (
                          <>
                            <VBtn variant="text" onClick={cancelAttribute}>
                              Cancel
                            </VBtn>
                            <VBtn
                              variant="tonal"
                              color="primary"
                              disabled={!attrBuffer.dirty.value}
                              onClick={updateAttribute}
                            >
                              Save
                            </VBtn>
                          </>
                        ),
                      }}
                    </SidePanel>
                  )}

                  {entityBuffer.baseline.value && entityBuffer.draft.value && (
                    <SidePanel
                      class={styles.propertiesPanel}
                      title="Properties"
                      icon={PropertiesIcon}
                      elevation={4}
                      onClose={cancelEntity}
                    >
                      {{
                        default: () => (
                          <>
                            <div class="text-overline mb-4">Entity</div>

                            {entityEntity.value ? (
                              <DynamicForm
                                v-model={entityBuffer.draft.value}
                                entity={entityEntity.value}
                                model={model.value}
                                fieldOverrides={{
                                  // Attributes are managed by the diagram canvas, not this sidebar.
                                  attributes: () => null,
                                  // Note: `extends` is now rendered automatically by DynamicForm
                                  // because the model marks it as `reference: true` of type Entity.
                                }}
                              />
                            ) : null}

                            <VDivider class="mb-6" />

                            <VBtn
                              color="error"
                              variant="tonal"
                              block
                              prepend-icon={DeleteIcon}
                              onClick={deleteEntity}
                            >
                              Delete Entity
                            </VBtn>
                          </>
                        ),
                        footer: () => (
                          <>
                            <VBtn variant="text" onClick={cancelEntity}>
                              Cancel
                            </VBtn>
                            <VBtn
                              variant="tonal"
                              color="primary"
                              disabled={!entityBuffer.dirty.value}
                              onClick={updateEntity}
                            >
                              Save
                            </VBtn>
                          </>
                        ),
                      }}
                    </SidePanel>
                  )}

                  {enumBuffer.baseline.value && enumBuffer.draft.value && (
                    <SidePanel
                      class={styles.propertiesPanel}
                      title="Properties"
                      icon={PropertiesIcon}
                      elevation={4}
                      onClose={cancelEnum}
                    >
                      {{
                        default: () => (
                          <>
                            <div class="text-overline mb-4">Enum</div>

                            {enumEntity.value ? (
                              <DynamicForm
                                v-model={enumBuffer.draft.value}
                                entity={enumEntity.value}
                                model={model.value}
                                fieldOverrides={{
                                  values: () => (
                                    <div>
                                      <div class="d-flex align-center mb-2">
                                        <div class="text-overline flex-grow-1">Values</div>
                                        <VTooltip text="Add value" location="top">
                                          {{
                                            activator: ({
                                              props,
                                            }: {
                                              props: Record<string, unknown>
                                            }) => (
                                              <VBtn
                                                {...props}
                                                icon={AddIcon}
                                                variant="text"
                                                density="compact"
                                                aria-label="Add value"
                                                onClick={addEnumValue}
                                              />
                                            ),
                                          }}
                                        </VTooltip>
                                      </div>
                                      {enumBuffer.draft.value!.values.map((val, idx) => (
                                        <div key={val.id} class="d-flex align-center mb-2">
                                          <VTextField
                                            v-model={enumBuffer.draft.value!.values[idx].name}
                                            variant="outlined"
                                            density="compact"
                                            hide-details
                                          />
                                          <VTooltip text="Delete value" location="top">
                                            {{
                                              activator: ({
                                                props,
                                              }: {
                                                props: Record<string, unknown>
                                              }) => (
                                                <VBtn
                                                  {...props}
                                                  icon={DeleteIcon}
                                                  variant="text"
                                                  density="compact"
                                                  color="error"
                                                  class="ml-2"
                                                  aria-label="Delete value"
                                                  onClick={() => deleteEnumValue(val.id)}
                                                />
                                              ),
                                            }}
                                          </VTooltip>
                                        </div>
                                      ))}
                                    </div>
                                  ),
                                }}
                              />
                            ) : null}

                            <VDivider class="my-6" />

                            <VBtn
                              color="error"
                              variant="tonal"
                              block
                              prepend-icon={DeleteIcon}
                              onClick={deleteEnum}
                            >
                              Delete Enum
                            </VBtn>
                          </>
                        ),
                        footer: () => (
                          <>
                            <VBtn variant="text" onClick={cancelEnum}>
                              Cancel
                            </VBtn>
                            <VBtn
                              variant="tonal"
                              color="primary"
                              disabled={!enumBuffer.dirty.value}
                              onClick={updateEnum}
                            >
                              Save
                            </VBtn>
                          </>
                        ),
                      }}
                    </SidePanel>
                  )}

                  {packageBuffer.baseline.value && packageBuffer.draft.value && (
                    <SidePanel
                      class={styles.propertiesPanel}
                      title="Properties"
                      icon={PropertiesIcon}
                      elevation={4}
                      onClose={cancelPackage}
                    >
                      {{
                        default: () => (
                          <>
                            <div class="text-overline mb-4">Package</div>

                            {packageEntity.value ? (
                              <DynamicForm
                                v-model={packageBuffer.draft.value}
                                entity={packageEntity.value}
                                model={model.value}
                                fieldOverrides={{
                                  entities: () => null,
                                  enums: () => null,
                                  packages: () => null,
                                }}
                              />
                            ) : null}

                            <VDivider class="mb-6" />

                            <VBtn
                              color="error"
                              variant="tonal"
                              block
                              prepend-icon={DeleteIcon}
                              onClick={deletePackage}
                            >
                              Delete Package
                            </VBtn>
                          </>
                        ),
                        footer: () => (
                          <>
                            <VBtn variant="text" onClick={cancelPackage}>
                              Cancel
                            </VBtn>
                            <VBtn
                              variant="tonal"
                              color="primary"
                              disabled={!packageBuffer.dirty.value}
                              onClick={updatePackage}
                            >
                              Save
                            </VBtn>
                          </>
                        ),
                      }}
                    </SidePanel>
                  )}

                  {modelBuffer.baseline.value && modelBuffer.draft.value && (
                    <SidePanel
                      class={styles.propertiesPanel}
                      title="Properties"
                      icon={PropertiesIcon}
                      elevation={4}
                      onClose={cancelModelProperties}
                    >
                      {{
                        default: () => (
                          <>
                            <div class="text-overline mb-4">Model</div>

                            {modelEntity.value ? (
                              <DynamicForm
                                v-model={modelBuffer.draft.value}
                                entity={modelEntity.value}
                                model={model.value}
                                fieldOverrides={{
                                  packages: () => null,
                                  createdAt: () => null,
                                  updatedAt: () => null,
                                  version: ({ value, onUpdate }) => (
                                    <VTextField
                                      modelValue={value == null ? '' : String(value)}
                                      label="Version"
                                      variant="outlined"
                                      density="compact"
                                      class="mb-4"
                                      hide-details={modelVersionError.value ? false : 'auto'}
                                      errorMessages={modelVersionError.value ?? undefined}
                                      onUpdate:modelValue={(v: string) => onUpdate(v)}
                                    />
                                  ),
                                }}
                              />
                            ) : null}
                          </>
                        ),
                        footer: () => (
                          <>
                            <VBtn variant="text" onClick={cancelModelProperties}>
                              Cancel
                            </VBtn>
                            <VBtn
                              variant="tonal"
                              color="primary"
                              disabled={!modelBuffer.dirty.value || modelVersionError.value != null}
                              onClick={updateModelProperties}
                            >
                              Save
                            </VBtn>
                          </>
                        ),
                      }}
                    </SidePanel>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <VDialog v-model={entityDialog.value} max-width={400}>
          {{
            default: () => (
              <VCard rounded="xl">
                <VCardTitle class="pt-5 px-6">New entity in {targetPackage.value?.name}</VCardTitle>
                <VCardText>
                  {detailedErrors.value && (
                    <div class="mb-4">
                      {detailedErrors.value.map((err, i) => (
                        <VAlert
                          key={i}
                          type="error"
                          variant="tonal"
                          density="compact"
                          class="mb-2"
                          text={err.message}
                        />
                      ))}
                    </div>
                  )}
                  {entityEntity.value ? (
                    <DynamicForm
                      v-model={newEntity.value}
                      entity={entityEntity.value}
                      model={model.value}
                      fieldOverrides={{
                        attributes: () => null,
                        extends: () => null,
                        abstract: () => null,
                        description: () => null,
                        name: ({ value, onUpdate }) => (
                          <VTextField
                            modelValue={value == null ? '' : String(value)}
                            label="Entity name"
                            autofocus
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                            onUpdate:modelValue={(v: string) => onUpdate(v)}
                            onKeydown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter') addEntity()
                            }}
                          />
                        ),
                      }}
                    />
                  ) : null}
                </VCardText>
                <VCardActions class="px-6 pb-5">
                  <VSpacer />
                  <VBtn variant="text" onClick={() => (entityDialog.value = false)}>
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="indigo"
                    loading={addEntityMutation.loading.value}
                    disabled={!String(newEntity.value.name ?? '').trim()}
                    onClick={addEntity}
                  >
                    Create
                  </VBtn>
                </VCardActions>
              </VCard>
            ),
          }}
        </VDialog>

        <VDialog v-model={enumDialog.value} max-width={400}>
          {{
            default: () => (
              <VCard rounded="xl">
                <VCardTitle class="pt-5 px-6">New enum in {targetPackage.value?.name}</VCardTitle>
                <VCardText>
                  {detailedErrors.value && (
                    <div class="mb-4">
                      {detailedErrors.value.map((err, i) => (
                        <VAlert
                          key={i}
                          type="error"
                          variant="tonal"
                          density="compact"
                          class="mb-2"
                          text={err.message}
                        />
                      ))}
                    </div>
                  )}
                  {enumEntity.value ? (
                    <DynamicForm
                      v-model={newEnum.value}
                      entity={enumEntity.value}
                      model={model.value}
                      fieldOverrides={{
                        values: () => null,
                        description: () => null,
                        name: ({ value, onUpdate }) => (
                          <VTextField
                            modelValue={value == null ? '' : String(value)}
                            label="Enum name"
                            autofocus
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                            onUpdate:modelValue={(v: string) => onUpdate(v)}
                            onKeydown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter') addEnum()
                            }}
                          />
                        ),
                      }}
                    />
                  ) : null}
                </VCardText>
                <VCardActions class="px-6 pb-5">
                  <VSpacer />
                  <VBtn variant="text" onClick={() => (enumDialog.value = false)}>
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="indigo"
                    loading={addEnumMutation.loading.value}
                    disabled={!String(newEnum.value.name ?? '').trim()}
                    onClick={addEnum}
                  >
                    Create
                  </VBtn>
                </VCardActions>
              </VCard>
            ),
          }}
        </VDialog>

        <VDialog v-model={pkgDialog.value} max-width={400}>
          {{
            default: () => (
              <VCard rounded="xl">
                <VCardTitle class="pt-5 px-6">
                  {targetPackage.value
                    ? `New sub-package in ${targetPackage.value.name}`
                    : 'New package'}
                </VCardTitle>
                <VCardText>
                  {detailedErrors.value && (
                    <div class="mb-4">
                      {detailedErrors.value.map((err, i) => (
                        <VAlert
                          key={i}
                          type="error"
                          variant="tonal"
                          density="compact"
                          class="mb-2"
                          text={err.message}
                        />
                      ))}
                    </div>
                  )}
                  {packageEntity.value ? (
                    <DynamicForm
                      v-model={newPkg.value}
                      entity={packageEntity.value}
                      model={model.value}
                      fieldOverrides={{
                        entities: () => null,
                        enums: () => null,
                        packages: () => null,
                        description: () => null,
                        name: ({ value, onUpdate }) => (
                          <VTextField
                            modelValue={value == null ? '' : String(value)}
                            label="Package name"
                            autofocus
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                            onUpdate:modelValue={(v: string) => onUpdate(v)}
                            onKeydown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter') addPackage(targetPackage.value?.id)
                            }}
                          />
                        ),
                      }}
                    />
                  ) : null}
                </VCardText>
                <VCardActions class="px-6 pb-5">
                  <VSpacer />
                  <VBtn variant="text" onClick={() => (pkgDialog.value = false)}>
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="indigo"
                    loading={addPackageMutation.loading.value}
                    disabled={!String(newPkg.value.name ?? '').trim()}
                    onClick={() => addPackage(targetPackage.value?.id)}
                  >
                    Create
                  </VBtn>
                </VCardActions>
              </VCard>
            ),
          }}
        </VDialog>

        <VDialog v-model={attrDialog.value} max-width={400}>
          {{
            default: () => (
              <VCard rounded="xl">
                <VCardTitle class="pt-5 px-6">
                  Add attribute to {targetEntity.value?.name}
                </VCardTitle>
                <VCardText>
                  {detailedErrors.value && (
                    <div class="mb-4">
                      {detailedErrors.value.map((err, i) => (
                        <VAlert
                          key={i}
                          type="error"
                          variant="tonal"
                          density="compact"
                          class="mb-2"
                          text={err.message}
                        />
                      ))}
                    </div>
                  )}
                  {attributeEntity.value ? (
                    <DynamicForm
                      v-model={newAttribute.value}
                      entity={attributeEntity.value}
                      model={model.value}
                      fieldOverrides={{
                        type: ({ value, onUpdate }) => (
                          <VSelect
                            modelValue={value == null ? null : String(value)}
                            label="Type"
                            items={[...PRIMITIVE_TYPES, ...userDefinedTypeNames()]}
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                            onUpdate:modelValue={(v: string | null) => onUpdate(v ?? 'string')}
                          />
                        ),
                        name: ({ value, onUpdate }) => (
                          <VTextField
                            modelValue={value == null ? '' : String(value)}
                            label="Attribute name"
                            autofocus
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                            onUpdate:modelValue={(v: string) => onUpdate(v)}
                            onKeydown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter') addAttribute()
                            }}
                          />
                        ),
                      }}
                    />
                  ) : null}
                </VCardText>
                <VCardActions class="px-6 pb-5">
                  <VSpacer />
                  <VBtn variant="text" onClick={() => (attrDialog.value = false)}>
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="indigo"
                    loading={addAttributeMutation.loading.value}
                    disabled={!String(newAttribute.value.name ?? '').trim()}
                    onClick={addAttribute}
                  >
                    Add
                  </VBtn>
                </VCardActions>
              </VCard>
            ),
          }}
        </VDialog>
      </div>
    )
  },
})
