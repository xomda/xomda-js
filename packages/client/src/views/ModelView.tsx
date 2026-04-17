import {
  findEntityById,
  findEnumById,
  findPackageById,
  getAllEntities,
  getAllEnums,
  PRIMITIVE_TYPES,
} from '@xomda/core'
import {
  type Attribute,
  DiagramCanvas,
  type EntityData,
  type EnumData,
  type Layout,
  Package,
  type PackageData,
} from '@xomda/diagram'
import { AddIcon, DeleteIcon, PropertiesIcon, SaveIcon } from '@xomda/icons'
import { getInheritedAttributes, type Model } from '@xomda/model'
import {
  type ParsedTrpcError,
  parseTrpcError,
  SidePanel,
  useConfirm,
  useDelayedLoading,
  useEditBuffer,
  useModelEntity,
  useMutation,
  useNotificationsStore,
  useVersion,
} from '@xomda/ui'
import type { JsonObject } from 'type-fest'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
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
  VProgressCircular,
  VSelect,
  VSpacer,
  VTextField,
  VTooltip,
} from 'vuetify/components'

import { AppTitleBar, CommitModal, DynamicForm } from '../components'
import { trpc } from '../trpc'
import styles from './ModelView.module.scss'

export const ModelView = defineComponent({
  name: 'ModelView',
  setup() {
    const model = ref<Model | null>(null)
    const loading = ref(false)
    const showLoading = useDelayedLoading(loading)
    const error = ref<string | null>(null)
    const detailedErrors = ref<{ message: string; path?: (string | number)[] }[] | null>(null)
    const commitOpen = ref(false)
    const versionLabels = ref<string[]>([])

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
    }

    function onPackageResize(id: string, width: number, height: number) {
      const current = layout.value
      layoutBuffer.draft.value = { ...current, [id]: { ...current[id], width, height } }
    }

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
      (next: Layout) => trpc.model.updateLayout.mutate(next),
      { onError: applyFieldsError, onSuccess: () => layoutBuffer.commit() }
    )
    /** Layout cleanup after moveToPackage — silent (compound op already toasted on failure). */
    const updateLayoutSilentMutation = useMutation(
      (next: Layout) => trpc.model.updateLayout.mutate(next),
      { notify: false, onSuccess: () => layoutBuffer.commit() }
    )

    function saveLayout() {
      void updateLayoutMutation.run(layout.value)
    }

    function cancelLayout() {
      layoutBuffer.revert()
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
        model.value = await trpc.model.get.query()
        layoutBuffer.set(model.value?.layout ?? {})
      } catch (e) {
        // Silent: the full-page error banner shows the failure; no toast on top.
        reportError(e, { silent: true })
      } finally {
        loading.value = false
      }
    }

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

    function selectModel() {
      clearAllPanelsExcept('model')
      modelBuffer.set(model.value)
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
      (entity: EntityData) => trpc.model.updateEntity.mutate(entity),
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

    const updateEnumMutation = useMutation((en: EnumData) => trpc.model.updateEnum.mutate(en), {
      onError: (e) => {
        applyFieldsError(e)
        enumBuffer.revert()
      },
      onSuccess: (result) => {
        model.value = result
        enumBuffer.commit()
      },
    })

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
      (pkg: PackageData) => trpc.model.updatePackage.mutate(pkg),
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

    const saveModelMutation = useMutation((next: Model) => trpc.model.save.mutate(next), {
      onError: (e) => {
        applyFieldsError(e)
        modelBuffer.revert()
      },
      onSuccess: (result) => {
        model.value = result
        modelBuffer.commit()
      },
    })

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

    onMounted(() => {
      loadModel()
      loadVersionLabels()
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
          void router.replace({ path: '/model', query: {} })
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
            title: () => (
              <div class="d-flex align-center ga-3">
                <span onClick={selectModel} style={{ cursor: 'pointer' }}>
                  Model: {model.value?.name}{' '}
                  {model.value?.version ? (
                    <span class={'text-caption'}>(v{model.value.version})</span>
                  ) : undefined}
                </span>
                <VBtn
                  prepend-icon={AddIcon}
                  variant="tonal"
                  color="primary"
                  size="small"
                  onClick={() => openAddPackage()}
                >
                  Add package
                </VBtn>
              </div>
            ),
            actions: () => (
              <VBtn
                prepend-icon={SaveIcon}
                variant="tonal"
                color="primary"
                onClick={() => (commitOpen.value = true)}
              >
                Publish
              </VBtn>
            ),
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
              <div class={styles.canvasArea}>
                {layoutBuffer.dirty.value && (
                  <div class={[styles.layoutSaveBar, 'rounded']}>
                    <span>Layout changes pending</span>
                    <VBtn variant="text" size="small" onClick={cancelLayout}>
                      Cancel
                    </VBtn>
                    <VBtn variant="tonal" color="primary" size="small" onClick={saveLayout}>
                      Save layout
                    </VBtn>
                  </div>
                )}
                <DiagramCanvas class={styles.canvas} layout={layout.value}>
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
                                selected={packageBuffer.baseline.value?.id === el.data.id}
                                layout={layout.value[el.data.id] ?? { x: 0, y: 0 }}
                                layouts={layout.value}
                                absolute={true}
                                onEdit-package={selectPackage}
                                onEdit-entity={selectEntity}
                                onAdd-attribute={openAddAttribute}
                                onEdit-attribute={selectAttribute}
                                onEdit-enum={selectEnum}
                                onAdd-value={(en: EnumData) => {
                                  selectEnum(en)
                                  addEnumValue()
                                }}
                                onEdit-value={selectEnum}
                                onAdd-package={openAddPackage}
                                onAdd-entity={openAddEntity}
                                onAdd-enum={openAddEnum}
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
                              />
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
