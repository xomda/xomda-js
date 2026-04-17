// Triggers a project re-scan from the Files view, then asserts that the
// resulting notification surfaces in the Notifications & Logs view and can
// be cleared.

describe('Notifications – project re-scan', () => {
  it('shows and clears notifications after a project re-scan', () => {
    cy.visitFiles()

    cy.get('button[aria-label="Re-scan project"]').click()
    cy.contains('Project re-scanned', { timeout: 30000 }).should('be.visible')

    cy.get('button[aria-label="Notifications & Logs"]').click()
    cy.location('pathname').should('eq', '/logs')
    cy.contains('Notifications & Logs').should('be.visible')

    // Both tabs render — switch through Logs and back to Notifications.
    cy.contains('button', 'Notifications').should('be.visible')
    cy.contains('button', 'Logs').should('be.visible').click()
    cy.contains('button', 'Notifications').click()

    cy.contains('Project re-scanned').should('be.visible')
    cy.contains('button', 'Clear').click()
    cy.contains('No notifications yet').should('be.visible')
  })
})
