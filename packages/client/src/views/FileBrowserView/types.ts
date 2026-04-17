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
}

export type PreviewMap = Map<string, string>

export interface TreeNode {
  entry: FileEntry
  path: string
  depth: number
  isExpanded: boolean
  isLoading: boolean
}
