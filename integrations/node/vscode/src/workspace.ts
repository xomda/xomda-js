import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { MODEL_FILE, XOMDA_DIR } from '@xomda/core'

export interface XomdaProject {
  root: string
  xomdaDir: string
  modelPath: string
}

export function findXomdaProject(workspaceRoot: string): XomdaProject | undefined {
  const xomdaDir = join(workspaceRoot, XOMDA_DIR)
  const modelPath = join(xomdaDir, MODEL_FILE)
  if (!existsSync(modelPath)) return undefined
  return { root: workspaceRoot, xomdaDir, modelPath }
}

export function findXomdaProjects(workspaceRoots: readonly string[]): XomdaProject[] {
  return workspaceRoots
    .map((root) => findXomdaProject(root))
    .filter((p): p is XomdaProject => p !== undefined)
}
