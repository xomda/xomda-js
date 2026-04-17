// Global E2E support file — runs before every spec.
// https://docs.cypress.io/app/core-concepts/writing-and-organizing-tests#Support-file
import './commands'

// ResizeObserver loop notifications are benign browser warnings emitted by
// Vuetify's reactive layout code. Don't fail tests on them.
Cypress.on('uncaught:exception', (err) => {
  if (/ResizeObserver loop/.test(err.message)) return false
  return undefined
})
