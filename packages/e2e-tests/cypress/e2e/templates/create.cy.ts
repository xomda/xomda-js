// Creates a new template and configures a Loop cell.
// The afterEach hook deletes leftover "New Template" entries so the
// suite leaves no garbage behind.

describe('Templates – create', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  afterEach(() => {
    cy.cleanupTemplatesByName('New Template')
  })

  it('creates a new template via the toolbar button', () => {
    cy.contains('button', 'New template').click()
    cy.location('search').should('include', 'template=')
    cy.contains('Properties').should('be.visible')
  })

  it('configures a Loop cell on a freshly created template', () => {
    cy.contains('button', 'New template').click()
    cy.location('search').should('include', 'template=')

    cy.get('button[aria-label="Add cell"]').should('be.visible').click()
    cy.contains('.xomda-menu-item', 'Loop').click()

    cy.contains('label', 'Loop over').closest('.v-input').find('.v-field').click()
    cy.contains('.v-list-item', 'Enums').click()
    cy.get('input[placeholder="item"]').clear().type('entities')
    cy.contains('label', 'Loop over').closest('.v-input').should('contain.text', 'Enums')
    cy.get('input[placeholder="item"]').should('have.value', 'entities')

    cy.get('button[aria-label="Cell actions"]').should('have.length', 1)
    cy.get('button[aria-label="Add cell below"]').should('have.length', 1)
  })
})
