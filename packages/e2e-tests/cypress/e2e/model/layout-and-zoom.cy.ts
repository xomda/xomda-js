// Diagram interactions that *persist* state across reloads:
//   - Dragging a package and saving the layout.
//   - Zoom level surviving reloads and inter-view navigation.
//
// Kept separate from model/panels.cy.ts so a failure in one flow can't
// leave a half-saved layout that breaks the other tests.

const ROOT_PACKAGE_ID = '4942822f-1f51-4301-8b64-af446c6c017e'

const getPackageRect = (id: string) =>
  cy.get(`[data-package-id="${id}"]`).then(($el) => $el[0].getBoundingClientRect())

const packageDragHandle = (id: string) => `[data-package-id="${id}"] > div:first-child span`

describe('Model – layout', () => {
  it('saves a drag and restores the original package position', () => {
    cy.visitModel()

    let originalRect!: DOMRect
    let movedRect!: DOMRect

    getPackageRect(ROOT_PACKAGE_ID).then((rect) => {
      originalRect = rect
    })

    // Drag the root package and confirm the unsaved-layout toolbar appears.
    cy.dragBy(packageDragHandle(ROOT_PACKAGE_ID), 80, 40)
    cy.get('[aria-label="Save layout"]').should('be.visible')
    cy.get('[aria-label="Cancel layout changes"]').should('be.visible')

    getPackageRect(ROOT_PACKAGE_ID).then((rect) => {
      movedRect = rect
      expect(Math.abs(rect.left - originalRect.left)).to.be.greaterThan(20)
      expect(Math.abs(rect.top - originalRect.top)).to.be.greaterThan(10)
    })

    // Save and reload — the moved position should persist.
    cy.get('[aria-label="Save layout"]').click()
    cy.reload()
    cy.location('pathname').should('eq', '/model')

    getPackageRect(ROOT_PACKAGE_ID).then((rect) => {
      expect(rect.left).to.be.closeTo(movedRect.left, 12)
      expect(rect.top).to.be.closeTo(movedRect.top, 12)

      // Drag back to the original spot so subsequent runs start from a
      // clean baseline.
      const restoreDx = originalRect.left - rect.left
      const restoreDy = originalRect.top - rect.top
      cy.dragBy(packageDragHandle(ROOT_PACKAGE_ID), restoreDx, restoreDy)
    })

    cy.get('[aria-label="Save layout"]').click()
    cy.reload()

    getPackageRect(ROOT_PACKAGE_ID).then((rect) => {
      expect(rect.left).to.be.closeTo(originalRect.left, 12)
      expect(rect.top).to.be.closeTo(originalRect.top, 12)
    })
  })
})

describe('Model – zoom', () => {
  it('persists zoom across reloads and navigation before resetting to 100%', () => {
    cy.visitModel()

    cy.setDiagramZoom(0.85)
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').should('contain.text', '85%')

    cy.reload()
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').should('contain.text', '85%')

    // The Zoom in/out buttons sit inside `.zoomExpanded`, which has
    // `pointer-events: none` until `.zoomControls` is hovered/focused.
    // `force` skips that gate; the underlying handler still fires.
    // `zoomIn` snaps to the next 10% multiple in the direction of motion
    // (documented in useCanvasZoom.ts) — from 85% the next press lands on
    // 90%, not 95%, because 85% isn't on a 10% mark.
    cy.get('button[title="Zoom in"]').click({ force: true })
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').should('contain.text', '90%')

    // Navigating away and back doesn't reset zoom.
    cy.get('button[aria-label="Templates"]').click()
    cy.location('pathname').should('eq', '/templates')
    cy.get('button[aria-label="Versions"]').click()
    cy.location('pathname').should('eq', '/versions')
    cy.get('button[aria-label="Model"]').click()
    cy.location('pathname').should('eq', '/model')
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').should('contain.text', '90%')

    // Reset button restores 100% and that, too, persists across reload.
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').click()
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').should('contain.text', '100%')

    cy.reload()
    cy.get('button[title="Reset view (zoom 100%, recenter)"]').should('contain.text', '100%')
  })
})
