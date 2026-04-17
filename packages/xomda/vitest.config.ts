import { defineConfig } from 'vitest/config'

// Both test files (build.spec.ts and install-smoke.spec.ts) run
// `buildPublishArtifact()` in beforeAll — they each rewrite `target/npm/`.
// Run them serially so the two builds don't trample each other; the install
// smoke is slow enough that file parallelism doesn't buy us much anyway.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
})
