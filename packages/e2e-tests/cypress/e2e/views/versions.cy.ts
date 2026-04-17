describe('Versions view', () => {
  it('loads the versions page', () => {
    cy.visit('/versions')
    cy.location('pathname').should('eq', '/versions')
    cy.get('button[aria-label="Versions"]').should('be.visible')
  })
})
