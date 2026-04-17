// Creates a new template and configures a Loop cell. afterEach removes
// leftover "New Template" entries so the suite leaves no garbage behind.

describe('Templates – create', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  afterEach(() => {
    cy.cleanupTemplatesByName('New Template')
  })

  it('creates a new template via the toolbar button', () => {
    cy.createNewTemplate()
    cy.contains('Properties').should('be.visible')
  })

  it('configures a Loop cell on a freshly created template', () => {
    cy.createNewTemplate()
    cy.addCellOfType('Loop')
    cy.configureLoopCell('Enums', 'entities')

    // Echo back what we just typed to be sure the form retained it.
    cy.contains('label', 'Loop over').closest('.v-input').should('contain.text', 'Enums')
    cy.get('input[placeholder="item"]').should('have.value', 'entities')

    cy.get('button[aria-label="Cell actions"]').should('have.length', 1)
    cy.get('button[aria-label="Add cell below"]').should('have.length', 1)
  })
})
