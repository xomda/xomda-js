import type { Template } from '@xomda/template'

import { getRegisteredTemplateWizards, getTemplateWizard } from '../../templateWizards'
import type { OpenTemplateTab } from './useTemplateTabs'

/**
 * Build a starting `Template` using the named wizard, or the first
 * registered wizard if `wizardId` is omitted. Falls back to a hardcoded
 * blank if no wizards are registered (e.g. unit tests that import this
 * module before `registerAll`).
 */
export function newTemplate(folder?: string, wizardId?: string): Template {
  const target =
    (wizardId ? getTemplateWizard(wizardId) : undefined) ?? getRegisteredTemplateWizards()[0]
  if (target) return target.create(folder)
  return {
    uuid: crypto.randomUUID(),
    name: 'New Template',
    version: '1.0.0',
    cells: [],
    ...(folder ? { folder } : {}),
  }
}

/**
 * Build a duplicate of `source` with a fresh UUID and a name that doesn't
 * collide with any sibling. The collision check matters because writeTemplate
 * derives the on-disk filename from the sanitized name when the UUID is new
 * — two siblings with the same name would clobber each other's files.
 */
export function duplicateTemplate(source: Template, siblings: Template[]): Template {
  const taken = new Set(siblings.map((t) => t.name))
  const base = `${source.name} (copy)`
  let name = base
  let n = 2
  while (taken.has(name)) name = `${base} ${n++}`
  return { ...structuredClone(source), uuid: crypto.randomUUID(), name }
}

/**
 * Return the uuids of open tabs whose template lives inside a deleted
 * folder — either directly or in a nested descendant. The path-boundary
 * check (`startsWith(${path}/)`) is what prevents a sibling like
 * `users-extra` from being scooped up when `users` is deleted.
 */
export function findTabsInDeletedFolder(
  tabs: readonly OpenTemplateTab[],
  deletedFolderPath: string
): string[] {
  return tabs
    .filter((t) => {
      const folder = t.buffer.draft.value?.folder ?? ''
      return folder === deletedFolderPath || folder.startsWith(`${deletedFolderPath}/`)
    })
    .map((t) => t.uuid)
}
