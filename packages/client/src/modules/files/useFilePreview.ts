import { languageFromPath, useAsyncState } from '@xomda/ui'
import { type Ref, ref } from 'vue'

import type { FileStats, PreviewBundle, PreviewMap } from './types'

export interface PreviewHintResult {
  preview?:
    | { kind: 'text'; language?: string }
    | { kind: 'markdown' }
    | { kind: 'image' }
    | { kind: 'binary' }
    | { kind: 'custom'; componentId: string }
}

/**
 * One concrete view to render for a file, chosen by the caller (the
 * FileBrowserView tab bar). Bundles the plugin/file-type/view ids so
 * the preview pipeline can ask the server for the matching `viewData`
 * when the view's preview kind is `custom`.
 */
export interface SelectedView {
  pluginId: string
  fileTypeId: string
  viewId: string
  /** Tab label as declared by the plugin (or the analyzer's default-view fallback). */
  label: string
  preview: NonNullable<PreviewHintResult['preview']>
  hasLoadViewData: boolean
}

export interface FilePreviewDeps {
  previewMap: Ref<PreviewMap>
  getStats: (path: string) => Promise<FileStats>
  readFile: (path: string) => Promise<{ content: string }>
  readBytes: (
    path: string,
    maxBytes?: number
  ) => Promise<{ base64: string; size: number; truncated: boolean }>
  fileTypesFor: (path: string) => Promise<PreviewHintResult>
  /** Optional — fetch view-specific server data (for custom views). */
  viewData?: (args: {
    pluginId: string
    fileTypeId: string
    viewId: string
    path: string
  }) => Promise<{ data?: unknown }>
}

const DEFAULT_BINARY_MAX = 65_536
const DEFAULT_IMAGE_MAX = 4 * 1024 * 1024

/**
 * Manages the inline-preview state for the file browser. Tracks a per-call
 * sequence number so that responses from clicks the user has already moved
 * past cannot overwrite the current preview. When a `view` is supplied the
 * view's preview hint and (for custom kinds) `loadViewData` payload drive
 * rendering; otherwise we fall back to the plugin-registry hint from
 * `fileTypesFor`.
 */
export function useFilePreview({
  previewMap,
  getStats,
  readFile,
  readBytes,
  fileTypesFor,
  viewData,
}: FilePreviewDeps) {
  const selectedFile = ref<FileStats | null>(null)
  const previewTitle = ref('')
  const preview = ref<PreviewBundle>({ kind: 'none' })
  const showInfo = ref(true)
  const { loading, run } = useAsyncState<FileStats | null>()

  let loadSeq = 0

  const setText = (text: string, language: string) => {
    preview.value = { kind: 'text', text, language }
  }

  const loadFileByPath = async (
    fullPath: string,
    isGeneratedVirtual: boolean,
    view?: SelectedView
  ) => {
    const seq = ++loadSeq
    if (isGeneratedVirtual) {
      previewTitle.value = fullPath
      setText(previewMap.value.get(fullPath) ?? '', languageFromPath(fullPath))
      selectedFile.value = null
      return
    }

    await run(async () => {
      // When a specific view is selected, skip the fileTypesFor round-trip
      // and use the view's preview hint directly.
      const [stats, hint] = view
        ? [await getStats(fullPath), { preview: view.preview } as PreviewHintResult]
        : await Promise.all([getStats(fullPath), fileTypesFor(fullPath)])
      if (seq !== loadSeq) return stats
      previewTitle.value = fullPath
      selectedFile.value = stats

      const kind = hint.preview?.kind ?? 'text'
      if (kind === 'image') {
        const bytes = await readBytes(fullPath, DEFAULT_IMAGE_MAX)
        if (seq !== loadSeq) return stats
        preview.value = { kind: 'image', base64: bytes.base64, size: bytes.size }
      } else if (kind === 'binary') {
        const bytes = await readBytes(fullPath, DEFAULT_BINARY_MAX)
        if (seq !== loadSeq) return stats
        preview.value = {
          kind: 'binary',
          base64: bytes.base64,
          size: bytes.size,
          truncated: bytes.truncated,
        }
      } else if (kind === 'custom') {
        const componentId =
          hint.preview && hint.preview.kind === 'custom' ? hint.preview.componentId : undefined
        // For custom views: optionally fetch parsed server-side data,
        // and read the raw file text in parallel so plugin components
        // can fall back to source when their data loader is missing or
        // returns null.
        const [content, dataResult] = await Promise.all([
          readFile(fullPath),
          view?.hasLoadViewData && viewData
            ? viewData({
                pluginId: view.pluginId,
                fileTypeId: view.fileTypeId,
                viewId: view.viewId,
                path: fullPath,
              })
            : Promise.resolve({ data: undefined }),
        ])
        if (seq !== loadSeq) return stats
        preview.value = {
          kind: 'custom',
          text: content.content,
          language: languageFromPath(fullPath),
          ...(componentId !== undefined ? { componentId } : {}),
          ...(dataResult.data !== undefined ? { data: dataResult.data } : {}),
        }
      } else {
        const { content } = await readFile(fullPath)
        if (seq !== loadSeq) return stats
        const language =
          (hint.preview?.kind === 'text' && hint.preview.language) ||
          (hint.preview?.kind === 'markdown' ? 'markdown' : undefined) ||
          languageFromPath(fullPath)
        preview.value = {
          kind: hint.preview?.kind === 'markdown' ? 'markdown' : 'text',
          text: content,
          language,
        }
      }
      return stats
    })
  }

  const clearPreview = () => {
    loadSeq++
    selectedFile.value = null
    previewTitle.value = ''
    preview.value = { kind: 'none' }
  }

  const closeInfo = () => {
    showInfo.value = false
  }

  const openInfo = () => {
    showInfo.value = true
  }

  return {
    selectedFile,
    previewTitle,
    preview,
    showInfo,
    loading,
    loadFileByPath,
    clearPreview,
    closeInfo,
    openInfo,
  }
}
