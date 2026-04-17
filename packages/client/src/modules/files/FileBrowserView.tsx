import { getPreviewComponent, OpenWorkspaceLinkKey } from '@xomda/analysis-client'
import type { ViewsForEntry } from '@xomda/analysis-core'
import { CodeEditor } from '@xomda/codeeditor'
import {
  DraftIcon,
  InfoIcon,
  ListViewIcon,
  LockIcon,
  LoopIcon,
  TreeViewIcon,
  VisibilityIcon,
  VisibilityOffIcon,
} from '@xomda/icons'
import {
  HexView,
  type MenuItemConfig,
  SidePanel,
  useAsyncState,
  useDelayedLoading,
  useLocalStorageStore,
  useMutation,
  useNotificationsStore,
} from '@xomda/ui'
import { modeToOctal, modeToSymbolic, resolveWorkspaceRelative } from '@xomda/util'
import { computed, defineComponent, h, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VBtn,
  VCard,
  VEmptyState,
  VFadeTransition,
  VIcon,
  VProgressLinear,
  VTab,
  VTabs,
  VTooltip,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider, ProjectOverview, ViewCardHeader } from '../../components'
import { useFolderProjectIcons, usePanelResize, usePluginIcons } from '../../composables'
import { trpc } from '../../trpc'
import { FolderListView } from './FolderListView'
import { FolderTreeView } from './FolderTreeView'
import type { FileEntry, PreviewMap } from './types'
import { type SelectedView, useFilePreview } from './useFilePreview'
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
    const { loading, run: runList } = useAsyncState<FileEntry[]>()
    const showHidden = ref(true)
    const showGenerated = ref(true)
    // File-info permissions display — octal (default) or ls-style symbolic.
    // Local, intentionally not persisted: it's a one-click curiosity toggle.
    const permDisplay = ref<'octal' | 'symbolic'>('octal')

    const previewMap = ref<PreviewMap>(new Map())
    const { run: runPreview } = useAsyncState<PreviewMap>()

    const {
      selectedFile,
      previewTitle,
      preview,
      showInfo,
      loading: loadingStats,
      loadFileByPath,
      clearPreview,
      closeInfo,
      openInfo,
    } = useFilePreview({
      previewMap,
      getStats: (path) => trpc.file.getStats.query(path),
      readFile: (path) => trpc.file.read.query(path),
      readBytes: (path, maxBytes) => trpc.file.readBytes.query({ path, maxBytes }),
      fileTypesFor: (path) => trpc.project.fileTypesFor.query({ path }),
      viewData: (args) => trpc.project.viewData.query(args),
    })

    // ── Multi-view tabs ───────────────────────────────────────────────────
    // Per-file plugin-contributed views, with a sticky tab choice keyed by
    // fileTypeId so reopening a pom.xml lands on the same tab as last time
    // (JetBrains-style).
    const viewsForSelected = ref<ViewsForEntry[]>([])
    const flatViews = computed<SelectedView[]>(() =>
      viewsForSelected.value.flatMap((entry) =>
        entry.views.map<SelectedView>((v) => ({
          pluginId: entry.pluginId,
          fileTypeId: entry.fileTypeId,
          viewId: v.id,
          label: v.label,
          preview: v.preview,
          hasLoadViewData: v.hasLoadViewData,
        }))
      )
    )

    /**
     * Compose the sticky-tab map key from plugin + file-type so a Maven
     * pom and a hypothetical Node pom-like file don't collide.
     */
    const stickyKey = (pluginId: string, fileTypeId: string) => `${pluginId}:${fileTypeId}`

    // The active view tab is driven by `?view=<viewId>` in the URL —
    // the URL is the source of truth so a tab choice is shareable,
    // bookmarkable, and survives reload. Sticky local storage is only
    // consulted as a fallback when the URL has no view (e.g. the user
    // arrived from a list click rather than a deep link).
    const urlViewId = computed<string | null>(() => {
      const v = route.query.view
      return typeof v === 'string' && v !== '' ? v : null
    })

    const resolveActiveIdx = (list: SelectedView[], url: string | null): number => {
      if (list.length === 0) return 0
      if (url) {
        const i = list.findIndex((v) => v.viewId === url)
        if (i >= 0) return i
      }
      const primary = list[0]
      const sticky = store.fileTypeView[stickyKey(primary.pluginId, primary.fileTypeId)]
      if (sticky) {
        const i = list.findIndex(
          (v) =>
            v.pluginId === primary.pluginId &&
            v.fileTypeId === primary.fileTypeId &&
            v.viewId === sticky
        )
        if (i >= 0) return i
      }
      return 0
    }

    const activeViewIdx = computed<number>(() => resolveActiveIdx(flatViews.value, urlViewId.value))
    const activeView = computed<SelectedView | undefined>(
      () => flatViews.value[activeViewIdx.value]
    )

    const writeViewToUrl = (viewId: string | null) => {
      const current = route.query
      // Skip when the URL already matches — avoids router churn.
      if ((current.view ?? null) === (viewId ?? null)) return
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(current)) {
        if (k === 'view') continue
        if (typeof v === 'string') next[k] = v
      }
      if (viewId) next.view = viewId
      router.replace({ name: 'files', params: route.params, query: next })
    }

    // When views resolve for a newly-selected file, normalise the URL
    // to the view the user actually sees. This makes the URL match the
    // visible tab even if the user clicked a file without a `?view=`
    // hint, and ensures a stale `?view=...` from a previous file gets
    // corrected when the next file doesn't expose that view.
    watch(
      [flatViews, urlViewId],
      ([list, url]) => {
        if (list.length === 0) {
          if (url) writeViewToUrl(null)
          return
        }
        const resolved = list[resolveActiveIdx(list, url)]
        if (!resolved) return
        if (url !== resolved.viewId) writeViewToUrl(resolved.viewId)
      },
      { flush: 'post' }
    )

    const onTabSelect = (idx: number) => {
      const view = flatViews.value[idx]
      if (!view) return
      writeViewToUrl(view.viewId)
      store.fileTypeView = {
        ...store.fileTypeView,
        [stickyKey(view.pluginId, view.fileTypeId)]: view.viewId,
      }
    }

    // ── Project overview pane for project folders ─────────────────────────
    const projectKindsForCurrent = ref<Array<{ pluginId: string }>>([])
    const reloadProjectKinds = async () => {
      try {
        const r = await trpc.project.kindsFor.query({ path: currentPath.value })
        projectKindsForCurrent.value = r.kinds
      } catch {
        projectKindsForCurrent.value = []
      }
    }
    const isCurrentDirAProject = computed(() => projectKindsForCurrent.value.length > 0)

    const previewBytes = computed<Uint8Array | null>(() => {
      const b = preview.value
      if ((b.kind === 'binary' || b.kind === 'image') && b.base64) {
        const bin = atob(b.base64)
        const out = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
        return out
      }
      return null
    })

    function inferImageMime(path: string): string {
      const ext = path.toLowerCase().split('.').pop() ?? ''
      switch (ext) {
        case 'png':
          return 'image/png'
        case 'gif':
          return 'image/gif'
        case 'webp':
          return 'image/webp'
        case 'svg':
          return 'image/svg+xml'
        case 'bmp':
          return 'image/bmp'
        default:
          return 'image/jpeg'
      }
    }

    const imageDataUrl = computed(() => {
      const b = preview.value
      if (b.kind === 'image' && b.base64) {
        return `data:${inferImageMime(previewTitle.value)};base64,${b.base64}`
      }
      return ''
    })
    const showProgress = useDelayedLoading(computed(() => loading.value || loadingStats.value))

    const pathSegments = computed(() => {
      if (currentPath.value === '.') return []
      return currentPath.value.split('/')
    })

    const loadPreview = () =>
      runPreview(async () => {
        const results = await trpc.template.preview.query()
        const map: PreviewMap = new Map()
        for (const r of results) map.set(r.outputPath, r.content)
        previewMap.value = map
        return map
      })

    const loadEntries = () =>
      runList(async () => {
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
      mergeWithVirtualEntries(
        entries.value,
        previewMap.value,
        currentPath.value,
        showGenerated.value,
        store.fileSort
      )
    )

    // Tree state must exist before computing visible file/folder paths
    // so the tree's currently-expanded nodes feed into the icon queries.
    const fileSortRef = computed({
      get: () => store.fileSort,
      set: (v) => (store.fileSort = v),
    })
    const tree = useFolderTree({
      showHidden,
      showGenerated,
      previewMap,
      currentPath,
      sort: fileSortRef,
    })

    // Resolve plugin icons for every visible file (not directories).
    // Includes paths from BOTH the flat-view's current folder and the
    // tree-view's currently expanded subtree so icons stay populated
    // when toggling between view modes.
    const visibleFilePaths = computed(() => {
      const flat = mergedEntries.value
        .filter((e) => !e.isDirectory)
        .map((e) => (currentPath.value === '.' ? e.name : `${currentPath.value}/${e.name}`))
      const treePaths = tree.visibleNodes.value
        .filter((n) => !n.entry.isDirectory)
        .map((n) => n.path)
      return [...new Set([...flat, ...treePaths])]
    })
    const pluginIcons = usePluginIcons(visibleFilePaths)
    const pluginIconsForName = (name: string) => {
      const fullPath = currentPath.value === '.' ? name : `${currentPath.value}/${name}`
      return pluginIcons.getIcons(fullPath)
    }

    // Resolve project-kind icons for every visible folder. Drives the
    // JetBrains-style overlay on folder rows (Maven module, Node
    // package, …) and is shared between flat and tree views so they
    // never disagree.
    const visibleFolderPaths = computed(() => {
      const flat = mergedEntries.value
        .filter((e) => e.isDirectory)
        .map((e) => (currentPath.value === '.' ? e.name : `${currentPath.value}/${e.name}`))
      const treePaths = tree.visibleNodes.value
        .filter((n) => n.entry.isDirectory)
        .map((n) => n.path)
      return [...new Set([...flat, ...treePaths])]
    })
    const folderProjectIcons = useFolderProjectIcons(visibleFolderPaths)
    const folderProjectIconsForName = (name: string) => {
      const fullPath = currentPath.value === '.' ? name : `${currentPath.value}/${name}`
      return folderProjectIcons.getIcons(fullPath)
    }

    const selectListEntry = (entry: FileEntry) => {
      if (entry.isDirectory) {
        navigateTo(currentPath.value === '.' ? entry.name : `${currentPath.value}/${entry.name}`)
        return
      }
      updateSelectedFileInUrl(currentPath.value, entry.name)
    }

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
    // Two-step: (1) resolve the file's views via project.viewsFor and pick
    // the sticky/initial active view, (2) load the file *for that view*.
    // Re-loads on tab switch via activeViewIdx → loadCurrentSelection().
    const loadViewsForSelected = async (fullPath: string) => {
      try {
        const r = await trpc.project.viewsFor.query({ path: fullPath })
        viewsForSelected.value = r.views
      } catch {
        viewsForSelected.value = []
      }
    }

    watch(
      [() => route.query.file, mergedEntries],
      async ([fileName]) => {
        const name = typeof fileName === 'string' ? fileName : ''
        if (!name) {
          viewsForSelected.value = []
          clearPreview()
          return
        }
        const fullPath = currentPath.value === '.' ? name : `${currentPath.value}/${name}`
        if (selectedFile.value?.path === fullPath) return
        if (previewTitle.value === fullPath) return
        const entry = mergedEntries.value.find((e) => e.name === name && !e.isDirectory)
        const isVirtualOnly = !!entry?.isGenerated && !entries.value.some((e) => e.name === name)
        if (!entry) return
        // Virtual generated entries don't have plugin views.
        if (isVirtualOnly) {
          viewsForSelected.value = []
          await loadFileByPath(fullPath, true)
          return
        }
        await loadViewsForSelected(fullPath)
        await loadFileByPath(fullPath, false, activeView.value)
      },
      { immediate: true }
    )

    // Re-load preview when the user switches tabs (activeViewIdx changes
    // but the file path is the same).
    watch(activeViewIdx, async () => {
      const view = activeView.value
      if (!view) return
      if (!selectedFile.value) return
      await loadFileByPath(selectedFile.value.path, false, view)
    })

    // Re-evaluate "is this a project folder" on every navigation.
    watch(currentPath, () => void reloadProjectKinds(), { immediate: true })

    const { width: leftWidth, onResize: onResizeLeft } = usePanelResize(280, 200, 600)
    const { width: rightWidth, onResize: onResizeRight } = usePanelResize(280, 200, 480)

    // Wire workspace-internal link navigation for plugin preview
    // components (e.g. relative `[link](./other.md)` in `MarkdownPreview`).
    // The host owns workspace-boundary policy so plugins don't need to
    // know what "the workspace" is — they just hand us a relative path
    // and the file they're rendered from.
    const notifications = useNotificationsStore()
    provide(OpenWorkspaceLinkKey, (relativePath: string, fromPath: string): boolean => {
      const resolved = resolveWorkspaceRelative(fromPath, relativePath)
      if (resolved === null) {
        notifications.error(
          'This file is outside of the project and cannot be accessed from within it.'
        )
        return false
      }
      const slash = resolved.lastIndexOf('/')
      const dir = slash >= 0 ? resolved.slice(0, slash) : '.'
      const name = slash >= 0 ? resolved.slice(slash + 1) : resolved
      router.push({
        name: 'files',
        params: { dirPath: dirPathSegments(dir) },
        query: { file: name },
      })
      return true
    })

    onMounted(() => {
      loadEntries()
      loadPreview()
    })
    watch([currentPath, showHidden], loadEntries)

    // Manual re-scan. project.rescan drops the server-side analyzer
    // caches (overview + view-data) before re-running the analysis; then
    // we re-fetch the current directory listing and invalidate the
    // client's plugin-icon cache so newly-detected file types show up
    // immediately.
    const rescanMutation = useMutation(() => trpc.project.rescan.mutate({}), {
      successMessage: 'Project re-scanned',
      onSuccess: async () => {
        pluginIcons.clearAndReload()
        await Promise.all([loadEntries(), reloadProjectKinds(), loadPreview()])
      },
    })

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
            checked: store.fileViewMode === 'tree',
            onClick: () => (store.fileViewMode = 'tree'),
          },
          {
            key: 'list',
            title: 'List',
            icon: ListViewIcon,
            checked: store.fileViewMode === 'list',
            onClick: () => (store.fileViewMode = 'list'),
          },
        ],
      },
      { divider: true, key: 'd1' },
      {
        key: 'hidden',
        title: 'Show hidden',
        icon: showHidden.value ? VisibilityIcon : VisibilityOffIcon,
        checked: showHidden.value,
        onClick: () => (showHidden.value = !showHidden.value),
      },
      {
        key: 'generated',
        title: 'Show generated',
        icon: DraftIcon,
        checked: showGenerated.value,
        onClick: () => (showGenerated.value = !showGenerated.value),
      },
    ])

    const fileSortItems = computed<MenuItemConfig[]>(() => {
      const sort = store.fileSort
      const setBy = (by: typeof sort.by) => () => (store.fileSort = { ...store.fileSort, by })
      const setDir = (dir: typeof sort.dir) => () => (store.fileSort = { ...store.fileSort, dir })
      return [
        { key: 'by-name', title: 'Name', checked: sort.by === 'name', onClick: setBy('name') },
        { key: 'by-type', title: 'Type', checked: sort.by === 'type', onClick: setBy('type') },
        {
          key: 'by-modified',
          title: 'Modified',
          checked: sort.by === 'modified',
          onClick: setBy('modified'),
        },
        { key: 'by-size', title: 'Size', checked: sort.by === 'size', onClick: setBy('size') },
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

    return () => (
      <div class="d-flex flex-column fill-height">
        <AppTitleBar>
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
            actions: () => (
              <VTooltip text="Re-scan project" location="bottom">
                {{
                  activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                    <VBtn
                      {...tipProps}
                      icon
                      variant="text"
                      size="small"
                      loading={rescanMutation.loading.value}
                      onClick={() => void rescanMutation.run()}
                      aria-label="Re-scan project"
                    >
                      <VIcon icon={LoopIcon} />
                    </VBtn>
                  ),
                }}
              </VTooltip>
            ),
          }}
        </AppTitleBar>

        {showProgress.value ? (
          <VProgressLinear
            indeterminate
            color="primary"
            style={{
              flexShrink: 0,
              visibility: showProgress.value ? 'visible' : 'hidden',
            }}
          />
        ) : undefined}

        {/* Three-column body */}
        <div class="d-flex flex-grow-1 py-2 pr-2" style="min-height: 0; gap: 0">
          {/* Left: file list or tree */}
          <VCard
            class="flex-shrink-0 d-flex flex-column overflow-hidden"
            style={{ width: `${leftWidth.value}px` }}
            elevation={2}
            rounded="lg"
          >
            <ViewCardHeader viewOptions={viewOptions.value} sortItems={fileSortItems.value} />
            {store.fileViewMode === 'tree' ? (
              <FolderTreeView
                nodes={tree.visibleNodes.value}
                selectedPath={selectedFullPath.value ?? currentPath.value}
                pluginIconsForPath={pluginIcons.getIcons}
                folderProjectIconsForPath={folderProjectIcons.getIcons}
                onToggle={onTreeToggle}
                onSelectFile={onTreeSelectFile}
              />
            ) : (
              <FolderListView
                entries={mergedEntries.value}
                selectedName={selectedFile.value?.name ?? null}
                isLoading={loading.value}
                showParent={currentPath.value !== '.'}
                pluginIconsFor={pluginIconsForName}
                folderProjectIconsFor={folderProjectIconsForName}
                onNavigateUp={navigateUp}
                onSelect={selectListEntry}
              />
            )}
          </VCard>

          <PanelDivider onResize={onResizeLeft} />

          {/* Center: inline preview */}
          {preview.value.kind !== 'none' ? (
            <VCard
              class="flex-grow-1 overflow-hidden d-flex flex-column"
              style="min-width:0"
              elevation={2}
              rounded="lg"
            >
              <div
                class="px-3 text-caption text-disabled d-flex align-center"
                style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); flex-shrink:0; min-height:36px"
              >
                <span class="flex-grow-1" style="font-family:monospace">
                  {previewTitle.value}
                </span>
                <VFadeTransition>
                  {selectedFile.value && !showInfo.value ? (
                    <VTooltip text="Show file information" location="bottom">
                      {{
                        activator: ({ props: tipProps }: { props: Record<string, unknown> }) => (
                          <VBtn
                            {...tipProps}
                            icon={InfoIcon}
                            variant="text"
                            size="small"
                            density="comfortable"
                            aria-label="Show file information"
                            onClick={openInfo}
                          />
                        ),
                      }}
                    </VTooltip>
                  ) : undefined}
                </VFadeTransition>
              </div>
              {flatViews.value.length >= 2 ? (
                <VTabs
                  modelValue={activeViewIdx.value}
                  onUpdate:modelValue={(v: unknown) => onTabSelect(Number(v))}
                  density="compact"
                  showArrows
                  style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); flex-shrink:0"
                >
                  {flatViews.value.map((v, i) => (
                    <VTab key={`${v.pluginId}:${v.fileTypeId}:${v.viewId}`} value={i}>
                      {v.label}
                    </VTab>
                  ))}
                </VTabs>
              ) : null}
              <div class="flex-grow-1 overflow-hidden">
                {preview.value.kind === 'binary' && previewBytes.value ? (
                  <HexView bytes={previewBytes.value} />
                ) : preview.value.kind === 'image' ? (
                  <div class="d-flex align-center justify-center fill-height pa-4">
                    <img
                      src={imageDataUrl.value}
                      alt={previewTitle.value}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : preview.value.kind === 'custom' && preview.value.componentId ? (
                  (() => {
                    const Component = getPreviewComponent(preview.value.componentId)
                    return Component ? (
                      h(Component, {
                        path: previewTitle.value,
                        text: preview.value.text,
                        data: preview.value.data,
                      })
                    ) : (
                      <CodeEditor
                        modelValue={preview.value.text ?? ''}
                        language={preview.value.language ?? 'plaintext'}
                        height="100%"
                        theme={editorTheme.value}
                        options={{ readOnly: true }}
                      />
                    )
                  })()
                ) : (
                  <CodeEditor
                    modelValue={preview.value.text ?? ''}
                    language={preview.value.language ?? 'plaintext'}
                    height="100%"
                    theme={editorTheme.value}
                    options={{ readOnly: true }}
                  />
                )}
              </div>
            </VCard>
          ) : isCurrentDirAProject.value ? (
            <VCard
              class="flex-grow-1 overflow-auto"
              style="min-width:0; padding: 1rem"
              elevation={2}
              rounded="lg"
            >
              <ProjectOverview path={currentPath.value} />
            </VCard>
          ) : (
            <div class="flex-grow-1 d-flex align-center justify-center" style="min-width:0">
              <VEmptyState
                icon={DraftIcon}
                title="No file selected"
                text="Select a file to preview."
              />
            </div>
          )}

          {/* Right: file info panel */}
          {selectedFile.value && showInfo.value && (
            <>
              <PanelDivider onResize={(delta) => onResizeRight(-delta)} />
              <SidePanel
                title="File Information"
                icon={InfoIcon}
                width={rightWidth.value}
                onClose={closeInfo}
              >
                <div class="d-flex flex-column ga-4">
                  <div>
                    <div class="text-caption text-disabled">Name</div>
                    <div class="d-flex align-center ga-2">
                      <span>{selectedFile.value.name}</span>
                      {selectedFile.value.isReadOnly ? (
                        <VTooltip text="Read-only" location="top">
                          {{
                            activator: ({
                              props: tipProps,
                            }: {
                              props: Record<string, unknown>
                            }) => (
                              <VIcon
                                {...tipProps}
                                icon={LockIcon}
                                size={14}
                                aria-label="Read-only"
                              />
                            ),
                          }}
                        </VTooltip>
                      ) : null}
                      {selectedFile.value.isHidden ? (
                        <VTooltip text="Hidden" location="top">
                          {{
                            activator: ({
                              props: tipProps,
                            }: {
                              props: Record<string, unknown>
                            }) => (
                              <VIcon
                                {...tipProps}
                                icon={VisibilityOffIcon}
                                size={14}
                                aria-label="Hidden"
                              />
                            ),
                          }}
                        </VTooltip>
                      ) : null}
                    </div>
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
                  <div>
                    <div class="text-caption text-disabled">Permissions</div>
                    <button
                      type="button"
                      onClick={() =>
                        (permDisplay.value = permDisplay.value === 'octal' ? 'symbolic' : 'octal')
                      }
                      aria-label="Toggle permission display"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontFamily: 'monospace',
                        fontSize: '0.8em',
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {permDisplay.value === 'octal'
                        ? modeToOctal(selectedFile.value.mode)
                        : modeToSymbolic(selectedFile.value.mode, selectedFile.value.isDirectory)}
                    </button>
                  </div>
                </div>
              </SidePanel>
            </>
          )}
        </div>
      </div>
    )
  },
})
