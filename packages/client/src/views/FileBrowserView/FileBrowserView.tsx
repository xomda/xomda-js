import { CodeEditor } from '@xomda/codeeditor'
import { CloseIcon, InfoIcon, ListViewIcon, TreeViewIcon } from '@xomda/icons'
import { languageFromPath, TitleBar, useAsyncState, useLocalStorageStore } from '@xomda/ui'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VBtn,
  VBtnToggle,
  VCard,
  VDivider,
  VIcon,
  VProgressLinear,
  VSwitch,
  VToolbar,
} from 'vuetify/components'

import { PanelDivider } from '../../components'
import { usePanelResize } from '../../composables'
import { trpc } from '../../trpc'
import { FolderListView } from './FolderListView'
import { FolderTreeView } from './FolderTreeView'
import type { FileEntry, FileStats, PreviewMap } from './types'
import { mergeWithVirtualEntries } from './useFolderEntries'
import { useFolderTree } from './useFolderTree'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString()

const dirPathSegments = (path: string) => (!path || path === '.' ? [] : path.split('/'))

const parentPath = (path: string): string => {
  if (!path || path === '.') return '.'
  const segs = path.split('/')
  segs.pop()
  return segs.length === 0 ? '.' : segs.join('/')
}

export const FileBrowserView = defineComponent({
  name: 'FileBrowserView',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const theme = useTheme()
    const store = useLocalStorageStore()

    const editorTheme = computed(() =>
      theme.global.current.value.dark ? 'xomda-dark' : 'xomda-light'
    )

    const currentPath = computed(() => {
      const segs = route.params.dirPath
      if (Array.isArray(segs) && segs.length > 0) return segs.join('/')
      if (typeof segs === 'string' && segs) return segs
      return '.'
    })

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
        const results = await trpc.template.preview.query()
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
      router.push({
        name: 'files',
        params: { dirPath: dirPathSegments(path) },
        query: route.query,
      })
    }

    const navigateUp = () => {
      if (currentPath.value === '.') return
      navigateTo(parentPath(currentPath.value))
    }

    const updateSelectedFileInUrl = (parent: string, fileName: string | null) => {
      router.replace({
        name: 'files',
        params: { dirPath: dirPathSegments(parent) },
        query: fileName ? { file: fileName } : {},
      })
    }

    const mergedEntries = computed<FileEntry[]>(() =>
      mergeWithVirtualEntries(entries.value, previewMap.value, currentPath.value, showGenerated.value)
    )

    const selectListEntry = (entry: FileEntry) => {
      if (entry.isDirectory) {
        navigateTo(currentPath.value === '.' ? entry.name : `${currentPath.value}/${entry.name}`)
        return
      }
      updateSelectedFileInUrl(currentPath.value, entry.name)
    }

    const loadFileByPath = async (fullPath: string, isGeneratedVirtual: boolean) => {
      if (isGeneratedVirtual) {
        previewTitle.value = fullPath
        previewContent.value = previewMap.value.get(fullPath) ?? ''
        previewLanguage.value = languageFromPath(fullPath)
        selectedFile.value = null
        showInfo.value = false
        return
      }

      await executeStats(async () => {
        const [stats, { content }] = await Promise.all([
          trpc.file.getStats.query(fullPath),
          trpc.file.read.query(fullPath),
        ])
        selectedFile.value = stats
        previewTitle.value = fullPath
        previewContent.value = content
        previewLanguage.value = languageFromPath(fullPath)
        showInfo.value = true
        return stats
      })
    }

    const clearPreview = () => {
      selectedFile.value = null
      previewTitle.value = ''
      previewContent.value = ''
      previewLanguage.value = 'plaintext'
      showInfo.value = false
    }

    // Tree state — initialize composable with shared refs
    const tree = useFolderTree({
      showHidden,
      showGenerated,
      previewMap,
      currentPath,
    })

    // Tree click handlers — both update dirPath
    const onTreeToggle = (path: string) => {
      tree.toggle(path)
      navigateTo(path)
    }

    // Tree file click: route push triggers loadEntries (parent) + the
    // [route.query.file, mergedEntries] watcher which loads the preview.
    const onTreeSelectFile = (path: string, entry: FileEntry) => {
      const parent = parentPath(path)
      router.push({
        name: 'files',
        params: { dirPath: dirPathSegments(parent) },
        query: { file: entry.name },
      })
    }

    // Preview path tracks the URL: dirPath + ?file= maps to a full path.
    const selectedFullPath = computed<string | null>(() => {
      const fileName = typeof route.query.file === 'string' ? route.query.file : ''
      if (!fileName) return null
      return currentPath.value === '.' ? fileName : `${currentPath.value}/${fileName}`
    })

    // Watch URL changes (from list selection or external nav) and load preview.
    watch(
      [() => route.query.file, mergedEntries],
      ([fileName]) => {
        const name = typeof fileName === 'string' ? fileName : ''
        if (!name) {
          clearPreview()
          return
        }
        const fullPath = currentPath.value === '.' ? name : `${currentPath.value}/${name}`
        if (selectedFile.value?.path === fullPath) return
        if (previewTitle.value === fullPath) return
        const entry = mergedEntries.value.find((e) => e.name === name && !e.isDirectory)
        const isVirtualOnly = !!entry?.isGenerated && !entries.value.some((e) => e.name === name)
        if (entry) void loadFileByPath(fullPath, isVirtualOnly)
      },
      { immediate: true }
    )

    const closeInfo = () => {
      showInfo.value = false
    }

    const { width: leftWidth, onResize: onResizeLeft } = usePanelResize(280, 200, 600)
    const { width: rightWidth, onResize: onResizeRight } = usePanelResize(280, 200, 480)

    onMounted(() => {
      loadEntries()
      loadPreview()
    })
    watch([currentPath, showHidden], loadEntries)

    return () => (
      <div class="d-flex flex-column fill-height">
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
        <VToolbar density="comfortable" color="transparent">
          <VBtnToggle
            v-model={store.fileViewMode}
            mandatory
            density="comfortable"
            variant="outlined"
            divided
            class="ml-4"
            aria-label="View mode"
          >
            <VBtn value="list" size="small" aria-label="List view">
              <VIcon icon={ListViewIcon} />
            </VBtn>
            <VBtn value="tree" size="small" aria-label="Tree view">
              <VIcon icon={TreeViewIcon} />
            </VBtn>
          </VBtnToggle>
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
        <div class="d-flex flex-grow-1 py-2" style="min-height: 0; gap: 0">
          {/* Left: file list or tree */}
          <VCard
            class="flex-shrink-0 d-flex flex-column overflow-hidden"
            style={{ width: `${leftWidth.value}px` }}
            elevation={2}
            rounded="lg"
          >
            {store.fileViewMode === 'tree' ? (
              <FolderTreeView
                nodes={tree.visibleNodes.value}
                selectedPath={selectedFullPath.value ?? currentPath.value}
                onToggle={onTreeToggle}
                onSelectFile={onTreeSelectFile}
              />
            ) : (
              <FolderListView
                entries={mergedEntries.value}
                selectedName={selectedFile.value?.name ?? null}
                isLoading={loading.value}
                showParent={currentPath.value !== '.'}
                onNavigateUp={navigateUp}
                onSelect={selectListEntry}
              />
            )}
          </VCard>

          <PanelDivider onResize={onResizeLeft} />

          {/* Center: inline preview */}
          {previewContent.value ? (
            <VCard
              class="flex-grow-1 overflow-hidden d-flex flex-column"
              style="min-width:0"
              elevation={2}
              rounded="lg"
            >
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
                  theme={editorTheme.value}
                  options={{ readOnly: true }}
                />
              </div>
            </VCard>
          ) : (
            <div
              class="flex-grow-1 d-flex align-center justify-center text-disabled text-body-2"
              style="min-width:0"
            >
              Select a file to preview
            </div>
          )}

          {/* Right: file info panel */}
          {selectedFile.value && showInfo.value && (
            <>
              <PanelDivider onResize={(delta) => onResizeRight(-delta)} />
              <VCard
                class="overflow-y-auto flex-shrink-0"
                style={{ width: `${rightWidth.value}px` }}
                elevation={2}
                rounded="lg"
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
                      style={{
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: '0.8em',
                      }}
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
              </VCard>
            </>
          )}
        </div>
      </div>
    )
  },
})
