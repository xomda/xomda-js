/// <reference types="cypress" />

// Cypress custom commands for the xomda SPA.
//
// Conventions used here:
//  - Every `visit*` helper resets `xomda-config` in localStorage before load,
//    so each spec starts from a clean UI state regardless of prior runs.
//  - Helpers that wrap a "click a button, then pick from the menu/dialog
//    that appears" pattern live here to keep specs focused on what they
//    verify rather than how the UI is wired together.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      // Navigation
      visitHome(): Chainable<void>
      visitTemplates(): Chainable<void>
      visitModel(selectId?: string): Chainable<void>
      visitSettings(hash?: string): Chainable<void>
      visitFiles(path?: string, fileName?: string): Chainable<void>

      // Dialogs
      confirmDialog(label?: string): Chainable<void>
      dismissDialog(title?: string): Chainable<void>

      // Templates
      createNewTemplate(): Chainable<void>
      deleteSelectedTemplate(): Chainable<void>
      addCellOfType(type: string, options?: { below?: boolean }): Chainable<void>
      configureLoopCell(loopOver: string, itemName: string): Chainable<void>
      cleanupTemplatesByName(name?: string): Chainable<void>
      cleanupTemplateFoldersByName(name: string): Chainable<void>
      openTemplateBrowserActions(name: string): Chainable<void>

      // Pointer / drag
      dragNavSeparator(deltaX: number): Chainable<void>
      dragBy(selector: string, deltaX: number, deltaY: number): Chainable<void>

      // Menus / diagram
      chooseMenuAction(triggerLabel: string, actionLabel: string): Chainable<void>
      setDiagramZoom(value: number): Chainable<void>

      // Sandbox seeding (Node-side; delegates to packages/e2e-tests/sandbox)
      sandboxReset(): Chainable<void>
      sandboxAddPackage(opts: SandboxAddPackageOptions): Chainable<void>
      sandboxAddMavenProject(opts: SandboxAddMavenProjectOptions): Chainable<void>
      sandboxAddMarkdown(opts: SandboxAddMarkdownOptions): Chainable<void>
      sandboxAddTemplate(opts: SandboxAddTemplateOptions): Chainable<void>
    }
  }
}

export interface SandboxAddPackageOptions {
  name: string
  dependency?: { name: string; version: string }
}
export interface SandboxAddMavenProjectOptions {
  name: string
}
export interface SandboxAddMarkdownOptions {
  path: string
  content?: string
}
export interface SandboxAddTemplateOptions {
  path: string
  template: unknown
}

// ---------------------------------------------------------------------------
// Internal helpers (not exposed on `cy.*`)
// ---------------------------------------------------------------------------

const resetStoredUiState = (win: Window) => {
  win.localStorage.removeItem('xomda-config')
}

const visitAppRoute = (path: string) => {
  cy.visit(path, {
    onBeforeLoad(win) {
      resetStoredUiState(win)
    },
  })
}

// The Vuetify overlay container hosts multiple stacked menus during a flow.
// We always interact with the topmost visible one.
const getVisibleMenu = () => cy.get('.xomda-menu').filter(':visible').last()

const getVisibleDialog = () => cy.get('.v-overlay.v-dialog').filter(':visible')

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

Cypress.Commands.add('visitHome', () => {
  visitAppRoute('/')
  cy.location('pathname').should('eq', '/')
})

Cypress.Commands.add('visitTemplates', () => {
  visitAppRoute('/templates')
  cy.location('pathname').should('eq', '/templates')
})

// `select` is a one-shot query param: ModelView applies it on load and then
// `router.replace`s it out so re-clicking the same hit re-fires. That means
// we can't assert it persists in `location.search` after navigation — only
// that the resulting selection rendered (the caller's responsibility).
Cypress.Commands.add('visitModel', (selectId?: string) => {
  const search = selectId ? `?select=${encodeURIComponent(selectId)}` : ''
  visitAppRoute(`/model${search}`)
  cy.location('pathname').should('eq', '/model')
})

Cypress.Commands.add('visitSettings', (hash?: string) => {
  const suffix = hash ? `#${hash.replace(/^#/, '')}` : ''
  visitAppRoute(`/settings${suffix}`)
  cy.location('pathname').should('eq', '/settings')
  if (hash) {
    cy.location('hash').should('eq', `#${hash.replace(/^#/, '')}`)
  }
})

