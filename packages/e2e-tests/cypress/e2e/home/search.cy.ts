// Quick search on the home page — typing a term, picking a result, and
// landing on the corresponding model entity.

describe('Home – quick search', () => {
  beforeEach(() => {
    cy.visitHome()
  })

  it('opens the searched entity from quick search', () => {
    cy.get('input[placeholder="Search"]').should('be.visible').click().type('entity')
    cy.get('#app-search-results').should('be.visible')
    cy.contains('#app-search-results [role="option"]', 'xomda.model').click()

    cy.location('pathname').should('eq', '/model')
    cy.contains('button', 'Delete Entity').should('be.visible')
    cy.contains('.v-card', 'Properties').should('contain.text', 'Entity')
  })
})
