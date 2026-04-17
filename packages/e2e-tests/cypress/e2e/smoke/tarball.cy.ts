// Browser-level smoke against the SPA served by an installed `xomda` tarball.
//
// Run via the orchestrator: `pnpm -F @xomda/bundle test:tarball-cypress`,
// which (a) builds + npm-installs the tarball into a tmp dir, (b) spawns
// `xomda` from there on the agreed Cypress port, then (c) invokes Cypress
// with this spec. Don't try to run this against `pnpm dev` — the importmap
// + /vendor/* contract is publish-mode only. That's why this spec is in
// `excludeSpecPattern` for the default `cypress run`.
//
// Asserts only what's stable across releases. Anything content-specific
// (button labels, route names) belongs in the other specs that target the
// dev server.

describe('Tarball smoke', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.removeItem('xomda-config')
        // Capture any console errors that fire during SPA boot — a vendor
        // import failing or Vue refusing to mount is a release blocker.
        cy.spy(win.console, 'error').as('consoleError')
      },
    })
  })

  it('boots without console errors', () => {
    cy.get('@consoleError').should('not.have.been.called')
  })

  it('renders an importmap into <head> with /vendor/ targets', () => {
    cy.document().then((doc) => {
      const tag = doc.querySelector('script[type="importmap"]')
      // Chai's `.exist` is a getter, not a function — ESLint flags it as a
      // bare expression but that's the canonical chai-jquery assertion.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(tag, 'importmap <script> tag').to.exist
      const map = JSON.parse(tag!.textContent ?? '{}') as { imports: Record<string, string> }
      expect(Object.keys(map.imports).length, 'importmap has at least one entry').to.be.greaterThan(
        0
      )
      for (const target of Object.values(map.imports)) {
        expect(target, `${target} routes through /vendor/`).to.match(/^\/vendor\//)
      }
    })
  })

  it('successfully fetches at least one /vendor/ asset (importmap is honored)', () => {
    cy.document().then((doc) => {
      const tag = doc.querySelector('script[type="importmap"]')
      const map = JSON.parse(tag!.textContent ?? '{}') as { imports: Record<string, string> }
      const target = Object.values(map.imports).find((v) => v.endsWith('.js'))
      expect(target, 'importmap should expose at least one .js entry').to.be.a('string')
      cy.request(target!).its('status').should('eq', 200)
    })
  })

  it('mounts the Vue app (root element has children)', () => {
    cy.get('#app').should('exist')
    cy.get('#app').children().its('length').should('be.greaterThan', 0)
  })

  it('serves the SPA fallback for unknown routes', () => {
    cy.visit('/some/unknown/spa/route')
    cy.get('#app').should('exist')
  })
})
