import { getPreviewComponent } from '@xomda/analysis-client'
import { CodeEditor } from '@xomda/codeeditor'
import type { Template } from '@xomda/core'
import {
  CheckIcon,
  ChevronDownIcon,
  FilePresentIcon,
  GenerateIcon,
  ListViewIcon,
  PreviewIcon,
  TreeViewIcon,
} from '@xomda/icons'
import {
  FileEntryIcon,
  languageFromPath,
  MenuButton,
  type MenuItemConfig,
  useAsyncState,
  useDelayedLoading,
  useLocalStorageStore,
} from '@xomda/ui'
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useTheme } from 'vuetify'
import {
  VAlert,
  VBtn,
  VBtnGroup,
  VCard,
  VEmptyState,
  VIcon,
  VList,
  VListItem,
  VProgressCircular,
} from 'vuetify/components'

import { AppTitleBar, PanelDivider, ViewCardHeader } from '../../components'
import { usePanelResize, usePluginIcons } from '../../composables'
import { trpc } from '../../trpc'
import { FolderTreeNode } from '../files/FolderTreeNode'
import type { FileEntry, TreeNode } from '../files/types'

interface GeneratedResult {
  outputPath: string
  templateId: string
  content: string
}

type GenerateAction = 'write' | 'dry-run'

/**
 * Resolved preview hint for the selected generated file. `kind` mirrors
 * the server's `PreviewHint` discriminated union narrowed to what makes
 * sense for in-memory template output (no on-disk image/binary bytes).
 */
interface GeneratedPreview {
  kind: 'text' | 'markdown' | 'custom'
  language: string
  componentId?: string
}

/**
 * Intermediate tree built from generated `outputPath`s. Directories are
 * synthesised from path segments — there's no real filesystem here, just
 * the in-memory paths the renderer reports.
 */
interface PathTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: PathTreeNode[]
  result?: GeneratedResult
}

function buildPathTree(results: GeneratedResult[]): PathTreeNode[] {
  const root: PathTreeNode = { name: '', path: '', isDirectory: true, children: [] }
  for (const r of results) {
    const parts = r.outputPath.split('/').filter(Boolean)
    if (parts.length === 0) continue
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const segPath = parts.slice(0, i + 1).join('/')
      let next = cur.children.find((c) => c.name === parts[i])
      if (!next) {
        next = {
          name: parts[i],
          path: segPath,
          isDirectory: !isLast,
          children: [],
        }
        if (isLast) next.result = r
        cur.children.push(next)
      }
      cur = next
    }
  }
  const sort = (node: PathTreeNode): void => {
    node.children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sort)
  }
  sort(root)
  return root.children
}

function flattenTree(
  nodes: PathTreeNode[],
  expanded: Set<string>,
  depth = 0,
  out: TreeNode[] = []
): TreeNode[] {
  for (const n of nodes) {
    const isExpanded = n.isDirectory && expanded.has(n.path)
    const entry: FileEntry = {
      name: n.name,
      isDirectory: n.isDirectory,
      size: n.result ? n.result.content.length : 0,
      mtime: new Date(0).toISOString(),
      isGenerated: true,
    }
    out.push({ entry, path: n.path, depth, isExpanded, isLoading: false })
    if (isExpanded) flattenTree(n.children, expanded, depth + 1, out)
  }
  return out
}

function collectDirectoryPaths(nodes: PathTreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.isDirectory) {
      out.push(n.path)
      collectDirectoryPaths(n.children, out)
    }
  }
  return out
}

