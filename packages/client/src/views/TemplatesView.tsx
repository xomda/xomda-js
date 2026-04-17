import {
  AddIcon,
  ChevronRightIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  FolderIcon,
  MoreIcon,
  TemplatesIcon,
} from '@xomda/icons'
import type { Template, TemplateFolder } from '@xomda/template'
import {
  FileEntryIcon,
  FileEntryListItem,
  Menu,
  useConfirm,
  useLocalStorageStore,
  usePrompt,
  ViewModeToggle,
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
  VListSubheader,
  VMenu,
  VTextField,
  VToolbar,
  VTooltip,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider } from '../components'
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
    // `selectedTemplate` is the buffered edit state. `originalTemplate` mirrors
    // the last persisted version, so we can compute dirty state and revert.
    const selectedTemplate = ref<Template | null>(null)
    const originalTemplate = ref<Template | null>(null)
    const loading = ref(false)
    const saving = ref(false)

    const templateDirty = computed(() => {
      if (!selectedTemplate.value || !originalTemplate.value) return false
      return JSON.stringify(selectedTemplate.value) !== JSON.stringify(originalTemplate.value)
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

    async function loadData() {
      loading.value = true
      try {
        const [t, f] = await Promise.all([
          trpc.template.list.query(),
          trpc.template.listFolders.query(),
        ])
        templates.value = t
        folders.value = f
      } catch (e) {
        console.error('Failed to load templates', e)
      } finally {
        loading.value = false
      }
    }

    const currentFolders = computed(() =>
      folders.value.filter((f) => {
        const parentPath = f.path.split('/').slice(0, -1).join('/')
        return parentPath === currentPath.value
      })
    )

    const currentTemplates = computed(() =>
      templates.value.filter((t) => (t.folder ?? '') === currentPath.value)
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

    async function saveSelectedTemplate() {
      if (!selectedTemplate.value || !templateDirty.value) return
      saving.value = true
      try {
        await trpc.template.save.mutate(selectedTemplate.value)
        originalTemplate.value = JSON.parse(JSON.stringify(selectedTemplate.value))
        await loadData()
      } catch (e) {
        console.error('Failed to save template', e)
      } finally {
        saving.value = false
      }
    }

    function revertSelectedTemplate() {
      if (!originalTemplate.value) return
      selectedTemplate.value = JSON.parse(JSON.stringify(originalTemplate.value))
    }

    function closeSelectedTemplate() {
      // Cancel on the side panel: discard pending edits and close the panel
      // (i.e. deselect the template).
      selectedTemplate.value = null
      originalTemplate.value = null
      updateSelectedInUrl(null)
    }

    function selectTemplate(t: Template) {
      selectedTemplate.value = JSON.parse(JSON.stringify(t))
      originalTemplate.value = JSON.parse(JSON.stringify(t))
      updateSelectedInUrl(t.uuid)
    }

    async function addTemplate() {
      const t = newTemplate(currentPath.value || undefined)
      try {
        await trpc.template.save.mutate(t)
        await loadData()
        selectedTemplate.value = JSON.parse(JSON.stringify(t))
        originalTemplate.value = JSON.parse(JSON.stringify(t))
        updateSelectedInUrl(t.uuid)
      } catch (e) {
        console.error('Failed to create template', e)
      }
    }

    const { prompt } = usePrompt()

    async function addFolder() {
      await prompt({
        title: 'New folder',
        label: 'Folder name',
        confirmLabel: 'Create',
        validate: (v) => (!v.trim() ? 'Name is required' : null),
        action: async (name) => {
          const folderPath = currentPath.value ? `${currentPath.value}/${name}` : name
          await trpc.template.saveFolder.mutate({ path: folderPath, name })
          await loadData()
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
          const newPath = parts.join('/')
          await trpc.template.moveFolder.mutate({ from: folder.path, to: newPath })
          await loadData()
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
          const updated = { ...template, name: newName }
          await trpc.template.save.mutate(updated)
          if (selectedTemplate.value?.uuid === template.uuid) {
            selectedTemplate.value = JSON.parse(JSON.stringify(updated))
            originalTemplate.value = JSON.parse(JSON.stringify(updated))
          }
          await loadData()
        },
      })
    }

    const { confirm } = useConfirm()

    function deleteTemplate(t: Template) {
      confirm({
        title: 'Delete template',
        message: `Delete template "${t.name}"?`,
        confirmLabel: 'Delete',
        confirmColor: 'error',
        action: async () => {
          try {
            await trpc.template.delete.mutate(t.uuid)
            if (selectedTemplate.value?.uuid === t.uuid) {
              selectedTemplate.value = null
              originalTemplate.value = null
              updateSelectedInUrl(null)
            }
            await loadData()
          } catch (e) {
            console.error('Failed to delete template', e)
          }
        },
      })
    }

    function deleteSelectedTemplate() {
      if (!selectedTemplate.value) return
      deleteTemplate(selectedTemplate.value)
    }

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
          try {
            await trpc.template.deleteFolder.mutate({ path: f.path })
            const sel = selectedTemplate.value
            if (sel && (sel.folder === f.path || (sel.folder ?? '').startsWith(`${f.path}/`))) {
              selectedTemplate.value = null
              originalTemplate.value = null
              updateSelectedInUrl(null)
            }
            await loadData()
          } catch (e) {
            console.error('Failed to delete folder', e)
          }
        },
      })
    }

    function onTemplateUpdate(t: Template) {
      // Buffer edits locally; persistence happens via the explicit Save button.
      selectedTemplate.value = t
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

    async function onDropOnFolder(folder: TemplateFolder) {
      if (draggingTemplate.value) {
        const t = draggingTemplate.value
        draggingTemplate.value = null
        const toFolder = folder.path
        if ((t.folder ?? '') === toFolder) return
        try {
          await trpc.template.move.mutate({ uuid: t.uuid, folder: toFolder })
          await loadData()
        } catch (e) {
          console.error('Failed to move template', e)
        }
      } else if (draggingFolder.value) {
        const src = draggingFolder.value
        draggingFolder.value = null
        const folderName = src.path.split('/').pop()!
        const newPath = folder.path ? `${folder.path}/${folderName}` : folderName
        if (src.path === newPath || newPath.startsWith(`${src.path}/`)) return
        try {
          await trpc.template.moveFolder.mutate({ from: src.path, to: newPath })
          await loadData()
        } catch (e) {
          console.error('Failed to move folder', e)
        }
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
      const childFolders = (parentPath: string): TemplateFolder[] =>
        folders.value
          .filter((f) => {
            const segs = f.path.split('/')
            const parent = segs.slice(0, -1).join('/')
            return parent === parentPath
          })
          .sort((a, b) => a.name.localeCompare(b.name))

      const childTemplates = (parentPath: string): Template[] =>
        templates.value
          .filter((t) => (t.folder ?? '') === parentPath)
          .sort((a, b) => a.name.localeCompare(b.name))

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
          if (selectedTemplate.value !== null) {
            selectedTemplate.value = null
            originalTemplate.value = null
          }
          return
        }
        if (selectedTemplate.value?.uuid === id) return
        const found = templates.value.find((t) => t.uuid === id)
        if (found) {
          selectedTemplate.value = JSON.parse(JSON.stringify(found))
          originalTemplate.value = JSON.parse(JSON.stringify(found))
        }
      },
      { immediate: true }
    )

    onMounted(loadData)

    return () => (
      <div class="d-flex flex-column fill-height">
        <AppTitleBar>
          {{
            title: () => (
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
                    <VBtn
                      prepend-icon={DeleteIcon}
                      variant="tonal"
                      color="error"
                      onClick={deleteSelectedTemplate}
                    >
                      Delete
                    </VBtn>
                  </>
                )}
                <VBtn
                  prepend-icon={FolderIcon}
                  variant="tonal"
                  color="secondary"
                  onClick={addFolder}
                >
                  New folder
                </VBtn>
                <VBtn
                  prepend-icon={AddIcon}
                  variant="tonal"
                  color="primary"
                  onClick={addTemplate}
                >
                  New template
                </VBtn>
              </>
            ),
          }}
        </AppTitleBar>

        <VToolbar density="comfortable" color="transparent">
          <ViewModeToggle v-model={store.templateViewMode} class="ml-4" />
        </VToolbar>

        <div class="d-flex flex-grow-1 py-2 px-2" style="min-height: 0; gap: 0">
          <VCard
            class="d-flex flex-column flex-shrink-0 overflow-hidden"
            style={{ width: `${leftWidth.value}px` }}
            elevation={2}
            rounded="lg"
          >
            <VList
              {...({
                onDragover: (e: DragEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                },
              } as Record<string, unknown>)}
              class="pa-0 overflow-y-auto flex-grow-1"
            >
              {store.templateViewMode === 'tree'
                ? treeRows.value.map((row) =>
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
                            <VMenu>
                              {{
                                activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                                  <VTooltip text="More actions" location="bottom">
                                    {{
                                      activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                                        <VBtn
                                          {...menuProps}
                                          {...tipProps}
                                          icon={MoreIcon}
                                          variant="text"
                                          density="comfortable"
                                          size="small"
                                          aria-label="More actions"
                                          onClick={(e: Event) => e.stopPropagation()}
                                        />
                                      ),
                                    }}
                                  </VTooltip>
                                ),
                                default: () => (
                                  <Menu
                                    items={[
                                      {
                                        title: 'Rename',
                                        icon: EditIcon,
                                        onClick: () => renameFolder(row.folder),
                                      },
                                      {
                                        title: 'Delete',
                                        icon: DeleteIcon,
                                        color: 'error',
                                        onClick: () => deleteFolder(row.folder),
                                      },
                                    ]}
                                  />
                                ),
                              }}
                            </VMenu>
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
                            <VMenu>
                              {{
                                activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                                  <VTooltip text="More actions" location="bottom">
                                    {{
                                      activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                                        <VBtn
                                          {...menuProps}
                                          {...tipProps}
                                          icon={MoreIcon}
                                          variant="text"
                                          density="comfortable"
                                          size="small"
                                          aria-label="More actions"
                                          onClick={(e: Event) => e.stopPropagation()}
                                        />
                                      ),
                                    }}
                                  </VTooltip>
                                ),
                                default: () => (
                                  <Menu
                                    items={[
                                      {
                                        title: 'Rename',
                                        icon: EditIcon,
                                        onClick: () => renameTemplate(row.template),
                                      },
                                      {
                                        title: 'Delete',
                                        icon: DeleteIcon,
                                        color: 'error',
                                        onClick: () => deleteTemplate(row.template),
                                      },
                                    ]}
                                  />
                                ),
                              }}
                            </VMenu>
                          ),
                        }}
                      </FileEntryListItem>
                    )
                  )
                : (
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
                          <VMenu>
                            {{
                              activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                                <VTooltip text="More actions" location="bottom">
                                  {{
                                    activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                                      <VBtn
                                        {...menuProps}
                                        {...tipProps}
                                        icon={MoreIcon}
                                        variant="text"
                                        density="comfortable"
                                        size="small"
                                        aria-label="More actions"
                                        onClick={(e: Event) => e.stopPropagation()}
                                      />
                                    ),
                                  }}
                                </VTooltip>
                              ),
                              default: () => (
                                <Menu
                                  items={[
                                    {
                                      title: 'Rename',
                                      icon: EditIcon,
                                      onClick: () => renameFolder(f),
                                    },
                                    {
                                      title: 'Delete',
                                      icon: DeleteIcon,
                                      color: 'error',
                                      onClick: () => deleteFolder(f),
                                    },
                                  ]}
                                />
                              ),
                            }}
                          </VMenu>
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
                          <VMenu>
                            {{
                              activator: ({ props: menuProps }: { props: Record<string, unknown> }) => (
                                <VTooltip text="More actions" location="bottom">
                                  {{
                                    activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                                      <VBtn
                                        {...menuProps}
                                        {...tipProps}
                                        icon={MoreIcon}
                                        variant="text"
                                        density="comfortable"
                                        size="small"
                                        aria-label="More actions"
                                        onClick={(e: Event) => e.stopPropagation()}
                                      />
                                    ),
                                  }}
                                </VTooltip>
                              ),
                              default: () => (
                                <Menu
                                  items={[
                                    {
                                      title: 'Rename',
                                      icon: EditIcon,
                                      onClick: () => renameTemplate(t),
                                    },
                                    {
                                      title: 'Delete',
                                      icon: DeleteIcon,
                                      color: 'error',
                                      onClick: () => deleteTemplate(t),
                                    },
                                  ]}
                                />
                              ),
                            }}
                          </VMenu>
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
              !loading.value && <VListSubheader>No templates yet</VListSubheader>}
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
              <VCard
                class="d-flex flex-column flex-shrink-0 overflow-hidden"
                style={{ width: `${rightWidth.value}px` }}
                elevation={2}
                rounded="lg"
              >
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
                          onClick={() => {
                            selectedTemplate.value = null
                            originalTemplate.value = null
                            updateSelectedInUrl(null)
                          }}
                        />
                      ),
                    }}
                  </VTooltip>
                </div>
                <div class={styles.sidebarContent}>
                  <VTextField
                    v-model={selectedTemplate.value.name}
                    label="Name"
                    variant="outlined"
                    density="compact"
                    class="mb-2"
                  />
                  <VTextField
                    v-model={selectedTemplate.value.description}
                    label="Description"
                    variant="outlined"
                    density="compact"
                  />
                </div>
                <div class={styles.sidebarFooter}>
                  <VBtn
                    variant="text"
                    disabled={saving.value}
                    onClick={closeSelectedTemplate}
                  >
                    Cancel
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
                </div>
              </VCard>
            </>
          )}
        </div>
      </div>
    )
  },
})
