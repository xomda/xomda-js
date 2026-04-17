import { defineConfig } from 'cypress'

import { registerSandboxTasks } from './cypress/plugins/sandbox-tasks'

// Dedicated port for Cypress runs. The `test` script builds the client and
// starts @xomda/node with `--port ${CYPRESS_PORT}`; the node server serves the
// built SPA and the tRPC API from the same origin, so the client's relative
// `/trpc` URL works without a Vite dev-server proxy.
export const CYPRESS_PORT = 6440

export default defineConfig({
  allowCypressEnv: false,
  // CI's renderer occasionally OOMs mid-suite ("Electron Renderer process
  // just crashed") on the heavier model specs. These two flags trade a bit
  // of in-runner snapshot history for a renderer that GCs between tests.
  experimentalMemoryManagement: true,
  numTestsKeptInMemory: 5,
  e2e: {
    retries: { runMode: 2 },
    baseUrl: `http://localhost:${CYPRESS_PORT}`,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    // smoke/tarball.cy.ts targets the *installed* `xomda` (publish-mode SPA
    // with an importmap + /vendor/* — that contract doesn't exist in dev).
    // It's run separately by `pnpm -F @xomda/bundle test:tarball-cypress`,
    // which spins up its own server and points baseUrl at it.
    excludeSpecPattern: ['cypress/e2e/smoke/tarball.cy.ts'],
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on) {
      registerSandboxTasks(on)
    },
  },
})
