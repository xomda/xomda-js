import { resolve } from 'node:path'

import { readModel } from '@xomda/model/storage'
import type { RenderResult } from '@xomda/template'
import { listTemplates, renderTemplateByScope } from '@xomda/template'

import { relativeFromWorkspace, walkSubprojects } from '../workspace-walk'

export interface PreviewOptions {
  /**
   * When true, render every `.xomda/` subproject under `root` (excluding
   * `isRoot: true` boundaries) and concatenate the results. Mirrors
   * `generate -R` semantics for dry-run previews.
   */
  recursive?: boolean
}

export interface PreviewProjectResult {
  /** Absolute project root the result is for. */
  root: string
  results: RenderResult[]
  skippedRoots?: Array<{ path: string; name: string }>
}

/**
 * Preview the render output for `root`. Returns an array of RenderResult
 * for backwards compatibility; when `recursive: true` the array is the
 * concatenation of every walked project's results. Use `previewRecursive`
 * directly when you need per-project segmentation.
 */
export async function preview(root: string, options: PreviewOptions = {}): Promise<RenderResult[]> {
  if (options.recursive) {
    const all = await previewRecursive(root)
    return all.flatMap((r) => r.results)
  }
  return previewOne(root)
}

async function previewOne(root: string): Promise<RenderResult[]> {
  const model = await readModel(root)
  const templates = (await listTemplates(root)).filter((t) => !t.disabled)
  const allResults: RenderResult[] = []
  for (const template of templates) {
    const results = await renderTemplateByScope(template, model)
    allResults.push(...results)
  }
  return allResults
}

/**
 * Per-project preview. Same walk semantics as `generateRecursive`:
 * stops at `isRoot: true` boundaries (listed in `skippedRoots` on the
 * workspace entry), processes everything else.
 */
export async function previewRecursive(root: string): Promise<PreviewProjectResult[]> {
  const absRoot = resolve(root)
  const subs = walkSubprojects(absRoot)
  const targets = [absRoot, ...subs.filter((s) => !s.isRoot).map((s) => s.path)]
  const skippedRoots = subs
    .filter((s) => s.isRoot)
    .map((s) => ({ path: relativeFromWorkspace(absRoot, s.path), name: s.name }))

  const out: PreviewProjectResult[] = []
  for (const projectRoot of targets) {
    out.push({
      root: projectRoot,
      results: await previewOne(projectRoot),
      ...(projectRoot === absRoot && skippedRoots.length > 0 ? { skippedRoots } : {}),
    })
  }
  return out
}