export const GenerateView = defineComponent({
  name: 'GenerateView',
  setup() {
    const theme = useTheme()
    const store = useLocalStorageStore()
    const editorTheme = computed(() =>
      theme.global.current.value.dark ? 'xomda-dark' : 'xomda-light'
    )

    const results = ref<GeneratedResult[]>([])
    /** True when the current results came from a dry-run (not written to disk). */
    const isDryRun = ref(false)
    // Map of templateId → Template, populated once on mount so each generated
    // row can show a human-readable name + folder path and a router link to
    // the source template instead of an opaque UUID.
    const templatesById = ref<Map<string, Template>>(new Map())
    onMounted(async () => {
      try {
        const list = await trpc.template.list.query()
        templatesById.value = new Map(list.map((t) => [t.uuid, t]))
      } catch {
        // List is purely cosmetic here — fall back to showing the UUID.
      }
    })
    const templateLabel = (id: string): string => {
      const t = templatesById.value.get(id)
      if (!t) return id
      return t.folder ? `${t.folder}/${t.name}` : t.name
    }
    const templateRoute = (id: string) => {
      const t = templatesById.value.get(id)
      if (!t) return null
      const folderPath = t.folder ? t.folder.split('/').filter(Boolean) : []
      return { name: 'templates', params: { folderPath }, query: { template: t.uuid } }
    }
    const { loading: genLoading, error: genError, run: genRun } = useAsyncState<GeneratedResult[]>()
    const showGenLoading = useDelayedLoading(genLoading)

    // Resolve plugin-contributed icons for every generated path so the
    // file list/tree shows the same brand glyphs (TypeScript, Maven, …)
    // that the FileBrowserView renders.
    const allPaths = computed(() => results.value.map((r) => r.outputPath))
    const pluginIcons = usePluginIcons(allPaths)

    const selectedPath = ref<string | null>(null)
    const selectedResult = computed<GeneratedResult | null>(
      () => results.value.find((r) => r.outputPath === selectedPath.value) ?? null
    )

    const preview = ref<GeneratedPreview | null>(null)
    const { loading: previewLoading, run: runPreviewHint } = useAsyncState<GeneratedPreview>()

    const { width: rightWidth, onResize: onResizeRight } = usePanelResize(480, 280, 900)

    // Tree state for the left panel's tree view. Auto-expand every
    // directory whenever results change so a fresh generation is visible
    // top-to-bottom without manual clicks; user collapses are sticky
    // until the next generation.
    const expandedDirs = ref<Set<string>>(new Set())
    const pathTree = computed(() => buildPathTree(results.value))
    const treeNodes = computed(() => flattenTree(pathTree.value, expandedDirs.value))
    const onTreeToggle = (path: string) => {
      const next = new Set(expandedDirs.value)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      expandedDirs.value = next
    }
    const onTreeSelectFile = (path: string, _entry: FileEntry) => {
      const r = results.value.find((res) => res.outputPath === path)
      if (r) selectedPath.value = r.outputPath
      void _entry
    }

    const run = (action: GenerateAction) =>
      genRun(async () => {
        store.generateAction = action
        const res =
          action === 'dry-run'
            ? await trpc.template.preview.query()
            : await trpc.template.generate.mutate()
        results.value = res
        isDryRun.value = action === 'dry-run'
        // Reset selection so a previous file from an older run can't
        // linger with stale content.
        selectedPath.value = null
        preview.value = null
        // Fresh run → fully expanded tree.
        expandedDirs.value = new Set(collectDirectoryPaths(buildPathTree(res)))
        return res
      })

    const runDefault = () => run(store.generateAction)

    const actionLabel = computed(() =>
      store.generateAction === 'dry-run' ? 'Dry Run' : 'Generate All'
    )
    const actionIcon = computed(() =>
      store.generateAction === 'dry-run' ? PreviewIcon : GenerateIcon
    )

    const actionMenu = computed<MenuItemConfig[]>(() => [
      {
        key: 'write',
        title: 'Generate All',
        subtitle: 'Render templates and write output files to disk.',
        icon: GenerateIcon,
        checked: store.generateAction === 'write',
        onClick: () => void run('write'),
      },
      {
        key: 'dry-run',
        title: 'Dry Run',
        subtitle: 'Render templates in-memory only — nothing is written.',
        icon: PreviewIcon,
        checked: store.generateAction === 'dry-run',
        onClick: () => void run('dry-run'),
      },
    ])

    /**
     * Resolve the preview shape for `path` via the project analysis
     * router. Generated files aren't on disk yet (or may differ from
     * disk), so we deliberately skip `viewsFor`/`viewData` — those load
     * from the filesystem — and only consume the cheap `fileTypesFor`
     * hint that's derived from the path/pattern alone.
     */
    const resolvePreview = (path: string) =>
      runPreviewHint(async () => {
        let hintKind: 'text' | 'markdown' | 'image' | 'binary' | 'custom' = 'text'
        let hintLanguage: string | undefined
        let componentId: string | undefined
        try {
          const hint = await trpc.project.fileTypesFor.query({ path })
          if (hint.preview) {
            hintKind = hint.preview.kind
            if (hint.preview.kind === 'text') hintLanguage = hint.preview.language
            if (hint.preview.kind === 'custom') componentId = hint.preview.componentId
          }
        } catch {
          // Network/registry hiccup → fall back to extension-based text preview.
        }
        // image/binary preview hints don't apply to template-rendered
        // text output; degrade them to a syntax-highlighted text view.
        const kind: GeneratedPreview['kind'] =
          hintKind === 'markdown' || hintKind === 'custom' ? hintKind : 'text'
        const language = kind === 'markdown' ? 'markdown' : (hintLanguage ?? languageFromPath(path))
        const next: GeneratedPreview = { kind, language }
        if (componentId !== undefined) next.componentId = componentId
        preview.value = next
        return next
      })

    watch(selectedPath, (path) => {
      if (!path) {
        preview.value = null
        return
      }
      void resolvePreview(path)
    })

    const selectResult = (r: GeneratedResult) => {
      selectedPath.value = r.outputPath
    }

    const showPreviewLoading = useDelayedLoading(previewLoading)

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
            checked: store.generateViewMode === 'tree',
            onClick: () => (store.generateViewMode = 'tree'),
          },
          {
            key: 'list',
            title: 'List',
            icon: ListViewIcon,
            checked: store.generateViewMode === 'list',
            onClick: () => (store.generateViewMode = 'list'),
          },
        ],
      },
    ])

    // ViewCardHeader requires a sort menu; generated results have no
    // user-meaningful sort axis (paths are already structural), so we
    // pass an empty list — the "Sort by" submenu will just be empty.
    const sortItems = computed<MenuItemConfig[]>(() => [])

    return () => (
      <div class="fill-height d-flex flex-column">
        <AppTitleBar>
          {{
            title: () => 'Template Generation',
            actions: () => (
              <VBtnGroup variant="tonal" color="primary" density="compact">
                <VBtn
                  prepend-icon={actionIcon.value}
                  onClick={runDefault}
                  loading={genLoading.value}
                >
                  {actionLabel.value}
                </VBtn>
                <MenuButton
                  icon={ChevronDownIcon}
                  variant="tonal"
                  color="primary"
                  density="compact"
                  size="default"
                  tooltip="Choose generate action"
                  ariaLabel="Choose generate action"
                  location="bottom end"
                  items={actionMenu.value}
                  minWidth={260}
                />
              </VBtnGroup>
            ),
          }}
        </AppTitleBar>

        <div class="flex-grow-1 pa-2 pl-0 d-flex flex-column" style="min-height: 0">
          {(genError.value || (isDryRun.value && results.value.length > 0)) && (
            <div class="d-flex flex-column ga-2 mb-2 flex-shrink-0">
              {genError.value && (
                <VAlert
                  type="error"
                  closable
                  onUpdate:modelValue={(v) => !v && (genError.value = null)}
                >
                  {genError.value}
                </VAlert>
              )}
              {isDryRun.value && results.value.length > 0 && (
                <VAlert type="info" variant="tonal" icon={PreviewIcon}>
                  Dry run — preview only. No files were written to disk.
                </VAlert>
              )}
            </div>
          )}

          {results.value.length > 0 ? (
            <div class="d-flex flex-grow-1" style="min-height: 0; gap: 0">
              {/* Left: generated files list / tree */}
              <VCard
                class="flex-grow-1 d-flex flex-column overflow-hidden"
                style="min-width: 0"
                elevation={2}
                rounded="lg"
              >
                <ViewCardHeader viewOptions={viewOptions.value} sortItems={sortItems.value}>
                  {{
                    leading: () => (
                      <span class="text-caption text-disabled">
                        Generated Files ({results.value.length})
                      </span>
                    ),
                  }}
                </ViewCardHeader>
                {store.generateViewMode === 'tree' ? (
                  <VList
                    bgColor={'transparent'}
                    class="overflow-y-auto flex-grow-1"
                    density="compact"
                  >
                    {treeNodes.value.map((node) => (
                      <FolderTreeNode
                        key={node.path}
                        entry={node.entry}
                        path={node.path}
                        depth={node.depth}
                        isExpanded={node.isExpanded}
                        isLoading={node.isLoading}
                        isSelected={selectedPath.value === node.path}
                        icons={node.entry.isDirectory ? undefined : pluginIcons.getIcons(node.path)}
                        onToggle={onTreeToggle}
                        onSelectFile={onTreeSelectFile}
                      />
                    ))}
                  </VList>
                ) : (
                  <VList
                    bgColor={'transparent'}
                    class="overflow-y-auto flex-grow-1"
                    density="compact"
                  >
                    {results.value.map((res) => {
                      const to = templateRoute(res.templateId)
                      const label = templateLabel(res.templateId)
                      const icons = pluginIcons.getIcons(res.outputPath)
                      const primary = icons && icons.length > 0 ? icons[0] : undefined
                      return (
                        <VListItem
                          key={res.outputPath}
                          title={res.outputPath}
                          active={selectedPath.value === res.outputPath}
                          onClick={() => selectResult(res)}
                        >
                          {{
                            prepend: () => (
                              <FileEntryIcon
                                primaryIcon={primary?.icon ?? null}
                                primaryColor={primary?.color ?? null}
                              />
                            ),
                            subtitle: () => (
                              <span class="text-caption">
                                Template:{' '}
                                {to ? (
                                  <RouterLink
                                    to={to}
                                    class="text-decoration-none"
                                    // Don't let the link click also trigger row selection.
                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                  >
                                    {label}
                                  </RouterLink>
                                ) : (
                                  <span>{label}</span>
                                )}
                              </span>
                            ),
                            append: () =>
                              isDryRun.value ? null : <VIcon icon={CheckIcon} color="success" />,
                          }}
                        </VListItem>
                      )
                    })}
                  </VList>
                )}
              </VCard>

              <PanelDivider onResize={(delta) => onResizeRight(-delta)} />

              {/* Right: project-analysis-driven preview */}
              <VCard
                class="flex-shrink-0 d-flex flex-column overflow-hidden"
                style={{ width: `${rightWidth.value}px` }}
                elevation={2}
                rounded="lg"
              >
                {selectedResult.value ? (
                  <>
                    <div
                      class="px-3 py-2 text-caption text-disabled d-flex align-center"
                      style="border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); flex-shrink:0"
                    >
                      <span class="flex-grow-1 text-truncate" style="font-family:monospace">
                        {selectedResult.value.outputPath}
                      </span>
                    </div>
                    <div class="flex-grow-1 overflow-hidden">
                      {showPreviewLoading.value && !preview.value ? (
                        <div class="d-flex align-center justify-center fill-height">
                          <VProgressCircular indeterminate color="primary" size="32" />
                        </div>
                      ) : preview.value?.kind === 'custom' && preview.value.componentId ? (
                        (() => {
                          const Component = getPreviewComponent(preview.value.componentId)
                          return Component ? (
                            h(Component, {
                              path: selectedResult.value.outputPath,
                              text: selectedResult.value.content,
                            })
                          ) : (
                            <CodeEditor
                              modelValue={selectedResult.value.content}
                              language={preview.value.language}
                              height="100%"
                              theme={editorTheme.value}
                              options={{ readOnly: true }}
                            />
                          )
                        })()
                      ) : (
                        <CodeEditor
                          modelValue={selectedResult.value.content}
                          language={
                            preview.value?.language ??
                            languageFromPath(selectedResult.value.outputPath)
                          }
                          height="100%"
                          theme={editorTheme.value}
                          options={{ readOnly: true }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div class="d-flex align-center justify-center fill-height">
                    <VEmptyState
                      icon={FilePresentIcon}
                      title="No file selected"
                      text="Select a generated file to preview."
                    />
                  </div>
                )}
              </VCard>
            </div>
          ) : showGenLoading.value ? (
            <div class="d-flex align-center justify-center fill-height">
              <VProgressCircular indeterminate color="primary" size="64" />
            </div>
          ) : !genLoading.value && !genError.value ? (
            <VEmptyState
              icon={GenerateIcon}
              title="No files generated yet"
              text={
                'Click "Generate All" to render templates and write them, or pick "Dry Run" to preview without touching disk.'
              }
            />
          ) : null}
        </div>
      </div>
    )
  },
})
