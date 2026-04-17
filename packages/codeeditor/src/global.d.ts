declare module '*.scss'
declare module '*.json'

// Vite's `?worker` query suffix imports — Monaco ships its workers
// this way. Without these shims, packages that transitively pull in
// `monaco.ts` (e.g. via `<CodeEditor>` used in another package's
// preview) fail tsc with "Cannot find module … ?worker".
declare module '*?worker' {
  const WorkerCtor: new () => Worker
  export default WorkerCtor
}