Cypress.Commands.add('visitFiles', (path?: string, fileName?: string) => {
  const normalizedPath = path && path !== '.' ? `/${path.replace(/^\//, '')}` : ''
  const query = fileName ? `?file=${encodeURIComponent(fileName)}` : ''
  visitAppRoute(`/files${normalizedPath}${query}`)
  cy.location('pathname').should('match', /^\/files/)
  if (fileName) {
    cy.location('search').should('include', `file=${encodeURIComponent(fileName)}`)
  }
})

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

// Click the confirmation button (default: "Delete") and wait for the dialog
// to disappear. Use after destructive actions.
Cypress.Commands.add('confirmDialog', (label: string = 'Delete') => {
  getVisibleDialog().within(() => {
    cy.contains('button', label).click()
  })
  cy.get('.v-overlay.v-dialog').should('not.exist')
})

// Cancel an open confirmation dialog. Optionally assert the dialog title to
// guard against the wrong dialog being open.
Cypress.Commands.add('dismissDialog', (title?: string) => {
  getVisibleDialog().within(() => {
    if (title) cy.contains(title).should('be.visible')
    cy.contains('button', 'Cancel').click()
  })
  cy.get('.v-overlay.v-dialog').should('not.exist')
})

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

// Clicks the toolbar "New template" button and waits for the template query
// param to appear in the URL.
Cypress.Commands.add('createNewTemplate', () => {
  cy.contains('button', 'New template').click()
  cy.location('search').should('include', 'template=')
})

// Deletes the currently selected template via the toolbar Delete button.
Cypress.Commands.add('deleteSelectedTemplate', () => {
  cy.get('button[aria-label="Delete template"]').click()
  cy.confirmDialog('Delete')
})

// Inserts a new cell of the given type. With `{ below: true }`, uses the
// per-cell "Add cell below" button instead of the empty-state "Add cell".
Cypress.Commands.add('addCellOfType', (type: string, options: { below?: boolean } = {}) => {
  const label = options.below ? 'Add cell below' : 'Add cell'
  cy.chooseMenuAction(label, type)
})

// Fills in the Loop-cell "Loop over" selector and the item-name input on the
// currently visible cell editor.
Cypress.Commands.add('configureLoopCell', (loopOver: string, itemName: string) => {
  cy.contains('label', 'Loop over').closest('.v-input').find('.v-field').click()
  cy.contains('.v-list-item', loopOver).click()
  cy.get('input[placeholder="item"]').clear().type(itemName)
})

// Removes any leftover templates with the given name (default: "New Template")
// by visiting the templates view and clicking the toolbar Delete on each
// match. Recurses until no matches remain.
Cypress.Commands.add('cleanupTemplatesByName', (name: string = 'New Template') => {
  cy.visitTemplates()
  cy.get('body').then(($body) => {
    const matches = $body.find(`.v-list-item:contains("${name}")`)
    if (!matches.length) return
    cy.wrap(matches.first()).click()
    cy.get('button[aria-label="Delete template"]').should('be.visible').click()
    cy.confirmDialog('Delete')
    cy.cleanupTemplatesByName(name)
  })
})

// Removes any leftover folders with the given name from the templates browser.
Cypress.Commands.add('cleanupTemplateFoldersByName', (name: string) => {
  cy.visitTemplates()
  cy.get('body').then(($body) => {
    const matches = $body.find('.v-list-item').filter((_, el) => el.textContent?.includes(name))
    if (!matches.length) return
    cy.wrap(matches.first()).within(() => {
      cy.get('button[aria-label="More actions"]').click()
    })
    getVisibleMenu().contains('.xomda-menu-item', 'Delete').click()
    cy.confirmDialog('Delete')
    cy.cleanupTemplateFoldersByName(name)
  })
})

// Opens the row-level action menu for the given template-browser item.
Cypress.Commands.add('openTemplateBrowserActions', (name: string) => {
  cy.get('main .v-list')
    .first()
    .contains('.v-list-item', name)
    .scrollIntoView()
    .should('be.visible')
    .within(() => {
      cy.get('button[aria-label="More actions"]').click()
    })
})

