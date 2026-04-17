import { CodeEditor } from '@xomda/codeeditor'
import { CloseIcon, FolderXomdaIcon, InfoIcon, ParentFolderIcon } from '@xomda/icons'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import {
  VBtn,
  VChip,
  VDivider,
  VFadeTransition,
  VIcon,
  VList,
  VListItem,
  VProgressLinear,
  VSwitch,
  VToolbar,
} from 'vuetify/components'

import { FileEntryIcon, languageFromPath, TitleBar } from '@xomda/ui'
import { useAsyncState } from '../composables'
import { trpc } from '../trpc'

interface FileEntry {
  name: string
  isDirectory: boolean
  isXomda?: boolean
  isXomdaDir?: boolean
  isHidden?: boolean
  size: number
  mtime: string
  isGenerated?: boolean
}

interface FileStats extends FileEntry {
  path: string
  atime: string
  ctime: string
  birthtime: string
}

type PreviewMap = Map<string, string>

export const FileBrowserView = defineComponent({
  name: 'FileBrowserView',
  setup() {
    const currentPath = ref('.')
    const entries = ref<FileEntry[]>([])
    const { loading, execute: executeList } = useAsyncState<FileEntry[]>()
    const selectedFile = ref<FileStats | null>(null)
    const { loading: loadingStats, execute: executeStats } = useAsyncState<FileStats>()
    const showHidden = ref(true)
    const showGenerated = ref(true)
    const showInfo = ref(true)

    const previewMap = ref<PreviewMap>(new Map())
    const { execute: executePreview } = useAsyncState<PreviewMap>()

    const previewTitle = ref('')
    const previewContent = ref('')
    const previewLanguage = ref('plaintext')

    const pathSegments = computed(() => {
      if (currentPath.value === '.') return []
      return currentPath.value.split('/')
    })

    const loadPreview = () =>
      executePreview(async () => {
        const results = await trpc.handlebarsTemplate.preview.query()
        const map: PreviewMap = new Map()
        for (const r of results) map.set(r.outputPath, r.content)
        previewMap.value = map
        return map
      })

    const loadEntries = () =>
      executeList(async () => {
        const result = await trpc.file.list.query({
          path: currentPath.value,
          showHidden: showHidden.value,
        })
        entries.value = result
        return result
      })

    const navigateTo = (path: string) => {
      currentPath.value = path
      selectedFile.value = null
    }

    const navigateUp = () => {
      if (currentPath.value === '.') return
      const segments = currentPath.value.split('/')
      segments.pop()
      currentPath.value = segments.length === 0 ? '.' : segments.join('/')
      selectedFile.value = null
    }

    const virtualEntries = computed<FileEntry[]>(() => {
      if (!showGenerated.value) return []
      const prefix = currentPath.value === '.' ? '' : `${currentPath.value}/`
      const seen = new Set<string>()
      const result: FileEntry[] = []

      for (const outputPath of previewMap.value.keys()) {
        if (!outputPath.startsWith(prefix)) continue
        const relative = outputPath.slice(prefix.length)
        const firstSegment = relative.split('/')[0]
        if (!firstSegment || seen.has(firstSegment)) continue
        seen.add(firstSegment)

        const isDirectory = relative.includes('/')
        if (!entries.value.some((e) => e.name === firstSegment)) {
          result.push({
            name: firstSegment,
            isDirectory,
            size: 0,
            mtime: new Date().toISOString(),
            isGenerated: true,
          })
        }
      }
      return result
    })

    const mergedEntries = computed<FileEntry[]>(() => {
      if (!showGenerated.value) return entries.value

      const prefix = currentPath.value === '.' ? '' : `${currentPath.value}/`
      const generatedPaths = new Set<string>()
      for (const p of previewMap.value.keys()) {
        if (p.startsWith(prefix)) {
          const seg = p.slice(prefix.length).split('/')[0]
          if (seg) generatedPaths.add(seg)
        }
      }

      const real = entries.value.map((e) =>
        generatedPaths.has(e.name) ? { ...e, isGenerated: true } : e
      )
      return [...real, ...virtualEntries.value].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
    })

    const selectFile = async (entry: FileEntry) => {
      if (entry.isDirectory) {
        navigateTo(currentPath.value === '.' ? entry.name : `${currentPath.value}/${entry.name}`)
        return
      }

      const path = currentPath.value === '.' ? entry.name : `${currentPath.value}/${entry.name}`

      if (entry.isGenerated && !entries.value.some((e) => e.name === entry.name)) {
        previewTitle.value = path
        previewContent.value = previewMap.value.get(path) ?? ''
        previewLanguage.value = languageFromPath(path)
        selectedFile.value = null
        showInfo.value = false
        return
      }

      await executeStats(async () => {
        const [stats, { content }] = await Promise.all([
          trpc.file.getStats.query(path),
          trpc.file.read.query(path),
        ])
        selectedFile.value = stats
        previewTitle.value = path
        previewContent.value = content
        previewLanguage.value = languageFromPath(path)
        showInfo.value = true
        return stats
      })
    }

    const closeInfo = () => {
      showInfo.value = false
    }

    const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    }

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString()

    onMounted(() => {
      loadEntries()
      loadPreview()
    })
    watch([currentPath, showHidden], loadEntries)

    return () => (
      <div class="d-flex flex-column" style="height: calc(100dvh - var(--v-layout-top))">
        <TitleBar>
          {{
            title: () => (
              <div class="d-flex align-center ga-2 flex-grow-1">
                <span style={{ cursor: 'pointer' }} onClick={() => navigateTo('.')}>
                  Browse
                </span>
                {pathSegments.value.map((segment, index) => (
                  <>
                    <span class="text-disabled">/</span>
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigateTo(pathSegments.value.slice(0, index + 1).join('/'))}
                    >
                      {segment}
                    </span>
                  </>
                ))}
              </div>
            ),
          }}
        </TitleBar>

        {/* Toolbar */}
        <VToolbar density="comfortable" border="b">
          <VSwitch
            hide-details
            label="Show hidden"
            class="ml-4"
            color="primary"
            v-model={showHidden.value}
          />
          <VSwitch
            hide-details
            label="Show generated"
            class="ml-4"
            color="secondary"
            v-model={showGenerated.value}
          />
        </VToolbar>

        {(loading.value || loadingStats.value) && (
          <VProgressLinear indeterminate color="primary" style="flex-shrink:0" />
        )}

        {/* Three-column body */}
        <div class="d-flex flex-grow-1 overflow-hidden" style="min-height: 0">
          {/* Left: file list */}
          <div
            class="flex-shrink-0 d-flex flex-column"
            style="width:260px; border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); min-height: 0"
          >
            <VList class="overflow-y-auto flex-grow-1">
              {currentPath.value !== '.' && (
                <VListItem title=".." subtitle="Parent directory" onClick={navigateUp}>
                  {{ prepend: () => <VIcon icon={ParentFolderIcon} /> }}
                </VListItem>
              )}
              <VFadeTransition hideOnLeave group>
                {mergedEntries.value.map((entry) => (
                  <VListItem
                    key={entry.name}
                    title={entry.name}
                    subtitle={entry.isDirectory ? 'Directory' : formatSize(entry.size)}
                    onClick={() => selectFile(entry)}
                    active={selectedFile.value?.name === entry.name && !entry.isDirectory}
                    color={entry.isXomdaDir ? 'secondary' : entry.isXomda ? 'primary' : undefined}
                    class={[
                      entry.isXomdaDir
                        ? 'text-secondary'
                        : entry.isXomda
                          ? 'text-primary'
                          : undefined,
                      entry.isGenerated ? 'font-italic' : undefined,
                    ]}
                    style={{ opacity: entry.isHidden ? 0.75 : 1 }}
                  >
                    {{
                      prepend: () => (
                        <FileEntryIcon
                          class={['mr-2']}
                          isDirectory={entry.isDirectory}
                          icon={entry.isXomdaDir || entry.isXomda ? FolderXomdaIcon : null}
                          color={
                            entry.isGenerated
                              ? 'rgb(var(--v-theme-secondary))'
                              : entry.isXomdaDir
                                ? 'rgb(var(--v-theme-secondary))'
                                : entry.isXomda
                                  ? 'rgb(var(--v-theme-primary))'
                                  : undefined
                          }
                        />
                      ),
                      append: () =>
                        entry.isGenerated ? (
                          <VChip density="compact" size="x-small" color="secondary" label>
                            G
                          </VChip>
                        ) : null,
                    }}
                  </VListItem>
                ))}
              </VFadeTransition>
              {mergedEntries.value.length === 0 && !loading.value && (
                <div class="pa-4 text-center text-caption text-disabled">Empty directory</div>
              )}
            </VList>
          </div>

          {/* Center: inline preview */}
          <div class="flex-grow-1 overflow-hidden d-flex flex-column" style="min-width:0">
            {previewContent.value ? (
              <>
                <div
                  class="px-3 py-2 text-caption text-disabled d-flex align-center"
                  style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); flex-shrink:0"
                >
                  <span class="flex-grow-1" style="font-family:monospace">
                    {previewTitle.value}
                  </span>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                  <CodeEditor
                    modelValue={previewContent.value}
                    language={previewLanguage.value}
                    height="100%"
                    options={{ readOnly: true }}
                  />
                </div>
              </>
            ) : (
              <div class="d-flex align-center justify-center fill-height text-disabled text-body-2">
                Select a file to preview
              </div>
            )}
          </div>

          {/* Right: file info panel */}
          {selectedFile.value && showInfo.value && (
            <div
              class="overflow-y-auto flex-shrink-0"
              style="width:280px; border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity))"
            >
              <div class="pa-3 d-flex align-center ga-2">
                <VIcon icon={InfoIcon} size={20} />
                <span class="text-subtitle-2 flex-grow-1">File Information</span>
                <VBtn icon size="small" variant="text" onClick={closeInfo}>
                  <VIcon icon={CloseIcon} size={18} />
                </VBtn>
              </div>
              <VDivider />
              <div class="pa-4 d-flex flex-column ga-4">
                <div>
                  <div class="text-caption text-disabled">Name</div>
                  <div>{selectedFile.value.name}</div>
                </div>
                <div>
                  <div class="text-caption text-disabled">Path</div>
                  <div
                    style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8em' }}
                  >
                    {selectedFile.value.path}
                  </div>
                </div>
                {!selectedFile.value.isDirectory && (
                  <div>
                    <div class="text-caption text-disabled">Size</div>
                    <div>{formatSize(selectedFile.value.size)}</div>
                  </div>
                )}
                <div>
                  <div class="text-caption text-disabled">Modified</div>
                  <div>{formatDate(selectedFile.value.mtime)}</div>
                </div>
                <div>
                  <div class="text-caption text-disabled">Created</div>
                  <div>{formatDate(selectedFile.value.birthtime)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
})
