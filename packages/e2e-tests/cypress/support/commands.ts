/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      visitTemplates(): Chainable<void>
      confirmDialog(label?: string): Chainable<void>
      deleteSelectedTemplate(): Chainable<void>
      cleanupTemplatesByName(name?: string): Chainable<void>
    }
  }
}

Cypress.Commands.add('visitTemplates', () => {
  cy.visit('/templates', {
    onBeforeLoad(win) {
      win.localStorage.removeItem('xomda-config')
    },
  })
  cy.location('pathname').should('eq', '/templates')
})

Cypress.Commands.add('confirmDialog', (label: string = 'Delete') => {
  cy.get('.v-overlay.v-dialog')
    .filter(':visible')
    .within(() => {
      cy.contains('button', label).click()
    })
  cy.get('.v-overlay.v-dialog').should('not.exist')
})

// Deletes the currently selected template via the toolbar Delete button.
Cypress.Commands.add('deleteSelectedTemplate', () => {
  cy.contains('button', 'Delete').click()
  cy.confirmDialog('Delete')
})

// Removes any leftover templates with the given name (default: "New Template")
// by visiting the templates view and clicking the row context-menu Delete.
Cypress.Commands.add('cleanupTemplatesByName', (name: string = 'New Template') => {
  cy.visitTemplates()
  cy.get('body').then(($body) => {
    const matches = $body.find(`.v-list-item:contains("${name}")`)
    if (!matches.length) return
    cy.wrap(matches.first()).click()
    cy.contains('button', 'Delete').should('be.visible').click()
    cy.confirmDialog('Delete')
    // Recurse if more remain.
    cy.cleanupTemplatesByName(name)
  })
})

export {}
