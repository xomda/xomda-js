/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      visitTemplates(): Chainable<void>
      confirmDialog(label?: string): Chainable<void>
      deleteSelectedTemplate(): Chainable<void>
      cleanupTemplatesByName(name?: string): Chainable<void>
      dragNavSeparator(deltaX: number): Chainable<void>
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
  cy.get('button[aria-label="Delete template"]').click()
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
    cy.get('button[aria-label="Delete template"]').should('be.visible').click()
    cy.confirmDialog('Delete')
    // Recurse if more remain.
    cy.cleanupTemplatesByName(name)
  })
})

// Simulates a horizontal drag on the AppNav resize separator so the
// expand/collapse threshold is crossed.
Cypress.Commands.add('dragNavSeparator', (deltaX: number) => {
  cy.get('[aria-label$="expand navigation"], [aria-label$="collapse navigation"]')
    .first()
    .then(($el) => {
      const rect = ($el[0] as HTMLElement).getBoundingClientRect()
      const startX = rect.left + rect.width / 2
      const startY = rect.top + rect.height / 2
      cy.wrap($el)
        .trigger('pointerdown', { button: 0, clientX: startX, clientY: startY, pointerId: 1 })
        .trigger('pointermove', { clientX: startX + deltaX, clientY: startY, pointerId: 1 })
        .trigger('pointerup', { clientX: startX + deltaX, clientY: startY, pointerId: 1 })
    })
})

export {}
