import { TEMPLATE_SCOPES } from '@xomda/core'
import {
  AddIcon,
  ChevronRightIcon,
  CreateNewFolderIcon,
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  InfoIcon,
  ListViewIcon,
  MoreIcon,
  MoveToFolderIcon,
  PropertiesIcon,
  TemplatesIcon,
  TreeViewIcon,
} from '@xomda/icons'
import type { Template, TemplateFolder } from '@xomda/template'
import {
  FileEntryIcon,
  FileEntryListItem,
  MenuButton,
  type MenuItemConfig,
  SidePanel,
  type SortState,
  useConfirm,
  useContextMenu,
  useLocalStorageStore,
  useMutation,
  usePrompt,
  useUnsavedChangesPrompt,
} from '@xomda/ui'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VAutocomplete,
  VBtn,
  VCard,
  VEmptyState,
  VIcon,
  VList,
  VSelect,
  VSwitch,
  VTextField,
  VTooltip,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider, ViewCardHeader, WorkspaceSelector } from '../../components'
import { TemplateEditor } from '../../components/templates/TemplateEditor'
import { usePanelResize } from '../../composables'
import { trpc } from '../../trpc'
import { TemplatesRoutes } from './routes'
import { duplicateTemplate, findTabsInDeletedFolder, newTemplate } from './TemplatesView.logic'
import styles from './TemplatesView.module.scss'
import { TemplateTabs } from './TemplateTabs'
import { useTemplateTabs } from './useTemplateTabs'

