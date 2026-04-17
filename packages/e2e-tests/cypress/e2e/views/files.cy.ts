describe('Files view', () => {
  it('loads the file browser', () => {
    cy.visit('/files')
    cy.location('pathname').should('match', /^\/files/)
    cy.get('button[aria-label="Files"]').should('be.visible')
  })
})
