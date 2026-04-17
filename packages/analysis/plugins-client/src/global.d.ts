// Side-effect SCSS imports and Vite's `?worker` query suffix appear in
// transitively-compiled plugin client modules (e.g. MarkdownPreview's
// stylesheet, CodeEditor's Monaco workers). Bundled by Vite at the
// app build; types-only here so tsc through this aggregator passes.
declare module '*.scss'
declare module '*?worker' {
  const WorkerCtor: new () => Worker
  export default WorkerCtor
}
