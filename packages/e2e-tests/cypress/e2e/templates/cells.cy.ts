// Cell editing on a newly-created template: adding cells below an existing
// cell and varying their type. Cleanup runs in afterEach.

describe('Templates – cells', () => {
  beforeEach(() => {
    cy.visitTemplates()
    cy.createNewTemplate()
    cy.addCellOfType('Loop')
    cy.configureLoopCell('Enums', 'entities')
  })

  afterEach(() => {
    cy.cleanupTemplatesByName('New Template')
  })

  it('adds a second Loop cell below the first', () => {
    cy.addCellOfType('Loop', { below: true })
    cy.get('button[aria-label="Cell actions"]').should('have.length', 2)
  })

  it('adds a second JavaScript cell below the first', () => {
    cy.addCellOfType('JavaScript', { below: true })

    cy.get('button[aria-label="Cell actions"]').should('have.length', 2)
    cy.get('input[placeholder="item"]').should('have.length', 1)
    cy.get('div[data-mode-id="javascript"]').should('have.length', 1)
  })
})
