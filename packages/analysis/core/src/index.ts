export type { FileTypesForResult, SerialisableFileTypeView, ViewsForEntry } from './analyzer'
export { ProjectAnalyzer } from './analyzer'
export type { MarkerCheck, WalkOptions } from './project-walker'
export { DEFAULT_WALKER_EXCLUDES, walkForProjectKinds } from './project-walker'
export {
  getRegisteredAnalysisPlugins,
  registerAnalysisPlugin,
  resetAnalysisRegistry,
} from './registry'
export type {
  AnalysisContext,
  AnalysisPlugin,
  AnalysisResult,
  DetectedFeature,
  DetectedProject,
  DetectionPattern,
  FileContentPattern,
  FileExistsPattern,
  FileTypeDescriptor,
  FileTypeMatcher,
  FileTypeView,
  OverviewContribution,
  OverviewSection,
  PluginMatch,
  PreviewHint,
  ProjectKindContribution,
  ProjectKindMeta,
  ProjectKindSubproject,
} from './types'
export type { RunAnalysisInWorkerOptions } from './worker'
export { runAnalysisInline, runAnalysisInWorker } from './worker'
