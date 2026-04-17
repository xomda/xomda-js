// Top-level smoke for the SPA chrome:
//  - Each primary nav button routes to the right page.
//  - The nav drawer can be expanded and collapsed via the resize separator.
//  - The theme toggle flips state and the icon's aria-label follows.
//
// Anything specific to an individual page lives under that page's folder.

const NAV_ITEMS: Array<{ label: string; path: string }> = [
  { label: 'Home', path: '/' },
  { label: 'Model', path: '/model' },
  { label: 'Versions', path: '/versions' },
  { label: 'Templates', path: '/templates' },
  { label: 'Template Generation', path: '/generate' },
  { label: 'Files', path: '/files' },
]

describe('SPA smoke', () => {
  beforeEach(() => {
    cy.visitHome()
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
    cy.dragNavSeparator(60)
    cy.get('[aria-label="Drag left to collapse navigation"]').should('exist')
    cy.dragNavSeparator(-60)
    cy.get('[aria-label="Drag right to expand navigation"]').should('exist')
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
