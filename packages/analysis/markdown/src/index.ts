import { type AnalysisPlugin, registerAnalysisPlugin } from '@xomda/analysis-core'

/**
 * Markdown file-type contributions. Like `binary`, this plugin has no
 * `detect`/`patterns` and never shows up as a "detected feature" — it
 * exists so `fileTypesFor(path)` routes every recognised markdown
 * extension (`.md`, `.mdc`, `.markdown`, `.mkd`, `.mdown`, `.rmd`) to
 * a two-tab preview (Preview + Source). Authority over
 * extension-to-renderer mapping lives here, not in the hardcoded
 * `LANGUAGE_MAP` fallback in `@xomda/ui`.
 */
export const markdownPlugin: AnalysisPlugin = {
  id: 'markdown',
  name: 'Markdown',
  icon: 'markdown',
  fileTypes: [
    {
      id: 'markdown-file',
      label: 'Markdown',
      match: { extensions: ['md', 'mdc', 'markdown', 'mkd', 'mdown', 'rmd'] },
      icon: 'markdown',
      // Preview first: a `.md` file is documentation, not code, so
      // landing on the prose view is what readers want. The Source
      // tab keeps the raw editor a click away. (`id: 'rendered'` is
      // kept stable as the routing key — only the display label
      // changed.)
      views: [
        {
          id: 'rendered',
          label: 'Preview',
          preview: { kind: 'custom', componentId: 'markdown-rendered' },
        },
        {
          id: 'source',
          label: 'Source',
          preview: { kind: 'text', language: 'markdown' },
        },
      ],
      // Same priority tier as `binary`'s baseline routing (1) so technology
      // plugins that happen to claim a `.md` (e.g. a hypothetical docs
      // bundler config) still win preview routing.
      priority: 1,
    },
  ],
}

registerAnalysisPlugin(markdownPlugin)
