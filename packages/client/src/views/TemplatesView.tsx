import {
  AddIcon,
  ChevronRightIcon,
  CreateNewFolderIcon,
  DeleteIcon,
  EditIcon,
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
  useEditBuffer,
  useLocalStorageStore,
  useMutation,
  usePrompt,
} from '@xomda/ui'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VBtn,
  VCard,
  VEmptyState,
  VIcon,
  VList,
  VSwitch,
  VTextField,
  VTooltip,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider, ViewCardHeader } from '../components'
import { TemplateEditor } from '../components/templates/TemplateEditor'
import { usePanelResize } from '../composables'
import { trpc } from '../trpc'
import styles from './TemplatesView.module.scss'

function newTemplate(folder?: string): Template {
  return {
    uuid: crypto.randomUUID(),
    name: 'New Template',
    version: '1.0.0',
    cells: [],
    ...(folder ? { folder } : {}),
  }
}

export const TemplatesView = defineComponent({
  name: 'TemplatesView',
  setup() {
    const theme = useTheme()
    const route = useRoute()
    const router = useRouter()
    const store = useLocalStorageStore()
    const templates = ref<Template[]>([])
    const folders = ref<TemplateFolder[]>([])
    // `templateBuffer` owns the selected template's edit buffer + dirty state.
    // The view binds to `templateBuffer.draft.value`; `templateBuffer.dirty`
    // gates the Save button.
    const templateBuffer = useEditBuffer<Template>()
    const selectedTemplate = computed(() => templateBuffer.draft.value)
    const templateDirty = computed(() => templateBuffer.dirty.value)

    const currentPath = computed(() => {
      const segs = route.params.folderPath
      if (Array.isArray(segs)) return segs.join('/')
      if (typeof segs === 'string') return segs
      return ''
    })

    const folderPathSegments = (path: string) => (path ? path.split('/') : [])

    const goToFolder = (path: string) => {
      router.push({
        name: 'templates',
        params: { folderPath: folderPathSegments(path) },
        query: {},
      })
    }

    const updateSelectedInUrl = (uuid: string | null) => {
      router.replace({
        name: 'templates',
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
      async (template: Template) => trpc.template.save.mutate(template),
      {
        successMessage: 'Template saved',
        onSuccess: async (_, template) => {
          // Refresh and rebaseline the edit buffer so dirty=false.
          await loadData()
          if (templateBuffer.draft.value?.uuid === template.uuid) {
            templateBuffer.set(template)
          }
        },
      }
    )
    const saving = saveTemplateMutation.loading

    async function saveSelectedTemplate() {
      if (!templateBuffer.draft.value || !templateBuffer.dirty.value) return
      await saveTemplateMutation.run(templateBuffer.draft.value)
    }

    function revertSelectedTemplate() {
      templateBuffer.revert()
    }

    function selectTemplate(t: Template) {
      templateBuffer.set(t)
      updateSelectedInUrl(t.uuid)
    }

    const addTemplateMutation = useMutation(
      async (template: Template) => {
        await trpc.template.save.mutate(template)
        return template
      },
      {
        successMessage: 'Template created',
        onSuccess: async (template) => {
          await loadData()
          templateBuffer.set(template)
          updateSelectedInUrl(template.uuid)
        },
      }
    )

    async function addTemplate() {
      await addTemplateMutation.run(newTemplate(currentPath.value || undefined))
    }

    const saveFolderMutation = useMutation(
      async (input: { path: string; name: string }) => trpc.template.saveFolder.mutate(input),
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
        await trpc.template.save.mutate(updated)
        return updated
      },
      {
        successMessage: 'Template renamed',
        onSuccess: async (updated) => {
          if (templateBuffer.draft.value?.uuid === updated.uuid) {
            templateBuffer.set(updated)
          }
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
        await trpc.template.delete.mutate(t.uuid)
        return t
      },
      {
        successMessage: 'Template deleted',
        onSuccess: async (t) => {
          if (templateBuffer.draft.value?.uuid === t.uuid) {
            templateBuffer.set(null)
            updateSelectedInUrl(null)
          }
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
      if (templateBuffer.draft.value) deleteTemplate(templateBuffer.draft.value)
    }

    const deleteFolderMutation = useMutation(
      async (f: TemplateFolder) => {
        await trpc.template.deleteFolder.mutate({ path: f.path })
        return f
      },
      {
        successMessage: 'Folder deleted',
        onSuccess: async (f) => {
          const sel = templateBuffer.draft.value
          if (sel && (sel.folder === f.path || (sel.folder ?? '').startsWith(`${f.path}/`))) {
            templateBuffer.set(null)
            updateSelectedInUrl(null)
          }
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
      // Buffer edits locally; persistence happens via the explicit Save button.
      templateBuffer.draft.value = t
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
          setTimeout(() => ghost.parentNode && document.body.removeChild(ghost), 0)
        }

        e.stopPropagation()
      }
    }

    const moveTemplateMutation = useMutation(
      async (input: { uuid: string; folder: string }) => trpc.template.move.mutate(input),
      { onSuccess: () => loadData() }
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

    watch(
      [() => route.query.template, templates],
      ([uuid]) => {
        const id = typeof uuid === 'string' ? uuid : ''
        if (!id) {
          if (templateBuffer.draft.value !== null) templateBuffer.set(null)
          return
        }
        if (templateBuffer.draft.value?.uuid === id) return
        const found = templates.value.find((t) => t.uuid === id)
        if (found) templateBuffer.set(found)
      },
      { immediate: true }
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

    const rowMenu = (
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
                            items={rowMenu(
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
                            items={rowMenu(
                              () => renameTemplate(row.template),
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
                            items={rowMenu(
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
                            items={rowMenu(
                              () => renameTemplate(t),
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

          {selectedTemplate.value ? (
            <div class="flex-grow-1 overflow-hidden d-flex flex-column" style="min-width: 0">
              <TemplateEditor
                template={selectedTemplate.value}
                onUpdate:template={onTemplateUpdate}
              />
            </div>
          ) : (
            <div class="flex-grow-1 d-flex align-center justify-center" style="min-width: 0">
              <VEmptyState
                icon={TemplatesIcon}
                title="No template selected"
                text="Select a template from the left or create a new one."
              />
            </div>
          )}

          {selectedTemplate.value && (
            <>
              <PanelDivider onResize={(delta) => onResizeRight(-delta)} />
              <SidePanel
                title="Properties"
                icon={PropertiesIcon}
                width={rightWidth.value}
                onClose={() => {
                  templateBuffer.set(null)
                  updateSelectedInUrl(null)
                }}
              >
                {{
                  default: () => (
                    <>
                      <VTextField
                        v-model={templateBuffer.draft.value!.name}
                        label="Name"
                        variant="outlined"
                        density="compact"
                        class="mb-2"
                      />
                      <VTextField
                        v-model={templateBuffer.draft.value!.description}
                        label="Description"
                        variant="outlined"
                        density="compact"
                      />
                      <VSwitch
                        modelValue={templateBuffer.draft.value!.disabled ?? false}
                        label="Disabled"
                        hint="When on, this template is skipped during code generation"
                        persistentHint
                        color="primary"
                        density="compact"
                        hideDetails={false}
                        onUpdate:modelValue={(v: boolean | null) => {
                          if (!templateBuffer.draft.value) return
                          templateBuffer.draft.value.disabled = v ? true : undefined
                        }}
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
