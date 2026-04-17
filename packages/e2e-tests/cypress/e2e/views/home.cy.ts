describe('Home view', () => {
  it('loads the home page', () => {
    cy.visit('/')
    cy.location('pathname').should('eq', '/')
    cy.get('h1').should('be.visible')
  })
})
