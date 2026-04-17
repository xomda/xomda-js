// Exercises the delete-template flow explicitly: create, confirm,
// then delete via the toolbar Delete button + confirmation dialog.

describe('Templates – delete', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  it('deletes a template through the toolbar after confirming', () => {
    cy.contains('button', 'New template').click()
    cy.location('search').should('include', 'template=')
    cy.contains('button', 'Delete').should('be.visible').click()

    // Cancel first to verify the dialog is dismissable.
    cy.get('.v-overlay.v-dialog')
      .filter(':visible')
      .within(() => {
        cy.contains('Delete template').should('be.visible')
        cy.contains('button', 'Cancel').click()
      })
    cy.get('.v-overlay.v-dialog').should('not.exist')

    // The template is still selected — delete and confirm.
    cy.contains('button', 'Delete').should('be.visible').click()
    cy.confirmDialog('Delete')

    // After deletion the toolbar Delete button is no longer rendered.
    cy.contains('button', 'Delete').should('not.exist')
    cy.location('search').should('not.include', 'template=')
  })

  // Belt-and-suspenders: scrub anything left behind, just in case.
  after(() => {
    cy.cleanupTemplatesByName('New Template')
  })
})
