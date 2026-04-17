describe('Generate view', () => {
  it('loads the template generation page', () => {
    cy.visit('/generate')
    cy.location('pathname').should('eq', '/generate')
    cy.get('button[aria-label="Template Generation"]').should('be.visible')
  })
})
