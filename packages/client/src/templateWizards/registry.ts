import type { TemplateWizard } from './types'

/**
 * Module-scoped wizard list. Mirrors the analysis-plugin / module
 * registry pattern (side-effect imports register each wizard at boot).
 */
const wizards: TemplateWizard[] = []

export function registerTemplateWizard(wizard: TemplateWizard): void {
  if (wizards.some((w) => w.id === wizard.id)) return
  wizards.push(wizard)
}

export function getRegisteredTemplateWizards(): readonly TemplateWizard[] {
  return wizards
}

export function getTemplateWizard(id: string): TemplateWizard | undefined {
  return wizards.find((w) => w.id === id)
}

/** Test-only — drop every registration so each spec starts clean. */
export function resetTemplateWizardRegistry(): void {
  wizards.length = 0
}
