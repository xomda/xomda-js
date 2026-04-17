declare module '*.scss'

// `?worker` ambient module so transitively-compiled `@xomda/codeeditor`
// (which spawns Monaco workers via Vite's `?worker` suffix) doesn't
// fail markdown's tsc. Runtime is handled by Vite at app-build time.
declare module '*?worker' {
  const WorkerCtor: new () => Worker
  export default WorkerCtor
}
