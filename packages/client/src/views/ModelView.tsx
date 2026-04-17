import {
  type Attribute,
  DiagramCanvas,
  type EntityData,
  type EnumData,
  type Layout,
  Package,
  type PackageData,
} from '@xomda/diagram'
import { AddIcon, CloseIcon, DeleteIcon, SaveIcon } from '@xomda/icons'
import { getInheritedAttributes, type Model } from '@xomda/model'
import { useConfirm, useDelayedLoading, useModelEntity } from '@xomda/ui'
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

    // Canvas layout: UUID → {x, y, width?, height?}
    // The user edits `layout`; `savedLayout` is the last persisted snapshot.
    // A Save/Cancel pill is shown whenever they diverge.
    const layout = ref<Layout>({})
    const savedLayout = ref<Layout>({})

    const layoutDirty = computed(
      () => JSON.stringify(layout.value) !== JSON.stringify(savedLayout.value)
    )

    function onPackageMove(id: string, x: number, y: number) {
      layout.value = { ...layout.value, [id]: { ...layout.value[id], x, y } }
    }

    function onPackageResize(id: string, width: number, height: number) {
      layout.value = { ...layout.value, [id]: { ...layout.value[id], width, height } }
    }

    async function saveLayout() {
      try {
        await trpc.model.updateLayout.mutate(layout.value)
        savedLayout.value = JSON.parse(JSON.stringify(layout.value))
      } catch (e) {
        parseError(e)
      }
    }

    function cancelLayout() {
      layout.value = JSON.parse(JSON.stringify(savedLayout.value))
    }

    // Add-entity dialog state
    const entityDialog = ref(false)
    const makeBlankEntity = (): JsonObject => ({ name: '' })
    const newEntity = ref<JsonObject>(makeBlankEntity())
    const targetPackage = ref<PackageData | null>(null)
    const entitySaving = ref(false)

    // Add-enum dialog state
    const enumDialog = ref(false)
    const makeBlankEnum = (): JsonObject => ({ name: '' })
    const newEnum = ref<JsonObject>(makeBlankEnum())
    const enumSaving = ref(false)

    // Add-package dialog state
    const pkgDialog = ref(false)
    const makeBlankPkg = (): Record<string, unknown> => ({ name: '' })
    const newPkg = ref<Record<string, unknown>>(makeBlankPkg())
    const pkgSaving = ref(false)

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
    const attrSaving = ref(false)

    // Selected attribute for editing in side panel
    const selectedAttr = ref<{ entity: EntityData; attribute: Attribute } | null>(null)
    const editAttrData = ref<Attribute | null>(null)

    // Self-describing forms: editors render from model.json's own definitions
    const attributeEntity = useModelEntity(model, 'Attribute')
    const entityEntity = useModelEntity(model, 'Entity')
    const enumEntity = useModelEntity(model, 'Enum')
    const packageEntity = useModelEntity(model, 'Package')
    const modelEntity = useModelEntity(model, 'Model')

    // Selected entity for editing in side panel
    const selectedEntity = ref<EntityData | null>(null)
    const editEntityData = ref<EntityData | null>(null)

    // Selected enum for editing in side panel
    const selectedEnum = ref<EnumData | null>(null)
    const editEnumData = ref<EnumData | null>(null)

    // Selected package for editing in side panel
    const selectedPackage = ref<PackageData | null>(null)
    const editPackageData = ref<PackageData | null>(null)

    // Selected model for editing in side panel
    const selectedModel = ref<Model | null>(null)
    const editModelData = ref<Model | null>(null)

    async function moveToPackage(payload: {
      type: 'entity' | 'enum' | 'package'
      id: string
      targetPackageId?: string
      index?: number
    }) {
      if (!model.value) return
      try {
        model.value = await trpc.model.moveToPackage.mutate(payload)
        // Reset layout for the moved item — its previous (x,y) was relative to
        // the old parent. Drop the entry so it appears at (0,0) in the new parent.
        // The package move itself is already persisted on the server, so we
        // mirror that by also persisting the layout cleanup immediately.
        if (layout.value[payload.id]) {
          const next = { ...layout.value }
          delete next[payload.id]
          layout.value = next
          const persisted = { ...savedLayout.value }
          delete persisted[payload.id]
          savedLayout.value = persisted
          try {
            await trpc.model.updateLayout.mutate(layout.value)
          } catch {
            // non-critical
          }
        }
      } catch (e) {
        parseError(e)
      }
    }

    function parseError(e: unknown) {
      console.error(e)
      if (e instanceof Error && e.message) {
        try {
          const parsed = JSON.parse(e.message)
          if (Array.isArray(parsed)) {
            detailedErrors.value = parsed.map(
              (err: { message?: string; path?: (string | number)[] }) => ({
                message: err.message || 'Unknown error',
                path: err.path,
              })
            )
            return
          }
        } catch {
          // Not JSON, fall back to default error
        }
      }
      error.value = 'Could not connect to the xomda server. Is @xomda/node running?'
    }

    async function loadModel() {
      loading.value = true
      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.get.query()
        const initialLayout = model.value?.layout ?? {}
        layout.value = JSON.parse(JSON.stringify(initialLayout))
        savedLayout.value = JSON.parse(JSON.stringify(initialLayout))
      } catch (e) {
        parseError(e)
      } finally {
        loading.value = false
      }
    }

    async function addEntity() {
      const name = String(newEntity.value.name ?? '').trim()
      if (!name || !model.value || !targetPackage.value) return

      // Client-side validation for unique name across entities, enums and packages
      const isDuplicate =
        targetPackage.value.entities.some((e: EntityData) => e.name === name) ||
        targetPackage.value.enums.some((e: EnumData) => e.name === name) ||
        targetPackage.value.packages.some((p: PackageData) => p.name === name)

      if (isDuplicate) {
        detailedErrors.value = [
          {
            message: `Name "${name}" must be unique within a package (already used by another entity, enum or package)`,
          },
        ]
        return
      }

      entitySaving.value = true
      error.value = null
      detailedErrors.value = null
      try {
        const entity = {
          ...newEntity.value,
          id: crypto.randomUUID(),
          name,
          attributes: [],
        }
        model.value = await trpc.model.addEntity.mutate({
          packageId: targetPackage.value.id,
          entity,
        })
        entityDialog.value = false
        newEntity.value = makeBlankEntity()
      } catch (e) {
        parseError(e)
      } finally {
        entitySaving.value = false
      }
    }

    async function addPackage(parentId?: string) {
      const name = String(newPkg.value.name ?? '').trim()
      if (!name || !model.value) return

      // Client-side validation for unique name across entities, enums and packages
      let siblings: PackageData[] = model.value.packages
      let parentPkg: PackageData | undefined

      if (parentId) {
        const findPkg = (pkgs: PackageData[]): PackageData | undefined => {
          for (const p of pkgs) {
            if (p.id === parentId) return p
            const found = findPkg(p.packages)
            if (found) return found
          }
        }
        parentPkg = findPkg(model.value.packages)
        if (parentPkg) siblings = parentPkg.packages
      }

      const isDuplicate =
        siblings.some((p: PackageData) => p.name === name) ||
        (parentPkg &&
          (parentPkg.entities.some((e: EntityData) => e.name === name) ||
            parentPkg.enums.some((e: EnumData) => e.name === name)))

      if (isDuplicate) {
        detailedErrors.value = [
          {
            message: `Name "${name}" must be unique within a package (already used by another entity, enum or package)`,
          },
        ]
        return
      }

      pkgSaving.value = true
      error.value = null
      try {
        const pkg = {
          ...newPkg.value,
          id: crypto.randomUUID(),
          name,
          packages: [],
          enums: [],
          entities: [],
        }
        model.value = await trpc.model.addPackage.mutate({
          parentId,
          package: pkg,
        })
        pkgDialog.value = false
        newPkg.value = makeBlankPkg()
      } catch (e) {
        parseError(e)
      } finally {
        pkgSaving.value = false
      }
    }

    async function addEnum() {
      const name = String(newEnum.value.name ?? '').trim()
      if (!name || !model.value || !targetPackage.value) return

      // Client-side validation for unique name across entities, enums and packages
      const isDuplicate =
        targetPackage.value.entities.some((e: EntityData) => e.name === name) ||
        targetPackage.value.enums.some((e: EnumData) => e.name === name) ||
        targetPackage.value.packages.some((p: PackageData) => p.name === name)

      if (isDuplicate) {
        detailedErrors.value = [
          {
            message: `Name "${name}" must be unique within a package (already used by another entity, enum or package)`,
          },
        ]
        return
      }

      enumSaving.value = true
      error.value = null
      try {
        const en = {
          ...newEnum.value,
          id: crypto.randomUUID(),
          name,
          values: [],
        }
        model.value = await trpc.model.addEnum.mutate({
          packageId: targetPackage.value.id,
          enum: en,
        })
        enumDialog.value = false
        newEnum.value = makeBlankEnum()
      } catch (e) {
        parseError(e)
      } finally {
        enumSaving.value = false
      }
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

    async function addAttribute() {
      const name = String(newAttribute.value.name ?? '').trim()
      if (!name || !targetEntity.value || !model.value) return

      // Client-side validation for unique name
      if (targetEntity.value.attributes.some((a) => a.name === name)) {
        detailedErrors.value = [
          { message: `Attribute name "${name}" must be unique within an entity` },
        ]
        return
      }

      attrSaving.value = true
      error.value = null
      detailedErrors.value = null
      try {
        const attribute = {
          ...newAttribute.value,
          id: crypto.randomUUID(),
          name,
        }
        model.value = await trpc.model.addAttribute.mutate({
          entityId: targetEntity.value.id,
          attribute: attribute as Parameters<
            typeof trpc.model.addAttribute.mutate
          >[0]['attribute'],
        })
        attrDialog.value = false
      } catch (e) {
        parseError(e)
      } finally {
        attrSaving.value = false
      }
    }

    function selectAttribute(entity: EntityData, attribute: Attribute) {
      selectedEntity.value = null
      editEntityData.value = null
      selectedModel.value = null
      editModelData.value = null
      selectedAttr.value = { entity, attribute }
      editAttrData.value = { ...attribute }
    }

    function selectEntity(entity: EntityData) {
      selectedAttr.value = null
      editAttrData.value = null
      selectedModel.value = null
      editModelData.value = null
      selectedEnum.value = null
      editEnumData.value = null
      selectedPackage.value = null
      editPackageData.value = null
      selectedEntity.value = entity
      editEntityData.value = { ...entity }
    }

    function selectEnum(en: EnumData) {
      selectedAttr.value = null
      editAttrData.value = null
      selectedModel.value = null
      editModelData.value = null
      selectedEntity.value = null
      editEntityData.value = null
      selectedPackage.value = null
      editPackageData.value = null
      selectedEnum.value = en
      editEnumData.value = { ...en }
    }

    function selectPackage(pkg: PackageData) {
      selectedAttr.value = null
      editAttrData.value = null
      selectedModel.value = null
      editModelData.value = null
      selectedEntity.value = null
      editEntityData.value = null
      selectedEnum.value = null
      editEnumData.value = null
      selectedPackage.value = pkg
      editPackageData.value = { ...pkg }
    }

    function selectModel() {
      selectedAttr.value = null
      editAttrData.value = null
      selectedEntity.value = null
      editEntityData.value = null
      selectedEnum.value = null
      editEnumData.value = null
      selectedPackage.value = null
      editPackageData.value = null
      selectedModel.value = model.value
      editModelData.value = model.value ? { ...model.value } : null
    }

    async function updateAttribute() {
      if (!selectedAttr.value || !editAttrData.value || !model.value) return

      // Client-side validation for unique name
      const currentAttr = selectedAttr.value.attribute
      const sameNameAttr = selectedAttr.value.entity.attributes.find(
        (a) => a.name === editAttrData.value!.name && a.id !== currentAttr.id
      )
      if (sameNameAttr) {
        detailedErrors.value = [
          {
            message: `Attribute name "${editAttrData.value.name}" must be unique within an entity`,
          },
        ]
        return
      }

      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.updateAttribute.mutate({
          entityId: selectedAttr.value.entity.id,
          attribute: editAttrData.value,
        })
        selectedAttr.value.attribute = { ...editAttrData.value }
      } catch (e) {
        parseError(e)
        // Revert edit state on error to what's in the model
        if (selectedAttr.value) {
          editAttrData.value = { ...selectedAttr.value.attribute }
        }
      }
    }

    async function updateEntity() {
      if (!selectedEntity.value || !editEntityData.value || !model.value) return

      // Client-side validation for unique name (if it changed)
      if (editEntityData.value.name !== selectedEntity.value.name) {
        const findPkg = (pkgs: PackageData[]): PackageData | undefined => {
          for (const p of pkgs) {
            if (p.entities.some((e) => e.id === selectedEntity.value?.id)) return p
            const found = findPkg(p.packages)
            if (found) return found
          }
        }
        const parentPkg = findPkg(model.value.packages)
        if (parentPkg) {
          const name = editEntityData.value.name
          const isDuplicate =
            parentPkg.entities.some(
              (e) => e.name === name && e.id !== selectedEntity.value?.id
            ) ||
            parentPkg.enums.some((e) => e.name === name) ||
            parentPkg.packages.some((p) => p.name === name)

          if (isDuplicate) {
            detailedErrors.value = [
              {
                message: `Name "${name}" must be unique within a package (already used by another entity, enum or package)`,
              },
            ]
            return
          }
        }
      }

      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.updateEntity.mutate(editEntityData.value)
        // Update local ref
        selectedEntity.value = { ...editEntityData.value }
      } catch (e) {
        parseError(e)
        // Revert edit state on error to what's in the model
        if (selectedEntity.value) {
          editEntityData.value = { ...selectedEntity.value }
        }
      }
    }

    async function updateEnum() {
      if (!selectedEnum.value || !editEnumData.value || !model.value) return

      // Client-side validation for unique name (if it changed)
      if (editEnumData.value.name !== selectedEnum.value.name) {
        // Find parent package
        //let parentPkg: PackageData | undefined
        const findPkg = (pkgs: PackageData[]): PackageData | undefined => {
          for (const p of pkgs) {
            if (p.enums.some((e: EnumData) => e.id === selectedEnum.value?.id)) return p
            const found = findPkg(p.packages)
            if (found) return found
          }
        }
        const parentPkg = findPkg(model.value.packages)
        if (parentPkg) {
          const name = editEnumData.value.name
          const isDuplicate =
            parentPkg.entities.some((e: EntityData) => e.name === name) ||
            parentPkg.enums.some(
              (e: EnumData) => e.name === name && e.id !== selectedEnum.value?.id
            ) ||
            parentPkg.packages.some((p: PackageData) => p.name === name)

          if (isDuplicate) {
            detailedErrors.value = [
              {
                message: `Name "${name}" must be unique within a package (already used by another entity, enum or package)`,
              },
            ]
            return
          }
        }
      }

      // Client-side validation for unique enum value names
      const seenNames = new Set<string>()
      const duplicateNames = new Set<string>()
      editEnumData.value.values.forEach((v: { name: string }) => {
        if (seenNames.has(v.name)) {
          duplicateNames.add(v.name)
        }
        seenNames.add(v.name)
      })

      if (duplicateNames.size > 0) {
        detailedErrors.value = Array.from(duplicateNames).map((name) => ({
          message: `Enum value "${name}" must be unique within an enum`,
        }))
        return
      }

      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.updateEnum.mutate(editEnumData.value)
        selectedEnum.value = { ...editEnumData.value }
      } catch (e) {
        parseError(e)
        // Revert edit state on error to what's in the model
        if (selectedEnum.value) {
          editEnumData.value = { ...selectedEnum.value }
        }
      }
    }

    async function updatePackage() {
      if (!selectedPackage.value || !editPackageData.value || !model.value) return

      // Client-side validation for unique name (if it changed)
      if (editPackageData.value.name !== selectedPackage.value.name) {
        const name = editPackageData.value.name
        // Find parent list (either root or sub-packages of another package)
        let siblings: PackageData[] = model.value.packages
        let parentPkg: PackageData | undefined

        const findSiblingsAndParent = (
          pkgs: PackageData[]
        ): { siblings: PackageData[]; parent?: PackageData } | undefined => {
          for (const p of pkgs) {
            if (p.packages.some((sp: PackageData) => sp.id === selectedPackage.value?.id))
              return { siblings: p.packages, parent: p }
            const found = findSiblingsAndParent(p.packages)
            if (found) return found
          }
        }
        const result = findSiblingsAndParent(model.value.packages)
        if (result) {
          siblings = result.siblings
          parentPkg = result.parent
        }

        const isDuplicate =
          siblings.some(
            (p: PackageData) => p.name === name && p.id !== selectedPackage.value?.id
          ) ||
          (parentPkg &&
            (parentPkg.entities.some((e: EntityData) => e.name === name) ||
              parentPkg.enums.some((e: EnumData) => e.name === name)))

        if (isDuplicate) {
          detailedErrors.value = [
            {
              message: `Name "${name}" must be unique within a package (already used by another entity, enum or package)`,
            },
          ]
          return
        }
      }

      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.updatePackage.mutate(editPackageData.value)
        selectedPackage.value = { ...editPackageData.value }
      } catch (e) {
        parseError(e)
        // Revert edit state on error to what's in the model
        if (selectedPackage.value) {
          editPackageData.value = { ...selectedPackage.value }
        }
      }
    }

    async function updateModelProperties() {
      if (!selectedModel.value || !editModelData.value) return
      error.value = null
      detailedErrors.value = null
      try {
        model.value = await trpc.model.save.mutate(editModelData.value)
        // Update local ref
        selectedModel.value = { ...editModelData.value }
      } catch (e) {
        parseError(e)
        // Revert edit state on error to what's in the model
        if (selectedModel.value) {
          editModelData.value = { ...selectedModel.value }
        }
      }
    }

    const { confirm } = useConfirm()

    async function deleteAttribute() {
      if (!selectedAttr.value || !model.value) return

      confirm({
        title: 'Delete Attribute',
        message: `Are you sure you want to delete attribute "${selectedAttr.value.attribute.name}"?`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          model.value = await trpc.model.deleteAttribute.mutate({
            entityId: selectedAttr.value!.entity.id,
            attributeId: selectedAttr.value!.attribute.id,
          })
          selectedAttr.value = null
          editAttrData.value = null
        },
      })
    }

    async function deleteEntity() {
      if (!selectedEntity.value || !model.value) return

      confirm({
        title: 'Delete Entity',
        message: `Are you sure you want to delete entity "${selectedEntity.value.name}"? This will also delete all its attributes.`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          model.value = await trpc.model.deleteEntity.mutate({
            id: selectedEntity.value!.id,
          })
          selectedEntity.value = null
          editEntityData.value = null
        },
      })
    }

    async function deleteEnum() {
      if (!selectedEnum.value || !model.value) return

      confirm({
        title: 'Delete Enum',
        message: `Are you sure you want to delete enum "${selectedEnum.value.name}"?`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          model.value = await trpc.model.deleteEnum.mutate({
            id: selectedEnum.value!.id,
          })
          selectedEnum.value = null
          editEnumData.value = null
        },
      })
    }

    async function deletePackage() {
      if (!selectedPackage.value || !model.value) return

      confirm({
        title: 'Delete Package',
        message: `Are you sure you want to delete package "${selectedPackage.value.name}"? This will also delete all its contents recursively.`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          model.value = await trpc.model.deletePackage.mutate({
            id: selectedPackage.value!.id,
          })
          selectedPackage.value = null
          editPackageData.value = null
        },
      })
    }

    function addEnumValue() {
      if (!editEnumData.value) return

      const existingNames = new Set(editEnumData.value.values.map((v) => v.name))
      let newName = 'NEW_VALUE'
      let counter = 1
      while (existingNames.has(newName)) {
        newName = `NEW_VALUE_${counter}`
        counter++
      }

      editEnumData.value.values.push({
        id: crypto.randomUUID(),
        name: newName,
      })
    }

    function deleteEnumValue(valueId: string) {
      if (!editEnumData.value) return
      editEnumData.value.values = editEnumData.value.values.filter((v) => v.id !== valueId)
    }

    // ---------------------------------------------------------------------
    // Dirty-state tracking & cancel handlers for the side-panel forms.
    // Each panel buffers its edits in `editXData`. Save calls the existing
    // updateX handler; Cancel reverts edits without closing the panel.
    // ---------------------------------------------------------------------

    const isDeepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

    const attrDirty = computed(
      () =>
        !!selectedAttr.value &&
        !!editAttrData.value &&
        !isDeepEqual(editAttrData.value, selectedAttr.value.attribute)
    )
    const entityDirty = computed(
      () =>
        !!selectedEntity.value &&
        !!editEntityData.value &&
        !isDeepEqual(editEntityData.value, selectedEntity.value)
    )
    const enumDirty = computed(
      () =>
        !!selectedEnum.value &&
        !!editEnumData.value &&
        !isDeepEqual(editEnumData.value, selectedEnum.value)
    )
    const packageDirty = computed(
      () =>
        !!selectedPackage.value &&
        !!editPackageData.value &&
        !isDeepEqual(editPackageData.value, selectedPackage.value)
    )
    const modelPropsDirty = computed(
      () =>
        !!selectedModel.value &&
        !!editModelData.value &&
        !isDeepEqual(editModelData.value, selectedModel.value)
    )

    // Cancel handlers: revert any pending edits then close the panel.
    function cancelAttribute() {
      selectedAttr.value = null
      editAttrData.value = null
      detailedErrors.value = null
    }
    function cancelEntity() {
      selectedEntity.value = null
      editEntityData.value = null
      detailedErrors.value = null
    }
    function cancelEnum() {
      selectedEnum.value = null
      editEnumData.value = null
      detailedErrors.value = null
    }
    function cancelPackage() {
      selectedPackage.value = null
      editPackageData.value = null
      detailedErrors.value = null
    }
    function cancelModelProperties() {
      selectedModel.value = null
      editModelData.value = null
      detailedErrors.value = null
    }

    onMounted(loadModel)

    const route = useRoute()
    const router = useRouter()

    function findAndSelect(id: string): boolean {
      const m = model.value
      if (!m) return false
      for (const pkg of m.packages as PackageData[]) {
        const hit = findInPackage(pkg, id)
        if (hit) {
          if (hit.kind === 'package') selectPackage(hit.value)
          else if (hit.kind === 'entity') selectEntity(hit.value)
          else if (hit.kind === 'enum') selectEnum(hit.value)
          return true
        }
      }
      return false
    }

    type FindResult =
      | { kind: 'package'; value: PackageData }
      | { kind: 'entity'; value: EntityData }
      | { kind: 'enum'; value: EnumData }

    function findInPackage(pkg: PackageData, id: string): FindResult | null {
      if (pkg.id === id) return { kind: 'package', value: pkg }
      for (const e of pkg.entities) if (e.id === id) return { kind: 'entity', value: e }
      for (const en of pkg.enums) if (en.id === id) return { kind: 'enum', value: en }
      for (const child of pkg.packages) {
        const r = findInPackage(child, id)
        if (r) return r
      }
      return null
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

    const sortedRootElements = computed(() => {
      if (!model.value) return []
      const elements: { type: 'package'; data: PackageData }[] = model.value.packages.map((p) => ({
        type: 'package' as const,
        data: p,
      }))

      const order = model.value.elementsOrder || []
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

    return () => (
      <div class="d-flex flex-column h-100">
        <AppTitleBar>
          {{
            title: () => (
              <span onClick={selectModel} style={{ cursor: 'pointer' }}>
                Model: {model.value?.name}{' '}
                {model.value?.version ? (
                  <span class={'text-caption'}>(v{model.value.version})</span>
                ) : undefined}
              </span>
            ),
            actions: () => (
              <>
                <VBtn
                  prepend-icon={AddIcon}
                  variant="tonal"
                  color="primary"
                  onClick={() => openAddPackage()}
                >
                  Add package
                </VBtn>
                <VBtn
                  prepend-icon={SaveIcon}
                  variant="tonal"
                  color="primary"
                  onClick={() => (commitOpen.value = true)}
                >
                  Publish version
                </VBtn>
              </>
            ),
          }}
        </AppTitleBar>
        <CommitModal v-model={commitOpen.value} />

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
                  <div class="w-100 max-width-600 px-4">
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
                {layoutDirty.value && (
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
                        {sortedRootElements.value.map((el) => (
                          <>
                            {el.type === 'package' && (
                              <Package
                                key={el.data.id}
                                package={el.data}
                                inheritedAttributesByEntityId={inheritedAttributesByEntityId.value}
                                selected={selectedPackage.value?.id === el.data.id}
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
                                onReorder-attributes={async (
                                  entity: EntityData,
                                  attributeIds: string[]
                                ) => {
                                  model.value = await trpc.model.reorderAttributes.mutate({
                                    entityId: entity.id,
                                    attributeIds,
                                  })
                                }}
                                onReorder-values={async (en: EnumData, valueIds: string[]) => {
                                  model.value = await trpc.model.reorderEnumValues.mutate({
                                    enumId: en.id,
                                    valueIds,
                                  })
                                }}
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

              {(selectedAttr.value ||
                selectedEntity.value ||
                selectedEnum.value ||
                selectedPackage.value ||
                selectedModel.value) && (
                <VCard class={styles.propertiesPanel} elevation={4} rounded="lg">
                  {selectedAttr.value && editAttrData.value && (
                    <>
                      <div class={styles.sidebarHeader}>
                        <div class="text-h6 flex-grow-1">Properties</div>
                        <VTooltip text="Close" location="bottom">
                          {{
                            activator: ({ props }: { props: Record<string, unknown> }) => (
                              <VBtn
                                {...props}
                                icon={CloseIcon}
                                variant="text"
                                density="comfortable"
                                aria-label="Close"
                                onClick={() => (selectedAttr.value = null)}
                              />
                            ),
                          }}
                        </VTooltip>
                      </div>
                      <div class={styles.sidebarContent}>
                        <div class="text-overline mb-4">Attribute</div>

                        {attributeEntity.value ? (
                          <DynamicForm
                            v-model={editAttrData.value}
                            entity={attributeEntity.value}
                            model={model.value}
                            fieldOverrides={{
                              type: ({ value, onUpdate }) => (
                                <VSelect
                                  modelValue={value == null ? null : String(value)}
                                  label="Type"
                                  items={[
                                    'string',
                                    'number',
                                    'boolean',
                                    'Date',
                                    'UUID',
                                    'decimal',
                                    ...(() => {
                                      const getAllTypes = (pkgs: PackageData[]): string[] => {
                                        return pkgs.flatMap((p) => [
                                          ...p.enums.map((e) => e.name),
                                          ...p.entities.map((e) => e.name),
                                          ...getAllTypes(p.packages),
                                        ])
                                      }
                                      return (
                                        model.value?.packages
                                          ? getAllTypes(model.value.packages)
                                          : []
                                      ).sort()
                                    })(),
                                  ]}
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
                      </div>
                      <div class={styles.sidebarFooter}>
                        <VBtn variant="text" onClick={cancelAttribute}>
                          Cancel
                        </VBtn>
                        <VBtn
                          variant="tonal"
                          color="primary"
                          disabled={!attrDirty.value}
                          onClick={updateAttribute}
                        >
                          Save
                        </VBtn>
                      </div>
                    </>
                  )}

                  {selectedEntity.value && editEntityData.value && (
                    <>
                      <div class={styles.sidebarHeader}>
                        <div class="text-h6 flex-grow-1">Properties</div>
                        <VTooltip text="Close" location="bottom">
                          {{
                            activator: ({ props }: { props: Record<string, unknown> }) => (
                              <VBtn
                                {...props}
                                icon={CloseIcon}
                                variant="text"
                                density="comfortable"
                                aria-label="Close"
                                onClick={() => (selectedEntity.value = null)}
                              />
                            ),
                          }}
                        </VTooltip>
                      </div>
                      <div class={styles.sidebarContent}>
                        <div class="text-overline mb-4">Entity</div>

                        {entityEntity.value ? (
                          <DynamicForm
                            v-model={editEntityData.value}
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
                      </div>
                      <div class={styles.sidebarFooter}>
                        <VBtn variant="text" onClick={cancelEntity}>
                          Cancel
                        </VBtn>
                        <VBtn
                          variant="tonal"
                          color="primary"
                          disabled={!entityDirty.value}
                          onClick={updateEntity}
                        >
                          Save
                        </VBtn>
                      </div>
                    </>
                  )}

                  {selectedEnum.value && editEnumData.value && (
                    <>
                      <div class={styles.sidebarHeader}>
                        <div class="text-h6 flex-grow-1">Properties</div>
                        <VTooltip text="Close" location="bottom">
                          {{
                            activator: ({ props }: { props: Record<string, unknown> }) => (
                              <VBtn
                                {...props}
                                icon={CloseIcon}
                                variant="text"
                                density="comfortable"
                                aria-label="Close"
                                onClick={() => (selectedEnum.value = null)}
                              />
                            ),
                          }}
                        </VTooltip>
                      </div>
                      <div class={styles.sidebarContent}>
                        <div class="text-overline mb-4">Enum</div>

                        {enumEntity.value ? (
                          <DynamicForm
                            v-model={editEnumData.value}
                            entity={enumEntity.value}
                            model={model.value}
                            fieldOverrides={{
                              values: () => (
                                <div>
                                  <div class="d-flex align-center mb-2">
                                    <div class="text-overline flex-grow-1">Values</div>
                                    <VTooltip text="Add value" location="top">
                                      {{
                                        activator: ({ props }: { props: Record<string, unknown> }) => (
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
                                  {editEnumData.value!.values.map((val, idx) => (
                                    <div key={val.id} class="d-flex align-center mb-2">
                                      <VTextField
                                        v-model={editEnumData.value!.values[idx].name}
                                        variant="outlined"
                                        density="compact"
                                        hide-details
                                      />
                                      <VTooltip text="Delete value" location="top">
                                        {{
                                          activator: ({ props }: { props: Record<string, unknown> }) => (
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
                      </div>
                      <div class={styles.sidebarFooter}>
                        <VBtn variant="text" onClick={cancelEnum}>
                          Cancel
                        </VBtn>
                        <VBtn
                          variant="tonal"
                          color="primary"
                          disabled={!enumDirty.value}
                          onClick={updateEnum}
                        >
                          Save
                        </VBtn>
                      </div>
                    </>
                  )}

                  {selectedPackage.value && editPackageData.value && (
                    <>
                      <div class={styles.sidebarHeader}>
                        <div class="text-h6 flex-grow-1">Properties</div>
                        <VTooltip text="Close" location="bottom">
                          {{
                            activator: ({ props }: { props: Record<string, unknown> }) => (
                              <VBtn
                                {...props}
                                icon={CloseIcon}
                                variant="text"
                                density="comfortable"
                                aria-label="Close"
                                onClick={() => (selectedPackage.value = null)}
                              />
                            ),
                          }}
                        </VTooltip>
                      </div>
                      <div class={styles.sidebarContent}>
                        <div class="text-overline mb-4">Package</div>

                        {packageEntity.value ? (
                          <DynamicForm
                            v-model={editPackageData.value}
                            entity={packageEntity.value}
                            model={model.value}
                            fieldOverrides={{
                              entities: () => null,
                              enums: () => null,
                              packages: () => null,
                              elementsOrder: () => null,
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
                      </div>
                      <div class={styles.sidebarFooter}>
                        <VBtn variant="text" onClick={cancelPackage}>
                          Cancel
                        </VBtn>
                        <VBtn
                          variant="tonal"
                          color="primary"
                          disabled={!packageDirty.value}
                          onClick={updatePackage}
                        >
                          Save
                        </VBtn>
                      </div>
                    </>
                  )}

                  {selectedModel.value && editModelData.value && (
                    <>
                      <div class={styles.sidebarHeader}>
                        <div class="text-h6 flex-grow-1">Properties</div>
                        <VTooltip text="Close" location="bottom">
                          {{
                            activator: ({ props }: { props: Record<string, unknown> }) => (
                              <VBtn
                                {...props}
                                icon={CloseIcon}
                                variant="text"
                                density="comfortable"
                                aria-label="Close"
                                onClick={() => (selectedModel.value = null)}
                              />
                            ),
                          }}
                        </VTooltip>
                      </div>
                      <div class={styles.sidebarContent}>
                        <div class="text-overline mb-4">Model</div>

                        {modelEntity.value ? (
                          <DynamicForm
                            v-model={editModelData.value}
                            entity={modelEntity.value}
                            model={model.value}
                            fieldOverrides={{
                              packages: () => null,
                              createdAt: () => null,
                              updatedAt: () => null,
                              elementsOrder: () => null,
                            }}
                          />
                        ) : null}
                      </div>
                      <div class={styles.sidebarFooter}>
                        <VBtn variant="text" onClick={cancelModelProperties}>
                          Cancel
                        </VBtn>
                        <VBtn
                          variant="tonal"
                          color="primary"
                          disabled={!modelPropsDirty.value}
                          onClick={updateModelProperties}
                        >
                          Save
                        </VBtn>
                      </div>
                    </>
                  )}
                </VCard>
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
                    loading={entitySaving.value}
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
                    loading={enumSaving.value}
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
                        elementsOrder: () => null,
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
                    loading={pkgSaving.value}
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
                            items={[
                              'string',
                              'number',
                              'boolean',
                              'Date',
                              'UUID',
                              'decimal',
                              ...(() => {
                                const getAllTypes = (pkgs: PackageData[]): string[] => {
                                  return pkgs.flatMap((p) => [
                                    ...p.enums.map((e) => e.name),
                                    ...p.entities.map((e) => e.name),
                                    ...getAllTypes(p.packages),
                                  ])
                                }
                                return (
                                  model.value?.packages ? getAllTypes(model.value.packages) : []
                                ).sort()
                              })(),
                            ]}
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
                    loading={attrSaving.value}
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
