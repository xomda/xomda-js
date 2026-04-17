// Vite's `?raw` query loads a file's contents as a string at build time.
// Used by `src/icons/devicons.ts` to pull per-icon SVG markup from the
// `devicon` npm package — tree-shakes naturally because each import is its
// own module specifier.
declare module '*.svg?raw' {
  const content: string
  export default content
}
