import { defineConfig } from 'cypress'

// Dedicated port for Cypress runs. The `test` script builds the client and
// starts @xomda/node with `--port ${CYPRESS_PORT}`; the node server serves the
// built SPA and the tRPC API from the same origin, so the client's relative
// `/trpc` URL works without a Vite dev-server proxy.
export const CYPRESS_PORT = 6440

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl: `http://localhost:${CYPRESS_PORT}`,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
})
