import { CodeEditor } from '@xomda/codeeditor'
import {
  AddIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  MoreIcon,
  TemplatesIcon as TemplatesViewIcon,
} from '@xomda/icons'
import type { Model } from '@xomda/model'
import type { HandlebarsTemplate, HandlebarsTemplateFolder } from '@xomda/template'
import { DynamicForm, FileEntryIcon, TitleBar, useModelEntity } from '@xomda/ui'
import { debounce } from 'lodash-es'
import type { JsonObject } from 'type-fest'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VCheckbox,
  VDialog,
  VEmptyState,
  VList,
  VListItem,
  VMenu,
  VSpacer,
  VSwitch,
  VTextField,
} from 'vuetify/components'

import { PanelDivider } from '../components'
import { usePanelResize } from '../composables'
import { trpc } from '../trpc'
import styles from './TemplatesView.module.scss'

export const TemplatesView = defineComponent({
  name: 'TemplatesView',
  setup() {
    const theme = useTheme()
    const route = useRoute()
    const router = useRouter()
    const templates = ref<HandlebarsTemplate[]>([])
    const folders = ref<HandlebarsTemplateFolder[]>([])
    const appModel = ref<Model | null>(null)
    const selectedTemplate = ref<HandlebarsTemplate | null>(null)
    const loading = ref(false)
    const showAsHandlebars = ref(true)

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

    const updateSelectedInUrl = (templateId: string | null) => {
      router.replace({
        name: 'templates',
        params: { folderPath: folderPathSegments(currentPath.value) },
        query: templateId ? { template: templateId } : {},
      })
    }

    const templateEntity = useModelEntity(appModel, 'Template')

    const getIconForTemplate = (t: HandlebarsTemplate) => {
      const language = t.language?.toLowerCase()
      if (language === 'java') return 'devicon:java'
      if (language === 'typescript' || language === 'ts') return 'devicon:typescript'
      if (language === 'javascript' || language === 'js') return 'devicon:javascript'
      if (language === 'html') return 'devicon:html5'
      if (language === 'css') return 'devicon:css3'
      if (language === 'xml') return 'devicon:xml'
      if (language === 'json') return 'devicon:json'
      if (language === 'markdown' || language === 'md') return 'devicon:markdown'
      if (language === 'yaml' || language === 'yml') return 'devicon:yaml'
      if (language === 'python' || language === 'py') return 'devicon:python'
      if (language === 'go') return 'devicon:go'
      if (language === 'rust') return 'devicon:rust'
      if (language === 'csharp' || language === 'cs') return 'devicon:csharp'
      if (language === 'cpp' || language === 'c++') return 'devicon:cplusplus'
      if (language === 'c') return 'devicon:c'
      return null
    }

    async function loadData() {
      loading.value = true
      try {
        const [t, f, m] = await Promise.all([
          trpc.handlebarsTemplate.list.query(),
          trpc.handlebarsTemplate.listFolders.query(),
          trpc.model.get.query(),
        ])
        templates.value = t
        folders.value = f
        appModel.value = m
      } catch (e) {
        console.error('Failed to load templates, folders, or model', e)
      } finally {
        loading.value = false
      }
    }

    const currentFolders = computed(() => {
      return folders.value.filter((f: HandlebarsTemplateFolder) => {
        const parentPath = f.path.split('/').slice(0, -1).join('/')
        return parentPath === currentPath.value
      })
    })

    const currentTemplates = computed(() => {
      return templates.value.filter((t: HandlebarsTemplate) => {
        const templatePath = t.path || ''
        const parentPath = templatePath.split('/').slice(0, -1).join('/')
        return parentPath === currentPath.value
      })
    })

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

    async function selectTemplate(template: HandlebarsTemplate) {
      selectedTemplate.value = { ...template }
      showAsHandlebars.value = true
      updateSelectedInUrl(template.id)
    }

    async function renameTemplate(newId: string) {
      if (!selectedTemplate.value || !newId || selectedTemplate.value.id === newId) return

      const oldPath = selectedTemplate.value.path || selectedTemplate.value.id
      const pathParts = oldPath.split('/')
      pathParts[pathParts.length - 1] = newId
      const newPath = pathParts.join('/')

      try {
        await trpc.handlebarsTemplate.move.mutate({ oldPath, newPath })
        selectedTemplate.value.id = newId
        selectedTemplate.value.path = newPath
        await loadData()
        updateSelectedInUrl(newId)
      } catch (e) {
        console.error('Failed to rename template', e)
      }
    }

    async function renameTemplatePrompt(template: HandlebarsTemplate) {
      const newId = prompt('New template ID (filename):', template.id)
      if (!newId || newId === template.id) return
      await renameTemplate(newId)
    }

    async function addTemplate() {
      const id = `template-${Date.now()}`
      const templatePath = currentPath.value ? `${currentPath.value}/${id}` : id
      const newTemplate: HandlebarsTemplate = {
        id,
        path: templatePath,
        name: 'New Template',
        outputPath: 'src/{{name}}.txt',
        content: 'Hello {{name}}!',
        language: 'handlebars',
        scope: 'Entity',
      }
      try {
        await trpc.handlebarsTemplate.save.mutate(newTemplate)
        await loadData()
        selectedTemplate.value = newTemplate
        updateSelectedInUrl(newTemplate.id)
      } catch (e) {
        console.error('Failed to add template', e)
      }
    }

    async function addFolder() {
      const name = prompt('Folder name:')
      if (!name) return
      const folderPath = currentPath.value ? `${currentPath.value}/${name}` : name
      try {
        await trpc.handlebarsTemplate.saveFolder.mutate({
          path: folderPath,
          name,
        })
        await loadData()
      } catch (e) {
        console.error('Failed to add folder', e)
      }
    }

    async function renameFolder(folder: HandlebarsTemplateFolder) {
      const newName = prompt('New folder name:', folder.name)
      if (!newName || newName === folder.name) return

      const oldPath = folder.path
      const pathParts = oldPath.split('/')
      pathParts[pathParts.length - 1] = newName
      const newPath = pathParts.join('/')

      try {
        // We use moveFolder to rename the physical directory
        await trpc.handlebarsTemplate.moveFolder.mutate({ oldPath, newPath })
        // If it has metadata, we might need to update the name in .folder.json too
        // but moveFolder renames the directory which contains .folder.json.
        // The listFolders will pick up the new directory name as the default name.
        await loadData()
      } catch (e) {
        console.error('Failed to rename folder', e)
      }
    }

    const debouncedSave = debounce(async (templateToSave: HandlebarsTemplate) => {
      if (!templateToSave) return
      try {
        await trpc.handlebarsTemplate.save.mutate(templateToSave)
        await loadData()
      } catch (e) {
        console.error('Failed to save template', e)
      }
    }, 500)

    async function saveTemplate() {
      if (selectedTemplate.value) {
        debouncedSave(selectedTemplate.value)
      }
    }

    // Delete confirmation dialog state
    const confirmDialog = ref(false)
    const confirmTitle = ref('')
    const confirmMessage = ref('')
    const confirmAction = ref<(() => Promise<void>) | null>(null)
    const confirmLoading = ref(false)

    async function openConfirm(title: string, message: string, action: () => Promise<void>) {
      confirmTitle.value = title
      confirmMessage.value = message
      confirmAction.value = action
      confirmDialog.value = true
    }

    async function handleConfirm() {
      if (!confirmAction.value) return
      confirmLoading.value = true
      try {
        await confirmAction.value()
        confirmDialog.value = false
        await loadData()
      } finally {
        confirmLoading.value = false
      }
    }

    const draggingTemplate = ref<HandlebarsTemplate | null>(null)
    const draggingFolder = ref<HandlebarsTemplateFolder | null>(null)

    function onDragStart(
      e: DragEvent,
      item: HandlebarsTemplate | HandlebarsTemplateFolder,
      type: 'template' | 'folder'
    ) {
      if (type === 'template') {
        draggingTemplate.value = item as HandlebarsTemplate
        draggingFolder.value = null
      } else {
        draggingFolder.value = item as HandlebarsTemplateFolder
        draggingTemplate.value = null
      }

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData(
          'text/plain',
          type === 'template'
            ? (item as HandlebarsTemplate).id
            : (item as HandlebarsTemplateFolder).path
        )

        // Create a custom drag ghost to ensure consistent behavior across browsers (especially Firefox)
        const target = (e.target as HTMLElement)?.closest?.('.v-list-item') as HTMLElement
        if (target) {
          const rect = target.getBoundingClientRect()
          const offsetX = e.clientX - rect.left
          const offsetY = e.clientY - rect.top

          const ghostParent = document.body

          const ghost = target.cloneNode(true) as HTMLElement
          ghostParent.appendChild(ghost)

          ghost.style.width = `${target.offsetWidth}px`
          ghost.style.position = 'absolute'
          ghost.style.top = '-1000px'
          ghost.style.left = '-1000px'
          ghost.style.opacity = '0.8'
          ghost.style.pointerEvents = 'none'
          ghost.classList.add(`v-theme--${theme.global.name.value}`)

          // We use a small timeout to remove the ghost from the DOM
          // setDragImage needs the element to be in the DOM during the call
          e.dataTransfer.setDragImage(ghost, offsetX, offsetY)

          setTimeout(() => {
            if (ghost.parentNode) {
              ghostParent.removeChild(ghost)
            }
          }, 0)
        }

        e.stopPropagation()
      }
    }

    async function onDropOnFolder(folder: HandlebarsTemplateFolder) {
      if (draggingTemplate.value) {
        const template = draggingTemplate.value
        draggingTemplate.value = null

        const oldPath = template.path || template.id
        const fileName = oldPath.split('/').pop()
        const newPath = `${folder.path}/${fileName}`

        if (oldPath === newPath) return

        try {
          await trpc.handlebarsTemplate.move.mutate({ oldPath, newPath })
          await loadData()
        } catch (e) {
          console.error('Failed to move template', e)
        }
      } else if (draggingFolder.value) {
        const sourceFolder = draggingFolder.value
        draggingFolder.value = null

        const oldPath = sourceFolder.path
        const folderName = oldPath.split('/').pop()
        const newPath = folder.path ? `${folder.path}/${folderName}` : folderName!

        if (oldPath === newPath) return
        // Prevent dropping a folder into itself or its subfolder
        if (newPath.startsWith(`${oldPath}/`)) return

        try {
          await trpc.handlebarsTemplate.moveFolder.mutate({ oldPath, newPath })
          await loadData()
        } catch (e) {
          console.error('Failed to move folder', e)
        }
      }
    }

    async function deleteTemplate() {
      if (!selectedTemplate.value) return

      openConfirm(
        'Delete Template',
        `Are you sure you want to delete template "${selectedTemplate.value.name}" (${selectedTemplate.value.id})?`,
        async () => {
          await trpc.handlebarsTemplate.delete.mutate(
            selectedTemplate.value!.path || selectedTemplate.value!.id
          )
          selectedTemplate.value = null
          updateSelectedInUrl(null)
        }
      )
    }

    const { width: leftWidth, onResize: onResizeLeft } = usePanelResize(250, 160, 480)
    const { width: rightWidth, onResize: onResizeRight } = usePanelResize(300, 200, 500)

    watch(
      [() => route.query.template, templates],
      ([id]) => {
        const templateId = typeof id === 'string' ? id : ''
        if (!templateId) {
          if (selectedTemplate.value !== null) selectedTemplate.value = null
          return
        }
        if (selectedTemplate.value?.id === templateId) return
        const found = templates.value.find((t) => t.id === templateId)
        if (found) {
          selectedTemplate.value = { ...found }
          showAsHandlebars.value = true
        }
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
                    <div style={{ cursor: 'pointer' }} onClick={() => goToFolder(crumb.path)}>
                      {crumb.name}
                    </div>
                    {index < breadcrumbs.value.length - 1 && <div class="mx-2">/</div>}
                  </>
                ))}
              </div>
            ),
            actions: () => (
              <>
                {selectedTemplate.value && (
                  <VSwitch
                    v-model={showAsHandlebars.value}
                    label={
                      showAsHandlebars.value
                        ? 'Handlebars'
                        : selectedTemplate.value.language || 'Target'
                    }
                    hide-details
                    density="compact"
                    class="mr-4"
                    color="primary"
                  />
                )}
                <VBtn
                  prepend-icon={AddIcon as any}
                  variant="tonal"
                  color="secondary"
                  onClick={addFolder}
                  class="mr-2"
                >
                  Add folder
                </VBtn>
                <VBtn
                  prepend-icon={AddIcon as any}
                  variant="tonal"
                  color="primary"
                  onClick={addTemplate}
                >
                  Add template
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
                <VListItem
                  prependGap={16}
                  title=".. (Parent Folder)"
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
                >
                  {{ prepend: () => <FileEntryIcon isDirectory={true} icon={null} /> }}
                </VListItem>
              )}
              {currentFolders.value.map((f: HandlebarsTemplateFolder) => (
                <VListItem
                  prependGap={16}
                  key={f.path}
                  title={f.name}
                  onClick={() => goToFolder(f.path)}
                  {...({
                    draggable: true,
                    onDragstart: (e: DragEvent) => onDragStart(e, f, 'folder'),
                    onDragover: (e: DragEvent) => e.preventDefault(),
                    onDrop: () => onDropOnFolder(f),
                  } as any)}
                >
                  {{
                    prepend: () => <FileEntryIcon isDirectory={true} icon={null} />,
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
                            <VList density="compact">
                              <VListItem
                                prepend-icon={EditIcon as any}
                                title="Rename"
                                onClick={() => renameFolder(f)}
                              />
                            </VList>
                          ),
                        }}
                      </VMenu>
                    ),
                  }}
                </VListItem>
              ))}
              {currentTemplates.value.map((t: HandlebarsTemplate) => {
                const devIcon = getIconForTemplate(t)
                return (
                  <VListItem
                    prependGap={16}
                    key={t.id}
                    title={t.name}
                    subtitle={`${t.id}.hbs`}
                    onClick={() => selectTemplate(t)}
                    active={selectedTemplate.value?.id === t.id}
                    {...({
                      draggable: true,
                      onDragstart: (e: DragEvent) => onDragStart(e, t, 'template'),
                    } as any)}
                  >
                    {{
                      prepend: () => <FileEntryIcon isDirectory={false} icon={devIcon} />,
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
                              <VList density="compact">
                                <VListItem
                                  prepend-icon={EditIcon as any}
                                  title="Rename"
                                  onClick={() => renameTemplatePrompt(t)}
                                />
                                <VListItem
                                  prepend-icon={DeleteIcon as any}
                                  title="Delete"
                                  color="error"
                                  onClick={() => {
                                    selectTemplate(t)
                                    deleteTemplate()
                                  }}
                                />
                              </VList>
                            ),
                          }}
                        </VMenu>
                      ),
                    }}
                  </VListItem>
                )
              })}
            </VList>
            {currentFolders.value.length === 0 &&
              currentTemplates.value.length === 0 &&
              !loading.value && (
                <div class="pa-4 text-center text-caption text-disabled">Empty</div>
              )}
          </VCard>

          <PanelDivider onResize={onResizeLeft} />

          {selectedTemplate.value ? (
            <VCard
              class="flex-grow-1 overflow-hidden d-flex flex-column"
              style="min-width: 0"
              elevation={2}
              rounded="lg"
              key={selectedTemplate.value.path || selectedTemplate.value.id}
            >
              <CodeEditor
                v-model={selectedTemplate.value.content}
                language={
                  showAsHandlebars.value
                    ? 'handlebars'
                    : selectedTemplate.value.language || 'handlebars'
                }
                theme={theme.global.current.value.dark ? 'vs-dark' : 'vs'}
                onUpdate:modelValue={saveTemplate}
              />
            </VCard>
          ) : (
            <div class="flex-grow-1 d-flex align-center justify-center" style="min-width: 0">
              <VEmptyState
                icon={TemplatesViewIcon as any}
                title="No templates selected"
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
                  <div class="text-overline mb-4">Template</div>
                  <VTextField
                    v-model={selectedTemplate.value.id}
                    label="ID (Filename)"
                    variant="outlined"
                    density="compact"
                    class="mb-2"
                    onUpdate:modelValue={renameTemplate}
                  />
                  {templateEntity.value && (
                    <DynamicForm
                      entity={templateEntity.value}
                      modelValue={selectedTemplate.value as JsonObject}
                      model={appModel.value}
                      fieldOverrides={{
                        content: () => null,
                        path: () => null,
                        disabled: ({ value, onUpdate, onCommit }) => (
                          <VCheckbox
                            modelValue={Boolean(value)}
                            label="Disabled"
                            hide-details
                            density="compact"
                            class="mb-2"
                            color="error"
                            onUpdate:modelValue={(v: boolean | null) => {
                              onUpdate(Boolean(v))
                              onCommit()
                            }}
                          />
                        ),
                      }}
                      onUpdate:modelValue={(v) => {
                        selectedTemplate.value = v as HandlebarsTemplate
                      }}
                      onCommit={saveTemplate}
                    />
                  )}
                  <VBtn
                    block
                    color="error"
                    variant="tonal"
                    prepend-icon={DeleteIcon as any}
                    onClick={deleteTemplate}
                  >
                    Delete HandlebarsTemplate
                  </VBtn>
                </div>
              </VCard>
            </>
          )}
        </div>

        <VDialog v-model={confirmDialog.value} max-width={400}>
          {{
            default: () => (
              <VCard rounded="xl">
                <VCardTitle class="pt-5 px-6">{confirmTitle.value}</VCardTitle>
                <VCardText>{confirmMessage.value}</VCardText>
                <VCardActions class="px-6 pb-5">
                  <VSpacer />
                  <VBtn variant="text" onClick={() => (confirmDialog.value = false)}>
                    Cancel
                  </VBtn>
                  <VBtn
                    variant="tonal"
                    color="error"
                    loading={confirmLoading.value}
                    onClick={handleConfirm}
                  >
                    Delete
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