// ---------------------------------------------------------------------------
// Pointer / drag
// ---------------------------------------------------------------------------

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

// Simulates a pointer drag on the given element, useful for diagram items.
// Emits an intermediate pointermove at the midpoint so HTML5 drag-and-drop
// listeners that expect motion (rather than a single jump) still fire.
Cypress.Commands.add('dragBy', (selector: string, deltaX: number, deltaY: number) => {
  cy.get(selector)
    .first()
    .should('be.visible')
    .then(($el) => {
      const rect = ($el[0] as HTMLElement).getBoundingClientRect()
      const startX = rect.left + rect.width / 2
      const startY = rect.top + rect.height / 2
      const endX = startX + deltaX
      const endY = startY + deltaY

      cy.wrap($el)
        .trigger('pointerdown', {
          button: 0,
          clientX: startX,
          clientY: startY,
          pointerId: 1,
          force: true,
        })
        .trigger('pointermove', {
          clientX: startX + deltaX / 2,
          clientY: startY + deltaY / 2,
          pointerId: 1,
          force: true,
        })
        .trigger('pointermove', { clientX: endX, clientY: endY, pointerId: 1, force: true })
        .trigger('pointerup', { clientX: endX, clientY: endY, pointerId: 1, force: true })
    })
})

// ---------------------------------------------------------------------------
// Menus / diagram
// ---------------------------------------------------------------------------

// Opens a visible menu button, clicks the requested item, and waits for the
// menu's overlay scrim to disappear before returning. Vuetify menus close
// with a transition; without the wait, the next interaction can race the
// scrim and click on what looks like a covered element.
Cypress.Commands.add('chooseMenuAction', (triggerLabel: string, actionLabel: string) => {
  cy.get(`button[aria-label="${triggerLabel}"]`).should('be.visible').click()
  getVisibleMenu().contains('.xomda-menu-item', actionLabel).click()
  // The menu's overlay (which carries the scrim) tears down after the
  // close transition. Wait it out so subsequent .click() calls aren't
  // blocked by a still-present scrim.
  cy.get('.xomda-menu').should('not.exist')
  cy.get('.v-overlay__scrim').should('not.exist')
})

// Updates the diagram zoom slider to the requested decimal zoom value.
// The slider lives inside a hover-revealed control (opacity:0 until the
// .zoomControls container is hovered/focused), so we don't assert `be.visible`
// and use `force` on the events — we only need the underlying input's value
// + `input` listener to fire.
//
// The slider is clamped client-side to [0.25, 2] — mirror that here so the
// caller's "set zoom to X" intent translates to a value the input accepts.
Cypress.Commands.add('setDiagramZoom', (value: number) => {
  const clamped = Math.min(2, Math.max(0.25, value))
  cy.get('input[title="Zoom"]')
    .invoke('val', clamped)
    .trigger('input', { force: true })
    .trigger('change', { force: true })
})

// ---------------------------------------------------------------------------
// Sandbox seeding
// ---------------------------------------------------------------------------
// Each helper is a thin wrapper around a Node-side `sandbox:*` task. The
// task layer (cypress/plugins/sandbox-tasks.ts) calls the same primitives
// the `setup:sandbox` script uses, so per-spec seeding stays consistent
// with the default seed.

Cypress.Commands.add('sandboxReset', () => {
  cy.task('sandbox:reset', null, { log: true })
})

Cypress.Commands.add('sandboxAddPackage', (opts: SandboxAddPackageOptions) => {
  cy.task('sandbox:addPackage', opts, { log: true })
})

Cypress.Commands.add('sandboxAddMavenProject', (opts: SandboxAddMavenProjectOptions) => {
  cy.task('sandbox:addMavenProject', opts, { log: true })
})

Cypress.Commands.add('sandboxAddMarkdown', (opts: SandboxAddMarkdownOptions) => {
  cy.task('sandbox:addMarkdown', opts, { log: true })
})

Cypress.Commands.add('sandboxAddTemplate', (opts: SandboxAddTemplateOptions) => {
  cy.task('sandbox:addTemplate', opts, { log: true })
})

export {}
