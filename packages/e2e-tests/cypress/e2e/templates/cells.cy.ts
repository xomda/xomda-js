// Exercises cell editing on a newly-created template: adding cells below
// and changing cell type. Cleanup runs in afterEach.

const createTemplateWithLoopCell = () => {
  cy.contains('button', 'New template').click()
  cy.location('search').should('include', 'template=')
  cy.get('button[aria-label="Add cell"]').should('be.visible').click()
  cy.contains('.xomda-menu-item', 'Loop').click()

  cy.contains('label', 'Loop over').closest('.v-input').find('.v-field').click()
  cy.contains('.v-list-item', 'Enums').click()
  cy.get('input[placeholder="item"]').clear().type('entities')
}

describe('Templates – cells', () => {
  beforeEach(() => {
    cy.visitTemplates()
    createTemplateWithLoopCell()
  })

  afterEach(() => {
    cy.cleanupTemplatesByName('New Template')
  })

  it('adds a second cell below the first', () => {
    cy.get('button[aria-label="Add cell below"]').click()
    cy.contains('.xomda-menu-item', 'Loop').click()
    cy.get('button[aria-label="Cell actions"]').should('have.length', 2)
  })

  it('adds a second JavaScript cell below the first', () => {
    cy.get('button[aria-label="Add cell below"]').click()
    cy.contains('.xomda-menu-item', 'JavaScript').click()

    cy.get('button[aria-label="Cell actions"]').should('have.length', 2)
    cy.get('input[placeholder="item"]').should('have.length', 1)
    cy.get('div[data-mode-id="javascript"]').should('have.length', 1)
  })
})
