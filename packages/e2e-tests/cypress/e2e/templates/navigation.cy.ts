// Tests the templates view chrome: navigation drawer + resizable panels +
// folder navigation. No template is created, so no cleanup is needed.

const getColumnDividers = () =>
  cy.get('div').filter((_, element) => getComputedStyle(element).cursor === 'col-resize')

describe('Templates – navigation & layout', () => {
  beforeEach(() => {
    cy.visitTemplates()
  })

  it('expands and collapses the navigation drawer', () => {
    cy.get('button[aria-label="Expand navigation"]').click()
    cy.get('button[aria-label="Collapse navigation"]').should('be.visible').click()
    cy.get('button[aria-label="Expand navigation"]').should('be.visible')
  })

  it('exposes resizable column dividers when a template is selected', () => {
    cy.contains('.v-list-item', 'TypeScript').click()
    cy.contains('.v-list-item', 'Zod Schema', { timeout: 10000 }).click()
    cy.contains('Properties').should('be.visible')
    getColumnDividers().should('have.length', 2)
    getColumnDividers().each(($divider) => {
      expect(getComputedStyle($divider[0]).cursor).to.equal('col-resize')
    })
  })

  it('selects a template via the sidebar and adds it to the URL', () => {
    cy.contains('.v-list-item', 'TypeScript').click()
    cy.contains('.v-list-item', 'Zod Schema', { timeout: 10000 }).click()
    cy.location('search').should('include', 'template=')
  })
})
