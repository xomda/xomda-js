export interface AnalysisContext {
  rootPath: string
  fileExists(relativePath: string): boolean
  readFile(relativePath: string): Promise<string | null>
  listFiles(relativePath?: string): string[]
}

export interface FileExistsPattern {
  type: 'file-exists'
  paths: string[]
}

export interface FileContentPattern {
  type: 'file-content'
  path: string
  match: string | RegExp
}

export type DetectionPattern = FileExistsPattern | FileContentPattern

export interface AnalysisPlugin {
  id: string
  name: string
  patterns?: DetectionPattern[]
  detect?: (context: AnalysisContext) => boolean | PromiseLike<boolean>
}

export interface DetectedFeature {
  pluginId: string
  name: string
}

export interface AnalysisResult {
  rootPath: string
  features: DetectedFeature[]
  analyzedAt: string
}
