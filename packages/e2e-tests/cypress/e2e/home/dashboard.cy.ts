// Home dashboard: hero card, project path, project facets, and the
// Node.js dependency table.

describe('Home – dashboard', () => {
  beforeEach(() => {
    cy.visitHome()
  })

  it('shows the dashboard content and Node.js dependency details', () => {
    cy.get('h1').should('contain.text', 'xΟΔ')
    // The hero shows the absolute path the node server treats as cwd, which
    // is the sandbox under packages/e2e-tests/target/sandbox. The leading
    // portion differs per host (CI runner vs dev machine), so match by
    // suffix instead of hardcoding a user-specific prefix.
    cy.contains('p', /packages[\\/]e2e-tests[\\/]target[\\/]sandbox$/).should('be.visible')
    cy.get('main')
      .should('contain.text', 'Projects')
      .and('contain.text', 'Model')
      .and('contain.text', 'Templates')
      .and('contain.text', 'Files')
      .and('contain.text', 'Versions')

    cy.contains('button[role="tab"]', 'Node.js').click()
    cy.get('main').should('contain.text', 'Node.js').and('contain.text', 'Dev dependencies')
    cy.contains('table tbody tr', '@eslint/js').should('contain.text', '10.0.1')
  })

  it('vertically centers plugin icons inside summary chips', () => {
    // Regression: chip-prepend span used plain `display: inline`, which
    // dropped the inline-flex SvgIcon onto the text baseline so brand
    // glyphs sat noticeably below the label. The vertical-midline check
    // below is the real guard — which specific plugin chip happens to
    // be visible depends on whether it's classified as a project-kind
    // vs a feature (the former is stripped from the chip row).
    cy.get('.v-chip:has(.v-chip__prepend > span)')
      .first()
      .within(() => {
        cy.get('.v-chip__prepend > span').then(($wrap) => {
          const wrap = $wrap[0].getBoundingClientRect()
          const chip = $wrap.closest('.v-chip')[0].getBoundingClientRect()
          const wrapMid = wrap.top + wrap.height / 2
          const chipMid = chip.top + chip.height / 2
          expect(Math.abs(wrapMid - chipMid)).to.be.lessThan(2)
        })
      })
  })
})
