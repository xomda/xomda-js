export interface FileEntry {
  name: string
  isDirectory: boolean
  isXomda?: boolean
  isXomdaDir?: boolean
  isHidden?: boolean
  size: number
  mtime: string
  isGenerated?: boolean
}

export interface FileStats extends FileEntry {
  path: string
  atime: string
  ctime: string
  birthtime: string
  /** True when the owner write bit is off (display hint, not access control). */
  isReadOnly: boolean
  /** Raw low-9 POSIX mode bits — caller formats via @xomda/util modeTo* helpers. */
  mode: number
}

export type PreviewMap = Map<string, string>

export type PreviewKind = 'text' | 'markdown' | 'image' | 'binary' | 'custom' | 'none'

export interface PreviewBundle {
  kind: PreviewKind
  /** Set when kind === 'text' or 'markdown'. */
  text?: string
  /** Resolved Monaco language id for text previews. */
  language?: string
  /** Base64-encoded payload for image/binary previews. */
  base64?: string
  /** True when the byte payload was truncated server-side. */
  truncated?: boolean
  /** Original file size in bytes (binary previews). */
  size?: number
  /** When kind === 'custom', the componentId reported by the plugin. */
  componentId?: string
  /**
   * When kind === 'custom', the server-side `loadViewData` result for the
   * active view (parsed POM, package.json analysis, …). Passed through
   * to the custom component as its `data` prop.
   */
  data?: unknown
}

export interface TreeNode {
  entry: FileEntry
  path: string
  depth: number
  isExpanded: boolean
  isLoading: boolean
}