export const TemplatesView = defineComponent({
  name: 'TemplatesView',
  setup() {
    const theme = useTheme()
    const route = useRoute()
    const router = useRouter()
    const store = useLocalStorageStore()
    const templates = ref<Template[]>([])
    const folders = ref<TemplateFolder[]>([])
    // Multi-tab editor state. Each open template gets its own edit buffer +
    // dirty tracking; switching tabs swaps which buffer the form/editor are
    // bound to. The side panel's open/closed state is independent of the
    // active tab so closing the panel keeps the template open.
    const tabs = useTemplateTabs()
    const selectedTemplate = computed(() => tabs.activeBuffer.value?.draft.value ?? null)
    const templateDirty = computed(() => tabs.activeBuffer.value?.dirty.value ?? false)
    // Sticky open/closed state for the Properties side panel. Lives in
    // useLocalStorageStore so it survives reloads — the user only has to
    // close the panel once.
    const sidePanelOpen = computed({
      get: () => store.templatePropertiesOpen,
      set: (v: boolean) => (store.templatePropertiesOpen = v),
    })
    const { promptUnsavedChanges } = useUnsavedChangesPrompt()

    /**
     * Per-field writable computed for the active tab's draft. Re-binds
     * automatically when activeUuid changes — no `!`-assertions in the
     * template, and the side panel form survives tab switches without
     * stale-ref issues. Returns `undefined` when no tab is open.
     */
    function field<K extends keyof Template>(key: K) {
      return computed<Template[K] | undefined>({
        get: () => tabs.activeBuffer.value?.draft.value?.[key],
        set: (v) => {
          const d = tabs.activeBuffer.value?.draft.value
          if (!d) return
          ;(d[key] as Template[K] | undefined) = v as Template[K] | undefined
        },
      })
    }
    const nameField = field('name')
    const versionField = field('version')
    const scopeField = field('scope')
    const descriptionField = field('description')
    const extendsField = field('extends')
    const disabledField = field('disabled')

    // Other templates that can be picked as a parent in the `extends` field.
    // Excludes the current template (you can't extend yourself); cycles
    // beyond depth 1 are deliberately not policed here — defer until a
    // resolver actually consumes the field.
    const otherTemplatesForExtend = computed(() => {
      const currentUuid = tabs.activeUuid.value
      return templates.value
        .filter((t) => t.uuid !== currentUuid)
        .map((t) => ({ title: t.name, value: t.uuid }))
    })

    const currentPath = computed(() => {
      const segs = route.params.folderPath
      if (Array.isArray(segs)) return segs.join('/')
      if (typeof segs === 'string') return segs
      return ''
    })

    const folderPathSegments = (path: string) => (path ? path.split('/') : [])

    const goToFolder = (path: string) => {
      router.push({
        name: TemplatesRoutes.view,
        params: { folderPath: folderPathSegments(path) },
        query: {},
      })
    }

    const updateSelectedInUrl = (uuid: string | null) => {
      router.replace({
        name: TemplatesRoutes.view,
        params: { folderPath: folderPathSegments(currentPath.value) },
        query: uuid ? { template: uuid } : {},
      })
    }

    const draggingTemplate = ref<Template | null>(null)
    const draggingFolder = ref<TemplateFolder | null>(null)

    const loadDataMutation = useMutation(
      async () => {
        const [t, f] = await Promise.all([
          trpc.template.list.query(),
          trpc.template.listFolders.query(),
        ])
        return { t, f }
      },
      {
        onSuccess: ({ t, f }) => {
          templates.value = t
          folders.value = f
        },
      }
    )
    const loading = loadDataMutation.loading
    const loadData = () => loadDataMutation.run()

    const nameComparator = (sort: SortState) => {
      const dir = sort.dir === 'desc' ? -1 : 1
      return (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name) * dir
    }

    const currentFolders = computed(() =>
      folders.value
        .filter((f) => {
          const parentPath = f.path.split('/').slice(0, -1).join('/')
          return parentPath === currentPath.value
        })
        .sort(nameComparator(store.templateSort))
    )

    const currentTemplates = computed(() =>
      templates.value
        .filter((t) => (t.folder ?? '') === currentPath.value)
        .sort(nameComparator(store.templateSort))
    )

    const breadcrumbs = computed(() => {
      const parts = currentPath.value.split('/').filter(Boolean)
      const crumbs = [{ name: 'Templates', path: '' }]
      let path = ''
      for (const part of parts) {
        path = path ? `${path}/${part}` : part
        crumbs.push({ name: part, path })
      }
      return crumbs
    })

    // All tRPC mutations flow through `useMutation`: parsed errors land in a
    // toast via the NotificationHost, and `loading` state is observed off the
    // returned `mutation.loading`. No more inline try/catch with console.error.

    const saveTemplateMutation = useMutation(
      async (template: Template) => trpc.template.save.mutate({ template }),
      {
        successMessage: 'Template saved',
        onSuccess: async (_, template) => {
          await loadData()
          tabs.syncFromServer(template)
        },
      }
    )
    const saving = saveTemplateMutation.loading

    async function saveSelectedTemplate() {
      const draft = tabs.activeBuffer.value?.draft.value
      if (!draft || !tabs.activeBuffer.value?.dirty.value) return
      await saveTemplateMutation.run(draft)
    }

    function revertSelectedTemplate() {
      tabs.activeBuffer.value?.revert()
    }

    function selectTemplate(t: Template) {
      tabs.openTab(t)
      updateSelectedInUrl(t.uuid)
    }

    /**
     * Close a tab. If the buffer is dirty, prompt the user; Save persists
     * and closes, Discard drops the draft and closes, Cancel keeps the tab.
     * Returns true if the tab was closed, false on cancel.
     */
    async function closeTab(uuid: string): Promise<boolean> {
      const tab = tabs.tabs.value.find((t) => t.uuid === uuid)
      if (!tab) return false
      if (!tab.buffer.dirty.value) {
        tabs.removeTab(uuid)
        return true
      }
      const choice = await promptUnsavedChanges({
        title: 'Close template?',
        message: `Save changes to "${tab.buffer.draft.value?.name ?? 'this template'}" before closing?`,
        saveAction: async () => {
          const draft = tab.buffer.draft.value
          if (draft) await saveTemplateMutation.run(draft)
        },
      })
      if (choice === 'cancel') return false
      tabs.removeTab(uuid)
      return true
    }

    /**
     * Close every tab in `uuids` serially, prompting once per dirty tab. The
     * first Cancel aborts the rest — matching VS Code's "Close All" behaviour
     * so the user isn't trapped acknowledging dialogs for tabs they already
     * decided to keep.
     */
    async function closeManyTabs(uuids: readonly string[]): Promise<void> {
      for (const uuid of uuids) {
        const closed = await closeTab(uuid)
        if (!closed) return
      }
    }

    const contextMenu = useContextMenu()
    function onTabContextMenu(uuid: string, event: MouseEvent) {
      const others = tabs.tabs.value.filter((t) => t.uuid !== uuid).map((t) => t.uuid)
      const all = tabs.tabs.value.map((t) => t.uuid)
      const items: MenuItemConfig[] = [
        { title: 'Close', onClick: () => void closeTab(uuid) },
        {
          title: 'Close others',
          disabled: others.length === 0,
          onClick: () => void closeManyTabs(others),
        },
        {
          title: 'Close all',
          disabled: all.length === 0,
          onClick: () => void closeManyTabs(all),
        },
      ]
      contextMenu.open(event, items)
    }

    const addTemplateMutation = useMutation(
      async (template: Template) => {
        await trpc.template.save.mutate({ template })
        return template
      },
      {
        successMessage: 'Template created',
        onSuccess: async (template) => {
          await loadData()
          tabs.openTab(template)
          updateSelectedInUrl(template.uuid)
        },
      }
    )

    async function addTemplate() {
      await addTemplateMutation.run(newTemplate(currentPath.value || undefined))
    }

    const duplicateTemplateMutation = useMutation(
      async (template: Template) => {
        await trpc.template.save.mutate({ template })
        return template
      },
      {
        successMessage: 'Template duplicated',
        onSuccess: async (template) => {
          await loadData()
          tabs.openTab(template)
          updateSelectedInUrl(template.uuid)
        },
      }
    )

    async function duplicate(template: Template) {
      const siblings = templates.value.filter((t) => (t.folder ?? '') === (template.folder ?? ''))
      await duplicateTemplateMutation.run(duplicateTemplate(template, siblings))
    }

    const saveFolderMutation = useMutation(
      async (input: { path: string; name: string }) =>
        trpc.template.saveFolder.mutate({ folder: input }),
      { successMessage: 'Folder created', onSuccess: () => loadData() }
    )

    const moveFolderMutation = useMutation(
      async (input: { from: string; to: string }) => trpc.template.moveFolder.mutate(input),
      { onSuccess: () => loadData() }
    )

    const { prompt } = usePrompt()

    async function addFolder() {
      await prompt({
        title: 'Create new folder',
        label: 'Folder name',
        confirmLabel: 'Create',
        validate: (v) => (!v.trim() ? 'Name is required' : null),
        action: async (name) => {
          const folderPath = currentPath.value ? `${currentPath.value}/${name}` : name
          await saveFolderMutation.run({ path: folderPath, name })
        },
      })
    }

    async function renameFolder(folder: TemplateFolder) {
      await prompt({
        title: 'Rename folder',
        label: 'Folder name',
        initialValue: folder.name,
        confirmLabel: 'Rename',
        validate: (v) => (!v.trim() ? 'Name is required' : null),
        action: async (newName) => {
          if (newName === folder.name) return
          const parts = folder.path.split('/')
          parts[parts.length - 1] = newName
          await moveFolderMutation.run({ from: folder.path, to: parts.join('/') })
        },
      })
    }

    const renameTemplateMutation = useMutation(
      async (updated: Template) => {
        await trpc.template.save.mutate({ template: updated })
        return updated
      },
      {
        successMessage: 'Template renamed',
        onSuccess: async (updated) => {
          tabs.syncFromServer(updated)
          await loadData()
        },
      }
    )

    /**
     * Keyboard-accessible equivalent of drag-to-folder. AGENTS.md §18 requires
     * every DnD surface to ship with a keyboard path; this opens a folder-path
     * prompt that calls the same mutation as `onDropOnFolder`. The full
     * WAI-ARIA drag pattern (Space-pick, arrow-navigate, Space-drop,
     * Esc-cancel) is tracked in docs/todo.md.
     */
    async function moveTemplate(template: Template) {
      const known = new Set(folders.value.map((f) => f.path))
      await prompt({
        title: 'Move template to folder',
        label: 'Target folder',
        message: 'Enter the path of an existing folder. Leave empty for the root.',
        initialValue: template.folder ?? '',
        placeholder: 'e.g. java/entity',
        confirmLabel: 'Move',
        validate: (v) => {
          const target = v.trim()
          if (target && !known.has(target)) return `Folder "${target}" does not exist`
          if ((template.folder ?? '') === target) return 'Template is already in this folder'
          return null
        },
        action: async (target) => {
          await moveTemplateMutation.run({ uuid: template.uuid, folder: target.trim() })
        },
      })
    }

    async function moveFolder(folder: TemplateFolder) {
      const known = new Set(folders.value.map((f) => f.path))
      const folderName = folder.path.split('/').pop()!
      await prompt({
        title: 'Move folder to parent',
        label: 'New parent folder',
        message: 'Enter the path of an existing folder. Leave empty for the root.',
        initialValue: folder.path.split('/').slice(0, -1).join('/'),
        placeholder: 'e.g. java',
        confirmLabel: 'Move',
        validate: (v) => {
          const parent = v.trim()
          if (parent && !known.has(parent)) return `Folder "${parent}" does not exist`
          const target = parent ? `${parent}/${folderName}` : folderName
          if (target === folder.path) return 'Folder is already at this location'
          if (target.startsWith(`${folder.path}/`)) return 'Cannot move a folder into itself'
          return null
        },
        action: async (parent) => {
          const target = parent.trim() ? `${parent.trim()}/${folderName}` : folderName
          await moveFolderMutation.run({ from: folder.path, to: target })
        },
      })
    }

    async function renameTemplate(template: Template) {
      await prompt({
        title: 'Rename template',
        label: 'Template name',
        initialValue: template.name,
        confirmLabel: 'Rename',
        validate: (v) => (!v.trim() ? 'Name is required' : null),
        action: async (newName) => {
          if (newName === template.name) return
          await renameTemplateMutation.run({ ...template, name: newName })
        },
      })
    }

    const { confirm } = useConfirm()

    const deleteTemplateMutation = useMutation(
      async (t: Template) => {
        await trpc.template.delete.mutate({ uuid: t.uuid })
        return t
      },
      {
        successMessage: 'Template deleted',
        onSuccess: async (t) => {
          tabs.closeDeletedTemplate(t.uuid)
          updateSelectedInUrl(tabs.activeUuid.value)
          await loadData()
        },
      }
    )

    function deleteTemplate(t: Template) {
      confirm({
        title: 'Delete template',
        message: `Delete template "${t.name}"?`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          await deleteTemplateMutation.run(t)
        },
      })
    }

    function deleteSelectedTemplate() {
      const draft = tabs.activeBuffer.value?.draft.value
      if (draft) deleteTemplate(draft)
    }

    const deleteFolderMutation = useMutation(
      async (f: TemplateFolder) => {
        await trpc.template.deleteFolder.mutate({ path: f.path })
        return f
      },
      {
        successMessage: 'Folder deleted',
        onSuccess: async (f) => {
          // Close every open tab whose template lives in this folder or any
          // descendant. Iterate over a snapshot — closeDeletedTemplate
          // mutates the tabs array.
          const doomed = findTabsInDeletedFolder(tabs.tabs.value, f.path)
          for (const uuid of doomed) tabs.closeDeletedTemplate(uuid)
          updateSelectedInUrl(tabs.activeUuid.value)
          await loadData()
        },
      }
    )

    function deleteFolder(f: TemplateFolder) {
      const inside = templates.value.filter(
        (t) => t.folder === f.path || (t.folder ?? '').startsWith(`${f.path}/`)
      ).length
      const message = `Delete folder "${f.name}"${
        inside ? ` and ${inside} template${inside === 1 ? '' : 's'} inside` : ''
      }?`
      confirm({
        title: 'Delete folder',
        message,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          await deleteFolderMutation.run(f)
        },
      })
    }

    function onTemplateUpdate(t: Template) {
      // Buffer edits locally on the active tab; persistence happens via Save.
      const buffer = tabs.activeBuffer.value
      if (buffer) buffer.draft.value = t
    }

    function onDragStart(
      e: DragEvent,
      item: Template | TemplateFolder,
      type: 'template' | 'folder'
    ) {
      if (type === 'template') {
        draggingTemplate.value = item as Template
        draggingFolder.value = null
      } else {
        draggingFolder.value = item as TemplateFolder
        draggingTemplate.value = null
      }

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'text/plain',
          type === 'template' ? (item as Template).uuid : (item as TemplateFolder).path
        )

        const target = (e.target as HTMLElement)?.closest?.('.v-list-item') as HTMLElement
        if (target) {
          const rect = target.getBoundingClientRect()
          const ghost = target.cloneNode(true) as HTMLElement
          document.body.appendChild(ghost)
          ghost.style.width = `${target.offsetWidth}px`
          ghost.style.position = 'absolute'
          ghost.style.top = '-1000px'
          ghost.style.left = '-1000px'
          ghost.style.opacity = '0.8'
          ghost.style.pointerEvents = 'none'
          ghost.classList.add(`v-theme--${theme.global.name.value}`)
          e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top)
          // `setDragImage` rasterises synchronously and only needs the
          // node attached briefly. queueMicrotask drops the ghost before
          // the next paint without leaking a timer that could fire after
          // unmount (which `setTimeout(..., 0)` does).
          queueMicrotask(() => {
            if (ghost.parentNode) ghost.parentNode.removeChild(ghost)
          })
        }

        e.stopPropagation()
      }
    }

    const moveTemplateMutation = useMutation(
      async (input: { uuid: string; folder: string }) => trpc.template.move.mutate(input),
      {
        onSuccess: async (_, input) => {
          await loadData()
          const updated = templates.value.find((t) => t.uuid === input.uuid)
          if (updated) tabs.syncFromServer(updated)
        },
      }
    )

    async function onDropOnFolder(folder: TemplateFolder) {
      if (draggingTemplate.value) {
        const t = draggingTemplate.value
        draggingTemplate.value = null
        if ((t.folder ?? '') === folder.path) return
        await moveTemplateMutation.run({ uuid: t.uuid, folder: folder.path })
      } else if (draggingFolder.value) {
        const src = draggingFolder.value
        draggingFolder.value = null
        const folderName = src.path.split('/').pop()!
        const newPath = folder.path ? `${folder.path}/${folderName}` : folderName
        if (src.path === newPath || newPath.startsWith(`${src.path}/`)) return
        await moveFolderMutation.run({ from: src.path, to: newPath })
      }
    }

    const { width: leftWidth, onResize: onResizeLeft } = usePanelResize(260, 160, 480)
    const { width: rightWidth, onResize: onResizeRight } = usePanelResize(300, 200, 500)

    type TreeRow =
      | { kind: 'folder'; folder: TemplateFolder; depth: number; expanded: boolean }
      | { kind: 'template'; template: Template; depth: number }

    const expandedSet = computed(() => new Set(store.templateTreeExpanded))

    const toggleFolder = (path: string) => {
      const next = new Set(expandedSet.value)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      store.templateTreeExpanded = Array.from(next)
    }

    const treeRows = computed<TreeRow[]>(() => {
      const rows: TreeRow[] = []
      const cmp = nameComparator(store.templateSort)
      const childFolders = (parentPath: string): TemplateFolder[] =>
        folders.value
          .filter((f) => {
            const segs = f.path.split('/')
            const parent = segs.slice(0, -1).join('/')
            return parent === parentPath
          })
          .sort(cmp)

      const childTemplates = (parentPath: string): Template[] =>
        templates.value.filter((t) => (t.folder ?? '') === parentPath).sort(cmp)

      const walk = (parentPath: string, depth: number) => {
        for (const f of childFolders(parentPath)) {
          const expanded = expandedSet.value.has(f.path)
          rows.push({ kind: 'folder', folder: f, depth, expanded })
          if (expanded) walk(f.path, depth + 1)
        }
        for (const t of childTemplates(parentPath)) {
          rows.push({ kind: 'template', template: t, depth })
        }
      }
      walk('', 0)
      return rows
    })

    // URL → tabs. `?template=<uuid>` drives the active tab; switching tabs
    // updates the URL via `selectTemplate` / `updateSelectedInUrl`. The URL
    // only ever carries the active tab uuid (open tabs are ephemeral; see
    // plan: "Persisting open-tabs list" is out of scope).
    watch(
      [() => route.query.template, templates],
      ([uuid]) => {
        const id = typeof uuid === 'string' ? uuid : ''
        if (!id) {
          if (tabs.activeUuid.value !== null) tabs.activeUuid.value = null
          return
        }
        if (tabs.activeUuid.value === id) return
        const found = templates.value.find((t) => t.uuid === id)
        if (found) tabs.openTab(found)
      },
      { immediate: true }
    )

    // Tabs → URL. Switching tabs through the tab strip mirrors active uuid
    // back to the URL so deep-link + reload restore the same active tab.
    watch(
      () => tabs.activeUuid.value,
      (uuid) => {
        if (uuid !== (route.query.template ?? null)) updateSelectedInUrl(uuid)
      }
    )

    onMounted(loadData)

    const viewOptions = computed<MenuItemConfig[]>(() => [
      {
        key: 'view-as',
        group: true,
        title: 'View as',
        items: [
          {
            key: 'tree',
            title: 'Tree',
            icon: TreeViewIcon,
            checked: store.templateViewMode === 'tree',
            onClick: () => (store.templateViewMode = 'tree'),
          },
          {
            key: 'list',
            title: 'List',
            icon: ListViewIcon,
            checked: store.templateViewMode === 'list',
            onClick: () => (store.templateViewMode = 'list'),
          },
        ],
      },
    ])

    const templateSortItems = computed<MenuItemConfig[]>(() => {
      const sort = store.templateSort
      const setBy = (by: SortState['by']) => () =>
        (store.templateSort = { ...store.templateSort, by })
      const setDir = (dir: SortState['dir']) => () =>
        (store.templateSort = { ...store.templateSort, dir })
      return [
        { key: 'by-name', title: 'Name', checked: sort.by === 'name', onClick: setBy('name') },
        { key: 'by-type', title: 'Type', disabled: true, checked: sort.by === 'type' },
        {
          key: 'by-modified',
          title: 'Modified',
          disabled: true,
          checked: sort.by === 'modified',
        },
        { key: 'by-size', title: 'Size', disabled: true, checked: sort.by === 'size' },
        { divider: true, key: 'd' },
        {
          key: 'asc',
          title: 'Ascending',
          checked: sort.dir === 'asc',
          onClick: setDir('asc'),
        },
        {
          key: 'desc',
          title: 'Descending',
          checked: sort.dir === 'desc',
          onClick: setDir('desc'),
        },
      ]
    })

    const templateRowMenu = (
      onRename: () => void,
      onDuplicate: () => void,
      onMove: () => void,
      onDelete: () => void
    ): MenuItemConfig[] => [
      { title: 'Rename', icon: EditIcon, onClick: onRename },
      { title: 'Duplicate', icon: DuplicateIcon, onClick: onDuplicate },
      { title: 'Move to folder…', icon: MoveToFolderIcon, onClick: onMove },
      { title: 'Delete', icon: DeleteIcon, color: 'error', onClick: onDelete },
    ]

    const folderRowMenu = (
      onRename: () => void,
      onMove: () => void,
      onDelete: () => void
    ): MenuItemConfig[] => [
      { title: 'Rename', icon: EditIcon, onClick: onRename },
      { title: 'Move to folder…', icon: MoveToFolderIcon, onClick: onMove },
      { title: 'Delete', icon: DeleteIcon, color: 'error', onClick: onDelete },
    ]

    return () => (
      <div class="d-flex flex-column fill-height">
        <AppTitleBar>
          {{
            title: () => (
              <div class="d-flex align-center ga-3">
                <WorkspaceSelector labelPrefix="Templates" />
                <div class="d-flex align-center">
                  {breadcrumbs.value.map((crumb, index) => (
                    <>
                      <span style={{ cursor: 'pointer' }} onClick={() => goToFolder(crumb.path)}>
                        {crumb.name}
                      </span>
                      {index < breadcrumbs.value.length - 1 && <span class="mx-2">/</span>}
                    </>
                  ))}
                </div>
                <VBtn
                  prepend-icon={AddIcon}
                  variant="tonal"
                  color="primary"
                  size="small"
                  onClick={addTemplate}
                >
                  New template
                </VBtn>
              </div>
            ),
            actions: () => (
              <>
                {selectedTemplate.value && (
                  <>
                    <VBtn
                      variant="text"
                      disabled={!templateDirty.value || saving.value}
                      onClick={revertSelectedTemplate}
                    >
                      Reset
                    </VBtn>
                    <VBtn
                      variant="tonal"
                      color="primary"
                      disabled={!templateDirty.value}
                      loading={saving.value}
                      onClick={saveSelectedTemplate}
                    >
                      Save
                    </VBtn>
                  </>
                )}
              </>
            ),
          }}
        </AppTitleBar>

        <div class={['d-flex', 'flex-grow-1', 'py-2', 'pr-2']} style="min-height: 0; gap: 0">
          <VCard
            class="d-flex flex-column flex-shrink-0 overflow-hidden"
            style={{ width: `${leftWidth.value}px` }}
            elevation={2}
            rounded="lg"
          >
            <ViewCardHeader viewOptions={viewOptions.value} sortItems={templateSortItems.value}>
              {{
                actions: () => (
                  <>
                    <VTooltip text="New folder" location="bottom">
                      {{
                        activator: ({ props }: { props: Record<string, unknown> }) => (
                          <VBtn
                            {...props}
                            icon={CreateNewFolderIcon}
                            variant="text"
                            size="small"
                            density="comfortable"
                            aria-label="New folder"
                            onClick={addFolder}
                          />
                        ),
                      }}
                    </VTooltip>
                    {selectedTemplate.value && (
                      <VTooltip text="Delete template" location="bottom">
                        {{
                          activator: ({ props }: { props: Record<string, unknown> }) => (
                            <VBtn
                              {...props}
                              icon={DeleteIcon}
                              variant="text"
                              size="small"
                              density="comfortable"
                              color="error"
                              aria-label="Delete template"
                              onClick={deleteSelectedTemplate}
                            />
                          ),
                        }}
                      </VTooltip>
                    )}
                  </>
                ),
              }}
            </ViewCardHeader>
            <VList
              {...({
                onDragover: (e: DragEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                },
              } as Record<string, unknown>)}
              class="pa-0 overflow-y-auto flex-grow-1"
            >
              {store.templateViewMode === 'tree' ? (
                treeRows.value.map((row) =>
                  row.kind === 'folder' ? (
                    <FileEntryListItem
                      key={`f-${row.folder.path}`}
                      name={row.folder.name}
                      isDirectory
                      onClick={() => toggleFolder(row.folder.path)}
                      {...({
                        style: { paddingLeft: `${row.depth * 16 + 8}px` },
                        draggable: true,
                        onDragstart: (e: DragEvent) => onDragStart(e, row.folder, 'folder'),
                        onDragover: (e: DragEvent) => e.preventDefault(),
                        onDrop: () => onDropOnFolder(row.folder),
                      } as Record<string, unknown>)}
                    >
                      {{
                        icon: () => (
                          <span class={styles.iconWithChevron}>
                            <span class={styles.chevronSlot}>
                              <VIcon
                                icon={ChevronRightIcon}
                                size={16}
                                class={[styles.chevron, row.expanded && styles.chevronExpanded]}
                              />
                            </span>
                            <FileEntryIcon isDirectory />
                          </span>
                        ),
                        append: () => (
                          <MenuButton
                            icon={MoreIcon}
                            tooltip="More actions"
                            items={folderRowMenu(
                              () => renameFolder(row.folder),
                              () => moveFolder(row.folder),
                              () => deleteFolder(row.folder)
                            )}
                          />
                        ),
                      }}
                    </FileEntryListItem>
                  ) : (
                    <FileEntryListItem
                      key={`t-${row.template.uuid}`}
                      name={row.template.name}
                      subtitle={row.template.description}
                      active={selectedTemplate.value?.uuid === row.template.uuid}
                      onClick={() => selectTemplate(row.template)}
                      {...({
                        style: { paddingLeft: `${row.depth * 16 + 8}px` },
                        draggable: true,
                        onDragstart: (e: DragEvent) => onDragStart(e, row.template, 'template'),
                      } as Record<string, unknown>)}
                    >
                      {{
                        icon: () => (
                          <span class={styles.iconWithChevron}>
                            <span class={styles.chevronSlot} />
                            <FileEntryIcon />
                          </span>
                        ),
                        append: () => (
                          <MenuButton
                            icon={MoreIcon}
                            tooltip="More actions"
                            items={templateRowMenu(
                              () => renameTemplate(row.template),
                              () => duplicate(row.template),
                              () => moveTemplate(row.template),
                              () => deleteTemplate(row.template)
                            )}
                          />
                        ),
                      }}
                    </FileEntryListItem>
                  )
                )
              ) : (
                <>
                  {currentPath.value && (
                    <FileEntryListItem
                      name=".. (Parent Folder)"
                      isParent
                      onClick={() => {
                        const parts = currentPath.value.split('/')
                        parts.pop()
                        goToFolder(parts.join('/'))
                      }}
                      {...({
                        onDragover: (e: DragEvent) => e.preventDefault(),
                        onDrop: () => {
                          const parts = currentPath.value.split('/')
                          parts.pop()
                          onDropOnFolder({ path: parts.join('/'), name: 'Parent' })
                        },
                      } as Record<string, unknown>)}
                    />
                  )}

                  {currentFolders.value.map((f) => (
                    <FileEntryListItem
                      key={f.path}
                      name={f.name}
                      isDirectory
                      onClick={() => goToFolder(f.path)}
                      {...({
                        draggable: true,
                        onDragstart: (e: DragEvent) => onDragStart(e, f, 'folder'),
                        onDragover: (e: DragEvent) => e.preventDefault(),
                        onDrop: () => onDropOnFolder(f),
                      } as Record<string, unknown>)}
                    >
                      {{
                        append: () => (
                          <MenuButton
                            icon={MoreIcon}
                            tooltip="More actions"
                            items={folderRowMenu(
                              () => renameFolder(f),
                              () => moveFolder(f),
                              () => deleteFolder(f)
                            )}
                          />
                        ),
                      }}
                    </FileEntryListItem>
                  ))}

                  {currentTemplates.value.map((t) => (
                    <FileEntryListItem
                      key={t.uuid}
                      name={t.name}
                      subtitle={t.description}
                      active={selectedTemplate.value?.uuid === t.uuid}
                      onClick={() => selectTemplate(t)}
                      {...({
                        draggable: true,
                        onDragstart: (e: DragEvent) => onDragStart(e, t, 'template'),
                      } as Record<string, unknown>)}
                    >
                      {{
                        append: () => (
                          <MenuButton
                            icon={MoreIcon}
                            tooltip="More actions"
                            items={templateRowMenu(
                              () => renameTemplate(t),
                              () => duplicate(t),
                              () => moveTemplate(t),
                              () => deleteTemplate(t)
                            )}
                          />
                        ),
                      }}
                    </FileEntryListItem>
                  ))}
                </>
              )}
            </VList>

            {((store.templateViewMode === 'tree' && treeRows.value.length === 0) ||
              (store.templateViewMode === 'list' &&
                currentFolders.value.length === 0 &&
                currentTemplates.value.length === 0)) &&
              !loading.value && (
                <VEmptyState
                  icon={TemplatesIcon}
                  title="No templates yet"
                  text="Add a template or create a folder to organise them."
                />
              )}
          </VCard>

          <PanelDivider onResize={onResizeLeft} />

          {tabs.tabs.value.length > 0 ? (
            <div class="flex-grow-1 overflow-hidden d-flex flex-column" style="min-width: 0">
              <TemplateTabs
                tabs={tabs.tabs.value}
                activeUuid={tabs.activeUuid.value}
                onUpdate:activeUuid={(uuid: string) => (tabs.activeUuid.value = uuid)}
                onClose={(uuid: string) => {
                  void closeTab(uuid)
                }}
                onContextmenu={onTabContextMenu}
              >
                {{
                  append: () =>
                    !sidePanelOpen.value && selectedTemplate.value ? (
                      <VTooltip text="Show properties" location="bottom">
                        {{
                          activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                            <VBtn
                              {...tipProps}
                              icon={InfoIcon}
                              variant="text"
                              size="small"
                              density="comfortable"
                              aria-label="Show properties"
                              onClick={() => (sidePanelOpen.value = true)}
                            />
                          ),
                        }}
                      </VTooltip>
                    ) : null,
                }}
              </TemplateTabs>
              {selectedTemplate.value && (
                <TemplateEditor
                  template={selectedTemplate.value}
                  onUpdate:template={onTemplateUpdate}
                />
              )}
            </div>
          ) : (
            <div class="flex-grow-1 d-flex align-center justify-center" style="min-width: 0">
              <VEmptyState
                icon={TemplatesIcon}
                title="No template"
                text="Select a template from the left or create a new one."
              >
                {{
                  actions: () => (
                    <VBtn
                      prepend-icon={AddIcon}
                      variant="tonal"
                      color="primary"
                      onClick={addTemplate}
                    >
                      Create a new template
                    </VBtn>
                  ),
                }}
              </VEmptyState>
            </div>
          )}

          {selectedTemplate.value && sidePanelOpen.value && (
            <>
              <PanelDivider onResize={(delta) => onResizeRight(-delta)} />
              <SidePanel
                title="Properties"
                icon={PropertiesIcon}
                width={rightWidth.value}
                onClose={() => {
                  sidePanelOpen.value = false
                }}
              >
                {{
                  default: () => (
                    <>
                      <VTextField
                        modelValue={nameField.value ?? ''}
                        onUpdate:modelValue={(v: string) => (nameField.value = v)}
                        label="Name"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                      />
                      <VTextField
                        modelValue={versionField.value ?? ''}
                        onUpdate:modelValue={(v: string) => (versionField.value = v)}
                        label="Version"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                      />
                      <VSelect
                        modelValue={scopeField.value ?? null}
                        onUpdate:modelValue={(v: (typeof TEMPLATE_SCOPES)[number] | null) =>
                          (scopeField.value = v ?? undefined)
                        }
                        items={TEMPLATE_SCOPES as unknown as string[]}
                        label="Scope"
                        variant="outlined"
                        density="compact"
                        clearable
                        hint="Legacy fallback. Prefer a loop cell for new templates."
                        persistentHint
                        class="mb-2"
                      />
                      <VTextField
                        modelValue={descriptionField.value ?? ''}
                        onUpdate:modelValue={(v: string) =>
                          // Normalize "" back to undefined so dirty doesn't
                          // flip on an innocuous touch-and-blur.
                          (descriptionField.value = v === '' ? undefined : v)
                        }
                        label="Description"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                      />
                      <VAutocomplete
                        modelValue={extendsField.value ?? null}
                        onUpdate:modelValue={(v: string | null) =>
                          (extendsField.value = v ?? undefined)
                        }
                        items={otherTemplatesForExtend.value}
                        label="Extends"
                        variant="outlined"
                        density="compact"
                        clearable
                        hint="Parent template this one inherits from (no resolver yet)."
                        persistentHint
                        no-data-text="No other templates available"
                        class="mb-2"
                      />
                      <VSwitch
                        modelValue={disabledField.value ?? false}
                        label="Disabled"
                        hint="When on, this template is skipped during code generation"
                        persistentHint
                        color="primary"
                        density="compact"
                        hideDetails={false}
                        onUpdate:modelValue={(v: boolean | null) =>
                          (disabledField.value = v ? true : undefined)
                        }
                      />
                    </>
                  ),
                }}
              </SidePanel>
            </>
          )}
        </div>
      </div>
    )
  },
})
