import type { Template } from '@xomda/template'

/**
 * A template wizard is the factory that produces a starting `Template`
 * for one stack (blank, Spring Boot, Quarkus, Lombok, JPA, Zod, ...).
 * Adding a wizard = create a file in `packages/client/src/templateWizards/`
 * that calls `registerTemplateWizard(...)` at module top-level + one
 * import line in `registerAll.ts`.
 *
 * The shape is intentionally minimal: only the metadata the picker UI
 * needs + a `create` factory. Heavier wizards that show a multi-step
 * dialog (Spring Boot with project name / package prefix / Lombok yes-no)
 * can replace `create` with a wizard component later — keep the contract
 * additive.
 */
export interface TemplateWizard {
  id: string
  label: string
  description?: string
  /** Material symbol path string (string) — same convention as nav icons. */
  icon?: string
  /**
   * Produce the initial `Template`. Called once when the user picks
   * this wizard from the picker. `folder` is the current TemplatesView
   * folder (empty string for the root).
   */
  create(folder?: string): Template
}
