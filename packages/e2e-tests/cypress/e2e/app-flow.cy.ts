// Smoke test that walks the primary navigation and verifies each
// destination route loads. If any nav button is removed or wired to the
// wrong route, this should fail.

const NAV_ITEMS: Array<{ label: string; path: string }> = [
  { label: 'Home', path: '/' },
  { label: 'Model', path: '/model' },
  { label: 'Versions', path: '/versions' },
  { label: 'Templates', path: '/templates' },
  { label: 'Template Generation', path: '/generate' },
  { label: 'Files', path: '/files' },
]

describe('App flow', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.removeItem('xomda-config')
      },
    })
  })

  it('navigates to every primary section via the nav buttons', () => {
    NAV_ITEMS.forEach(({ label, path }) => {
      cy.get(`button[aria-label="${label}"]`).should('be.visible').click()
      cy.location('pathname').should((p) => {
        // The Templates and Files routes can append folder segments.
        expect(p === path || p.startsWith(`${path}/`)).to.equal(true)
      })
    })
  })

  it('expands and collapses the navigation drawer', () => {
    cy.get('button[aria-label="Expand navigation"]').click()
    cy.get('button[aria-label="Collapse navigation"]').should('be.visible').click()
    cy.get('button[aria-label="Expand navigation"]').should('be.visible')
  })

  it('toggles between light and dark themes', () => {
    cy.get('button[aria-label^="Switch to"]').then(($btn) => {
      const initial = $btn.attr('aria-label')
      cy.wrap($btn).click()
      cy.get('button[aria-label^="Switch to"]')
        .invoke('attr', 'aria-label')
        .should('not.equal', initial)
    })
  })
})
