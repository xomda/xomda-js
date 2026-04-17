// Model view panels: entity/package toolbars, the attribute editor card,
// and the structure side panel. These tests don't mutate persistent layout
// state — see model/layout-and-zoom.cy.ts for the drag/zoom flows.

// Fixture IDs from the seeded xomda model. Stable across runs; if they
// drift, regenerate from `packages/seed/xomda.model.json`.
const ENTITY_ID = '913b8352-e06c-4ec5-8d47-f24e288dc03f'
const PACKAGE_ID = 'b3359d29-5e38-4c4f-ad2f-3e23f1718c11'

describe('Model – panels', () => {
  beforeEach(() => {
    cy.visitModel(ENTITY_ID)
  })

  it('opens and closes the entity and package toolbars', () => {
    cy.contains('button', 'Delete Entity').should('be.visible')

    // The diagram's "Toggle drag-and-drop mode" tooltip can briefly overlay
    // the entity/package name spans depending on cursor position — use
    // `force: true` so the click survives tooltip layering.
    cy.get(`[data-entity-id="${ENTITY_ID}"]`).contains('span', 'Entity').click({ force: true })
    cy.get('[aria-label="Model view toolbar"]').should('be.visible')
    cy.get('button[aria-label="Close toolbar"]').click()
    cy.get('[aria-label="Model view toolbar"]').should('not.exist')

    cy.get(`[data-package-id="${PACKAGE_ID}"]`).contains('span', 'model').click({ force: true })
    cy.get('[aria-label="Model view toolbar"]').should('be.visible')
    cy.get('button[aria-label="Close toolbar"]').click()
    cy.get('[aria-label="Model view toolbar"]').should('not.exist')
  })

  it('keeps attribute edits cancellable from both the dialog and the Cancel button', () => {
    cy.get(`[data-entity-id="${ENTITY_ID}"]`).contains('attributes').click({ force: true })
    cy.contains('.v-card', 'Delete Attribute').as('attributePanel')

    cy.get('@attributePanel').within(() => {
      cy.contains('button', 'Save').should('be.disabled')
      cy.get('input[aria-label="Required"]').should('be.checked')
      cy.get('input[aria-label="Multi Value"]').should('be.checked')
      cy.get('input[aria-label="Primary Key"]').should('not.be.checked')
      cy.get('input[aria-label="Unique"]').should('not.be.checked')

      cy.contains('button', 'Delete Attribute').click()
    })

    // 1) Dismiss the delete-attribute confirmation dialog.
    cy.dismissDialog('Delete Attribute')

    // 2) Dirty the name field, then Cancel — the panel should close.
    cy.get('@attributePanel').within(() => {
      cy.get('input[type="text"]').first().clear().type('attributese')
      cy.contains('button', 'Save').should('not.be.disabled')
      cy.contains('button', 'Cancel').should('be.visible').click()
    })
    cy.get('@attributePanel').should('not.exist')
  })

  it('opens and collapses the structure panel', () => {
    cy.chooseMenuAction('Model view options', 'Show structure panel')
    cy.contains('div', 'Structure').should('be.visible')
    cy.get('button[aria-label="Collapse tree panel"]').click()
    cy.contains('div', 'Structure').should('not.exist')
  })
})
