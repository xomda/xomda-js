describe('Model view', () => {
  it('loads the model editor', () => {
    cy.visit('/model')
    cy.location('pathname').should('eq', '/model')
    cy.get('button[aria-label="Model"]').should('be.visible')
  })
})
