// Tests the templates view chrome: navigation drawer + resizable panels +
// folder navigation. No template is created, so no cleanup is needed.

describe('Templates – navigation & layout', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  it('expands and collapses the navigation drawer', () => {
    cy.dragNavSeparator(60)
    cy.get('[aria-label="Drag left to collapse navigation"]').should('exist')
    cy.dragNavSeparator(-60)
    cy.get('[aria-label="Drag right to expand navigation"]').should('exist')
  })

  it('exposes resizable column dividers when a template is selected', () => {
    cy.contains('.v-list-item', 'TypeScript').click()
    cy.contains('.v-list-item', 'Zod Schema', { timeout: 10000 }).click()
    cy.contains('Properties').should('be.visible')
    cy.get('[data-panel-divider="vertical"]').should('have.length', 2)
    cy.get('[data-panel-divider="vertical"]').each(($divider) => {
      expect(getComputedStyle($divider[0]).cursor).to.equal('col-resize')
    })
  })

  it('selects a template via the sidebar and adds it to the URL', () => {
    cy.contains('.v-list-item', 'TypeScript').click()
    cy.contains('.v-list-item', 'Zod Schema', { timeout: 10000 }).click()
    cy.location('search').should('include', 'template=')
  })
})
