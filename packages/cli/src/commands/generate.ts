import { join, resolve } from 'node:path'

import { readModel } from '@xomda/model/storage'
import type { RenderResult } from '@xomda/template'
import { listTemplates, renderTemplateByScope, writeRenderResults } from '@xomda/template'

import { relativeFromWorkspace, walkSubprojects } from '../workspace-walk'

export interface GenerateOptions {
  /** Directory (relative to root) to write generated files into. Defaults to root. */
  outputDir?: string
  /**
   * When true, recurse into every `.xomda/` subproject under `root`,
   * stopping at `settings.isRoot: true` boundaries. Subprojects marked
   * `isRoot` are still listed (their independence is logged) but their
   * own descendants are NOT walked — they are independent workspaces.
   */
  recursive?: boolean
}

export interface GenerateResult {
  /** Absolute project root the result is for. */
  root: string
  /** The render results emitted for that project. */
  results: RenderResult[]
  /** Subprojects whose `isRoot` boundary cut the walk short here. Empty unless `recursive`. */
  skippedRoots?: Array<{ path: string; name: string }>
}

/**
 * Generate code for a single project. Backwards-compatible API: callers
 * that don't pass `recursive` see the original single-project behaviour
 * and return shape (array of RenderResult — see `generate`).
 *
 * @returns the list of files emitted under `root`.
 */
export async function generate(
  root: string,
  options: GenerateOptions = {}
): Promise<RenderResult[]> {
  if (options.recursive) {
    const all = await generateRecursive(root, options)
    return all.flatMap((r) => r.results)
  }
  return generateOne(root, options)
}

async function generateOne(root: string, options: GenerateOptions = {}): Promise<RenderResult[]> {
  const model = await readModel(root)
  const templates = (await listTemplates(root)).filter((t) => !t.disabled)

  const allResults: RenderResult[] = []
  for (const template of templates) {
    const results = await renderTemplateByScope(template, model)
    allResults.push(...results)
  }

  const writeRoot = options.outputDir ? join(root, options.outputDir) : root
  await writeRenderResults(allResults, { root: writeRoot })
  return allResults
}

/**
 * Recursive generation: runs `generate` for `root` then for every
 * non-`isRoot` subproject discovered under it. Each invocation operates
 * relative to its own project root — `outputDir` is interpreted as
 * relative to *that* subproject's root, not the workspace root, so an
 * `outputDir: 'target'` writes into `<subproject>/target/` per project.
 *
 * Returns one `GenerateResult` per project walked, in deterministic
 * (lexical-path) order. The workspace root is always first; the
 * `skippedRoots` field on it lists every `isRoot` boundary that was
 * intentionally not descended.
 *
 * The caller's reporter (CLI / Mojo / tRPC) is responsible for surfacing
 * the per-project summaries; this helper stays silent so it composes.
 */
export async function generateRecursive(
  root: string,
  options: GenerateOptions = {}
): Promise<GenerateResult[]> {
  const absRoot = resolve(root)
  const subs = walkSubprojects(absRoot)
  // The workspace itself plus every non-root subproject. Root-marked
  // subprojects are listed in `skippedRoots` on the workspace entry.
  const targets = [absRoot, ...subs.filter((s) => !s.isRoot).map((s) => s.path)]
  const skippedRoots = subs
    .filter((s) => s.isRoot)
    .map((s) => ({ path: relativeFromWorkspace(absRoot, s.path), name: s.name }))

  const results: GenerateResult[] = []
  for (const projectRoot of targets) {
    const r = await generateOne(projectRoot, { outputDir: options.outputDir })
    results.push({
      root: projectRoot,
      results: r,
      ...(projectRoot === absRoot && skippedRoots.length > 0 ? { skippedRoots } : {}),
    })
  }
  return results
}
