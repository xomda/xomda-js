// Preferences view: section navigation via hash, dirty-state on edits,
// and theme persistence across reload.

describe('Settings – preferences', () => {
  it('navigates preference sections, marks changes dirty, and persists the selected theme', () => {
    cy.visitSettings('sandbox')

    cy.get('[aria-label="Preferences sections"] [role="tablist"]').should('be.visible')
    cy.get('[data-section-id="sandbox"]').should('be.visible')

    // Section tabs sync to the URL hash.
    cy.contains('button[role="tab"]', 'Diagram').click()
    cy.location('hash').should('eq', '#diagram')

    cy.contains('button[role="tab"]', 'Project boundaries').click()
    cy.location('hash').should('eq', '#boundaries')

    cy.contains('button[role="tab"]', 'Plugins').click()
    cy.location('hash').should('eq', '#plugins')

    // Save/Cancel start disabled — no pending edits.
    cy.get('[aria-label="Preferences actions"]').within(() => {
      cy.contains('button', 'Save').should('be.disabled')
      cy.contains('button', 'Cancel').should('be.disabled')
    })

    // Editing a sandbox toggle dirties the form; Cancel reverts it.
    cy.contains('button[role="tab"]', 'File-system sandbox').click()
    cy.location('hash').should('eq', '#sandbox')
    cy.get('[data-section-id="sandbox"]')
      .find('input[type="checkbox"]')
      .first()
      .click({ force: true })

    cy.get('[aria-label="Preferences actions"]').within(() => {
      cy.contains('button', 'Save').should('not.be.disabled')
      cy.contains('button', 'Cancel').should('not.be.disabled').click()
      cy.contains('button', 'Save').should('be.disabled')
    })

    // Theme toggle persists across a full page reload.
    cy.get('button[aria-label^="Switch to"]').then(($button) => {
      const initialLabel = $button.attr('aria-label') ?? ''
      const expectedLabel =
        initialLabel === 'Switch to light mode' ? 'Switch to dark mode' : 'Switch to light mode'

      cy.wrap($button).click()
      cy.get(`button[aria-label="${expectedLabel}"]`).should('be.visible')

      cy.reload()
      cy.location('pathname').should('eq', '/settings')
      cy.get(`button[aria-label="${expectedLabel}"]`).should('be.visible')
    })
  })
})
