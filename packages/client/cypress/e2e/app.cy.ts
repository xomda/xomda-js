describe('App', () => {
  it('loads the home page', () => {
    cy.visit('/')
    cy.contains('Hello from xomda.js')
  })
})
