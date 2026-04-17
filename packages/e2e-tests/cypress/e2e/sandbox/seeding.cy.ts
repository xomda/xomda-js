// Smoke-tests the Node-side sandbox seeding helpers. Each case resets the
// sandbox, runs one helper, then drives the SPA against the new content to
// prove the seed reaches the running server's file system.

describe('Sandbox – seeding helpers', () => {
  beforeEach(() => {
    cy.sandboxReset()
  })

  it('sandboxReset gives every spec the same default seed', () => {
    // After a reset the worktree's .xomda model.json is back in place — the
    // file browser should find it.
    cy.visitFiles('.xomda', 'model.json')
    cy.get('main').should('contain.text', '.xomda/model.json')
  })

  it('sandboxAddMarkdown writes a file the browser can preview', () => {
    cy.sandboxAddMarkdown({
      path: 'docs/preview.md',
      content: '# Preview probe\n\nbody content',
    })

    cy.visitFiles('docs', 'preview.md')
    cy.location('search').should('include', 'file=preview.md')
    cy.get('main').should('contain.text', 'docs/preview.md')
  })

  it('sandboxAddPackage adds a workspace package visible in /files', () => {
    cy.sandboxAddPackage({ name: 'probe' })

    cy.visitFiles('packages/probe', 'package.json')
    cy.location('pathname').should('eq', '/files/packages/probe')
    cy.get('main').should('contain.text', '@sandbox/probe')
  })

  it('sandboxAddMavenProject drops a pom.xml the browser can preview', () => {
    cy.sandboxAddMavenProject({ name: 'extra-maven' })

    cy.visitFiles('extra-maven', 'pom.xml')
    cy.location('pathname').should('eq', '/files/extra-maven')
    cy.get('main').should('contain.text', 'extra-maven/pom.xml')
  })

  it('sandboxAddTemplate drops a template under .xomda/templates', () => {
    cy.sandboxAddTemplate({
      path: 'Custom/probe',
      template: {
        uuid: '00000000-0000-4000-8000-000000000099',
        name: 'Probe',
        version: '1.0.0',
        cells: [],
      },
    })

    cy.visitFiles('.xomda/templates/Custom', 'probe.template.json')
    cy.get('main').should('contain.text', 'probe.template.json')
  })
})
