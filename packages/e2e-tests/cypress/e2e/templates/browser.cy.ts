// Stable fixture data from the seeded templates. TEMPLATE_CELL_UUID points at
// a Loop cell that wraps child cells — when iterating its inner buttons we
// must scope to the cell's *own* controls with `.first()`, since each nested
// child cell renders its own Expand/Collapse/Cell-actions buttons inside the
// same `[data-cell-uuid]` subtree.
const TEMPLATE_NAME = 'xomda Core Schema'
const TEMPLATE_CELL_UUID = '10b5b634-23fe-4cb9-8dc4-8efcf1caa2c8'
const MOVABLE_CELL_UUID = '2dc4e3d8-3ad0-4cc2-99b9-7813ad02907a'
const FOLDER_NAME = 'Joris QA Folder'

const openTemplate = () => {
  // The left-pane templates browser owns the folder/template tree. Scoping
  // to `main` keeps us out of nav buttons / inner editor lists that can also
  // contain the same labels.
  cy.get('main').contains('.v-list-item', 'TypeScript').first().click()
  cy.get('main').contains('.v-list-item', TEMPLATE_NAME, { timeout: 10000 }).first().click()
  cy.location('search').should('include', 'template=')
}

const cellIndex = (uuid: string) =>
  cy
    .get('[data-cell-uuid]')
    .then(($cells) => [...$cells].findIndex((cell) => cell.getAttribute('data-cell-uuid') === uuid))

describe('Templates – browser interactions', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  afterEach(() => {
    cy.cleanupTemplateFoldersByName(FOLDER_NAME)
  })

  it('selects a template and exercises expand, collapse, move, and menu actions', () => {
    openTemplate()

    cy.get(`[data-cell-uuid="${TEMPLATE_CELL_UUID}"]`).within(() => {
      // `.first()` because child cells re-render their own Expand/Collapse
      // buttons inside the same scope.
      cy.get('button[aria-label="Expand"]').first().click()
      cy.get('button[aria-label="Collapse"]').first().should('be.visible')
    })

    cellIndex(MOVABLE_CELL_UUID).then((initialIndex) => {
      cy.get(`[data-cell-uuid="${MOVABLE_CELL_UUID}"]`).within(() => {
        cy.get('button[aria-label="Collapse"]').first().click()
        cy.contains('span', 'JavaScript').should('be.visible')
        cy.get('button[aria-label="Cell actions"]').first().click()
      })
      cy.contains('.xomda-menu-item', 'Move down').click()

      cellIndex(MOVABLE_CELL_UUID).should('be.greaterThan', initialIndex)

      cy.get(`[data-cell-uuid="${MOVABLE_CELL_UUID}"]`).within(() => {
        cy.get('button[aria-label="Expand"]').first().click()
        cy.get('button[aria-label="Move cell up"]').first().click()
      })

      cellIndex(MOVABLE_CELL_UUID).should('eq', initialIndex)
    })

    cy.openTemplateBrowserActions(TEMPLATE_NAME)
    cy.get('.xomda-menu')
      .filter(':visible')
      .within(() => {
        cy.contains('.xomda-menu-item', 'Rename').should('be.visible')
        cy.contains('.xomda-menu-item', 'Duplicate').should('be.visible')
        cy.contains('.xomda-menu-item', 'Move to folder').should('be.visible')
        cy.contains('.xomda-menu-item', 'Delete').should('be.visible')
      })
  })

  it('switches to list view and navigates folders with the parent-folder entry', () => {
    cy.chooseMenuAction('View options', 'List')

    // At the root, List view shows folders only — drill into one, jump up
    // via the synthetic `..` entry, then dig into a sibling folder and open
    // a template from there.
    cy.get('main').contains('.v-list-item', 'TypeScript').first().click()
    cy.contains('.v-list-item', '.. (Parent Folder)').should('be.visible').click()
    cy.get('main').contains('.v-list-item', 'Java').first().click()
    cy.contains('.v-list-item', '.. (Parent Folder)').should('be.visible')
    cy.get('main').contains('.v-list-item', 'Main Template (Java)').first().click()
    cy.location('search').should('include', 'template=')
  })

  it('creates a folder with validation and deletes it after canceling once', () => {
    cy.chooseMenuAction('View options', 'List')

    cy.get('button[aria-label="New folder"]').click()
    cy.contains('Create new folder').should('be.visible')
    // Scope every dialog interaction to the open dialog itself. The right-pane
    // empty state contains a "Create a new template" CTA — `cy.contains('button',
    // 'Create')` matched that one in DOM order, then failed clicking it because
    // the dialog scrim was covering it.
    const inOpenDialog = () => cy.get('.v-overlay.v-dialog').filter(':visible')
    inOpenDialog().contains('button', 'Create').click()
    cy.contains('Name is required').should('be.visible')
    // Vuetify-generated `#input-v-NN` IDs aren't stable across renders; the
    // dialog has exactly one text field, so grab the first.
    inOpenDialog().find('input[type="text"]').first().type(FOLDER_NAME)
    inOpenDialog().contains('button', 'Create').click()

    cy.contains('.v-list-item', FOLDER_NAME).should('be.visible')

    cy.openTemplateBrowserActions(FOLDER_NAME)
    cy.contains('.xomda-menu-item', 'Delete').click()
    cy.dismissDialog('Delete folder')
    cy.contains('.v-list-item', FOLDER_NAME).should('be.visible')

    cy.openTemplateBrowserActions(FOLDER_NAME)
    cy.contains('.xomda-menu-item', 'Delete').click()
    cy.confirmDialog('Delete')
    cy.contains('[role="status"]', 'Folder deleted').should('be.visible')
    cy.contains('.v-list-item', FOLDER_NAME).should('not.exist')
  })
})
