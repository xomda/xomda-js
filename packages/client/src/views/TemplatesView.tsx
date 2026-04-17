import {
  AddIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  FolderIcon,
  MoreIcon,
  TemplatesIcon,
} from '@xomda/icons'
import type { Template, TemplateFolder } from '@xomda/template'
import { FileEntryListItem, Menu, useConfirm } from '@xomda/ui'
import { debounce } from 'lodash-es'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VBtn,
  VCard,
  VEmptyState,
  VList,
  VListSubheader,
  VMenu,
  VTextField,
} from 'vuetify/components'

import { PanelDivider, TitleBar } from '../components'
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
    const templates = ref<Template[]>([])
    const folders = ref<TemplateFolder[]>([])
    const selectedTemplate = ref<Template | null>(null)
    const loading = ref(false)

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

    const debouncedSave = debounce(async (template: Template) => {
      try {
        await trpc.template.save.mutate(template)
        await loadData()
      } catch (e) {
        console.error('Failed to save template', e)
      }
    }, 500)

    function selectTemplate(t: Template) {
      selectedTemplate.value = { ...t }
      updateSelectedInUrl(t.uuid)
    }

    async function addTemplate() {
      const t = newTemplate(currentPath.value || undefined)
      try {
        await trpc.template.save.mutate(t)
        await loadData()
        selectedTemplate.value = t
        updateSelectedInUrl(t.uuid)
      } catch (e) {
        console.error('Failed to create template', e)
      }
    }

    async function addFolder() {
      const name = prompt('Folder name:')
      if (!name) return
      const folderPath = currentPath.value ? `${currentPath.value}/${name}` : name
      try {
        await trpc.template.saveFolder.mutate({ path: folderPath, name })
        await loadData()
      } catch (e) {
        console.error('Failed to add folder', e)
      }
    }

    async function renameFolder(folder: TemplateFolder) {
      const newName = prompt('New folder name:', folder.name)
      if (!newName || newName === folder.name) return
      const oldPath = folder.path
      const parts = oldPath.split('/')
      parts[parts.length - 1] = newName
      const newPath = parts.join('/')
      try {
        await trpc.template.moveFolder.mutate({ from: oldPath, to: newPath })
        await loadData()
      } catch (e) {
        console.error('Failed to rename folder', e)
      }
    }

    async function renameTemplate(template: Template) {
      const newName = prompt('New template name:', template.name)
      if (!newName || newName === template.name) return
      const updated = { ...template, name: newName }
      try {
        await trpc.template.save.mutate(updated)
        if (selectedTemplate.value?.uuid === template.uuid) {
          selectedTemplate.value = updated
        }
        await loadData()
      } catch (e) {
        console.error('Failed to rename template', e)
      }
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
      selectedTemplate.value = t
      debouncedSave(t)
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

    watch(
      [() => route.query.template, templates],
      ([uuid]) => {
        const id = typeof uuid === 'string' ? uuid : ''
        if (!id) {
          if (selectedTemplate.value !== null) selectedTemplate.value = null
          return
        }
        if (selectedTemplate.value?.uuid === id) return
        const found = templates.value.find((t) => t.uuid === id)
        if (found) selectedTemplate.value = { ...found }
      },
      { immediate: true }
    )

    onMounted(loadData)

    return () => (
      <div class="d-flex flex-column fill-height">
        <TitleBar>
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
                  <VBtn
                    prepend-icon={DeleteIcon as any}
                    variant="tonal"
                    color="error"
                    onClick={deleteSelectedTemplate}
                    class="mr-2"
                  >
                    Delete
                  </VBtn>
                )}
                <VBtn
                  prepend-icon={FolderIcon as any}
                  variant="tonal"
                  color="secondary"
                  onClick={addFolder}
                  class="mr-2"
                >
                  New folder
                </VBtn>
                <VBtn
                  prepend-icon={AddIcon as any}
                  variant="tonal"
                  color="primary"
                  onClick={addTemplate}
                >
                  New template
                </VBtn>
              </>
            ),
          }}
        </TitleBar>

        <div class="d-flex flex-grow-1 py-2" style="min-height: 0; gap: 0">
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
              } as any)}
              class="pa-0 overflow-y-auto flex-grow-1"
            >
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
                  } as any)}
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
                  } as any)}
                >
                  {{
                    append: () => (
                      <VMenu>
                        {{
                          activator: ({ props }: any) => (
                            <VBtn
                              {...props}
                              icon={MoreIcon as any}
                              variant="text"
                              density="comfortable"
                              size="small"
                              onClick={(e: Event) => e.stopPropagation()}
                            />
                          ),
                          default: () => (
                            <Menu
                              items={[
                                {
                                  title: 'Rename',
                                  icon: EditIcon as any,
                                  onClick: () => renameFolder(f),
                                },
                                {
                                  title: 'Delete',
                                  icon: DeleteIcon as any,
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
                  } as any)}
                >
                  {{
                    append: () => (
                      <VMenu>
                        {{
                          activator: ({ props }: any) => (
                            <VBtn
                              {...props}
                              icon={MoreIcon as any}
                              variant="text"
                              density="comfortable"
                              size="small"
                              onClick={(e: Event) => e.stopPropagation()}
                            />
                          ),
                          default: () => (
                            <Menu
                              items={[
                                {
                                  title: 'Rename',
                                  icon: EditIcon as any,
                                  onClick: () => renameTemplate(t),
                                },
                                {
                                  title: 'Delete',
                                  icon: DeleteIcon as any,
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
            </VList>

            {currentFolders.value.length === 0 &&
              currentTemplates.value.length === 0 &&
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
                icon={TemplatesIcon as any}
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
                  <VBtn
                    icon={CloseIcon as any}
                    variant="text"
                    density="comfortable"
                    onClick={() => {
                      selectedTemplate.value = null
                      updateSelectedInUrl(null)
                    }}
                  />
                </div>
                <div class={styles.sidebarContent}>
                  <VTextField
                    v-model={selectedTemplate.value.name}
                    label="Name"
                    variant="outlined"
                    density="compact"
                    class="mb-2"
                    onUpdate:modelValue={() => onTemplateUpdate(selectedTemplate.value!)}
                  />
                  <VTextField
                    v-model={selectedTemplate.value.description}
                    label="Description"
                    variant="outlined"
                    density="compact"
                    onUpdate:modelValue={() => onTemplateUpdate(selectedTemplate.value!)}
                  />
                </div>
              </VCard>
            </>
          )}
        </div>
      </div>
    )
  },
})
