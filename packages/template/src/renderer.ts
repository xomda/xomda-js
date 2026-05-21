import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { Model, ModelDiff, Template, TemplateCell } from '@xomda/core'
import { getAllEntities, getAllEnums, getAllPackages } from '@xomda/core'

import { executeTemplate } from './engine'
import type { ProjectInfo } from './processors/types'
import type { RenderResult } from './types'

function hasTopLevelLoop(cells: TemplateCell[]): boolean {
  return cells.some((c) => c.type === 'loop' || c.type === 'loop-logic')
}

/**
 * Optional workspace lens for a render. When supplied, `models` and
 * `projects` loop sources resolve against these; otherwise they fall back
 * to a singleton ([model] or [<synthetic project>]) so a workspace-scope
 * loop in a single-model project still iterates exactly once.
 */
export interface RenderWorkspace {
  allModels?: Model[]
  allProjects?: ProjectInfo[]
}

export async function renderTemplateByScope(
  template: Template,
  model: Model,
  diff?: ModelDiff,
  workspace?: RenderWorkspace
): Promise<RenderResult[]> {
  // Loop cells handle iteration inside the engine. If the template has a
  // top-level loop, run once — the engine recurses.
  if (hasTopLevelLoop(template.cells)) {
    return (await executeTemplate(template, model, {}, diff, workspace)).files
  }

  // Fallback to legacy template.scope (pre-loop templates).
  if (template.scope === 'Entity') {
    const results = await Promise.all(
      getAllEntities(model).map((entity) =>
        executeTemplate(template, model, { entity, ...entity }, diff, workspace)
      )
    )
    return results.flatMap((r) => r.files)
  }

  if (template.scope === 'Enum') {
    const results = await Promise.all(
      getAllEnums(model).map((en) =>
        executeTemplate(template, model, { enum: en, ...en }, diff, workspace)
      )
    )
    return results.flatMap((r) => r.files)
  }

  if (template.scope === 'Package') {
    const results = await Promise.all(
      getAllPackages(model).map((pkg) =>
        executeTemplate(template, model, { package: pkg, ...pkg }, diff, workspace)
      )
    )
    return results.flatMap((r) => r.files)
  }

  return (await executeTemplate(template, model, {}, diff, workspace)).files
}

export interface WriteRenderResultsOptions {
  /** Project/output root used when no resolver is supplied. */
  root?: string
  /**
   * Optional hook letting the caller redirect or reject any write —
   * typically wraps @xomda/model's resolveWriteTarget so writes that
   * would land outside the project root are sandboxed under tmpdir.
   * Receives the absolute candidate path; returns the path to actually
   * write to. Throw to reject.
   */
  resolveTarget?: (candidatePath: string, outputPath: string) => string
  /**
   * Notified for every write that landed somewhere other than the
   * candidate path (e.g. remapped to tmpdir). Useful for surfacing a
   * warning to the user.
   */
  onRemap?: (info: { outputPath: string; candidatePath: string; actualPath: string }) => void
}

export async function writeRenderResults(
  results: RenderResult[],
  options: WriteRenderResultsOptions = {}
): Promise<void> {
  const root = options.root ?? process.cwd()
  for (const result of results) {
    const candidatePath = join(root, result.outputPath)
    const actualPath = options.resolveTarget
      ? options.resolveTarget(candidatePath, result.outputPath)
      : candidatePath
    if (actualPath !== candidatePath) {
      options.onRemap?.({ outputPath: result.outputPath, candidatePath, actualPath })
    }
    await mkdir(dirname(actualPath), { recursive: true })
    await writeFile(actualPath, result.content, 'utf-8')
  }
}
