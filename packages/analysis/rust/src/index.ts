import type { AnalysisPlugin } from '@xomda/analysis-core'

export const rustPlugin: AnalysisPlugin = {
  id: 'rust',
  name: 'Rust',
  patterns: [{ type: 'file-exists', paths: ['Cargo.toml'] }],
}
