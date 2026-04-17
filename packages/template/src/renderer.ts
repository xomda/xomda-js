import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { Model, ModelDiff, Template } from '@xomda/core'

import { executeTemplate } from './engine'
import type { ProjectInfo } from './processors/types'
import type { RenderResult } from './types'

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

export async function renderTemplate(
  template: Template,
  model: Model,
  diff?: ModelDiff,
  workspace?: RenderWorkspace
): Promise<RenderResult[]> {
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
