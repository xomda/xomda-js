import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/extension.ts',
  output: {
    file: 'out/extension.cjs',
    format: 'cjs',
    sourcemap: true,
    codeSplitting: false,
  },
  platform: 'node',
  // The `vscode` module is supplied by the extension host at runtime and
  // must never be bundled. All other deps (including @xomda/* workspace
  // packages) are inlined so the .vsix is self-contained.
  external: ['vscode'],
})
