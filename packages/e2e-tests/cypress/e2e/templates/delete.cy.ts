// Exercises the delete-template flow: create, dismiss the confirmation
// dialog once to prove it's cancellable, then delete via the toolbar.

describe('Templates – delete', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  // Belt-and-suspenders: scrub anything left behind, just in case.
  after(() => {
    cy.cleanupTemplatesByName('New Template')
  })

  it('deletes a template through the toolbar after confirming', () => {
    cy.createNewTemplate()
    cy.get('button[aria-label="Delete template"]').should('be.visible').click()

    // Cancel first to verify the dialog is dismissable.
    cy.dismissDialog('Delete template')

    // The template is still selected — delete and confirm.
    cy.get('button[aria-label="Delete template"]').should('be.visible').click()
    cy.confirmDialog('Delete')

    // After deletion the toolbar Delete button is no longer rendered.
    cy.get('button[aria-label="Delete template"]').should('not.exist')
    cy.location('search').should('not.include', 'template=')
  })
})
