// Files browser: deep-linked navigation, view-options menu (hidden/generated,
// list/tree), the file-information side panel, and sort controls.

describe('Files – browser', () => {
  it('navigates the file browser, toggles view options, and keeps the preview open across reloads', () => {
    cy.visitFiles('.devcontainer', 'devcontainer.json')

    cy.location('pathname').should('eq', '/files/.devcontainer')
    cy.location('search').should('include', 'file=devcontainer.json')
    cy.contains('Browse').should('be.visible')
    cy.get('main').should('contain.text', '.devcontainer/devcontainer.json')
    cy.get('.monaco-editor').should('exist')
    cy.get('main').should('contain.text', '.git').and('contain.text', 'generated')
    cy.get('body').then(($body) => {
      expect($body.find('.v-chip').length).to.be.greaterThan(0)
    })

    // Hidden files (e.g. `.git`) disappear when the toggle is off.
    cy.chooseMenuAction('View options', 'Show hidden')
    cy.contains('.v-list-item', '.git').should('not.exist')

    // Generated-file chips disappear when "Show generated" is off.
    cy.chooseMenuAction('View options', 'Show generated')
    cy.get('body').then(($body) => {
      expect($body.find('.v-chip').length).to.equal(0)
    })

    // Re-enable both; original state is restored.
    cy.chooseMenuAction('View options', 'Show generated')
    cy.chooseMenuAction('View options', 'Show hidden')
    cy.get('main').should('contain.text', '.git').and('contain.text', 'generated')
    cy.get('body').then(($body) => {
      expect($body.find('.v-chip').length).to.be.greaterThan(0)
    })

    // List view adds a `..` parent-directory entry; tree view doesn't.
    cy.chooseMenuAction('View options', 'List')
    cy.get('.v-list').first().should('contain.text', '..')

    cy.chooseMenuAction('View options', 'Tree')
    cy.get('.v-list').first().should('not.contain.text', 'Parent directory')

    // Deep-linked file stays selected and rendered across a reload.
    cy.reload()
    cy.location('search').should('include', 'file=devcontainer.json')
    cy.get('main').should('contain.text', '.devcontainer/devcontainer.json')
    cy.get('.monaco-editor').should('exist')
  })

  it('shows file information, toggles permissions, and exposes sort controls', () => {
    cy.visitFiles(undefined, '.npmrc')

    cy.location('pathname').should('eq', '/files')
    cy.location('search').should('include', 'file=.npmrc')
    cy.get('main').should('contain.text', '.npmrc')
    cy.get('.monaco-editor').should('exist')
    cy.contains('File Information').should('be.visible')
    cy.get('[aria-label="Hidden"]').should('be.visible')

    // Permission display toggles between numeric and symbolic forms.
    cy.get('[aria-label="Toggle permission display"]')
      .invoke('text')
      .then((before) => {
        cy.get('[aria-label="Toggle permission display"]').click()
        cy.get('[aria-label="Toggle permission display"]').should(($button) => {
          expect($button.text().trim()).not.to.equal(before.trim())
        })
      })

    // Closing the info panel hides it; the reopen button puts it back.
    cy.get('button[aria-label="Close"]').click()
    cy.get('button[aria-label="Show file information"]').should('be.visible').click()
    cy.contains('File Information').should('be.visible')

    // Sort menu — Sort by → Modified.
    cy.get('button[aria-label="Options"]').click()
    cy.contains('.xomda-menu-item', 'Sort by').as('sortBy')
    cy.get('@sortBy').click({ force: true })
    cy.get('.xomda-menu')
      .filter(':visible')
      .last()
      .within(() => {
        cy.contains('.xomda-menu-item', 'Name').should('exist')
        cy.contains('.xomda-menu-item', 'Modified').should('exist').click()
      })

    cy.get('button[aria-label="Options"]').should('be.visible')
  })
})
