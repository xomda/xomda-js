import { realpathSync } from 'node:fs'

import type { Attribute, Entity, Enum, Model, Package, ProjectFile } from '@xomda/core'

import { listModels } from '../storage/file-storage'
import { readProjectMeta } from '../storage/file-storage'
import { resolveParentProject } from './security'

/**
 * Index entry — what a UUID resolves to inside a project graph. Carries
 * enough back-references (node, model, package) that callers can apply
 * visibility, package-chain, and project-boundary checks without re-walking.
 */
export type IndexEntry =
  | { kind: 'entity'; node: ProjectNode; model: Model; package?: Package; value: Entity }
  | { kind: 'enum'; node: ProjectNode; model: Model; package?: Package; value: Enum }
  | { kind: 'package'; node: ProjectNode; model: Model; package?: Package; value: Package }
  | { kind: 'attribute'; node: ProjectNode; model: Model; package?: Package; value: Attribute }
  | { kind: 'model'; node: ProjectNode; model: Model; value: Model }

/**
 * One project in the graph — its absolute root path, parsed project.json,
 * loaded models, and a per-project id index. Multiple ProjectNodes form
 * a chain (`parent`) when `parentProject` is set.
 */
export interface ProjectNode {
  absPath: string
  project: ProjectFile
  models: Model[]
  parent?: ProjectNode
  /**
   * UUID → IndexEntry for this project's models only. The graph-wide
   * `ProjectGraph.idIndex` merges these across the chain (later-loaded
   * projects win on collision, with a warning).
   */
  idIndex: Map<string, IndexEntry>
  /**
   * packageId → parentPackageId (or null when the package is a top-level
   * model child). Built once per indexed model so visibility-resolution
   * package-chain walks are O(depth) instead of O(model size).
   */
  packageParent: Map<string, string | null>
}

/**
 * The whole graph rooted at one project — the entry point plus its parent
 * chain. Constructed per-request (per tRPC call); not cached process-wide
 * so file edits propagate immediately and invalidation stays simple.
 */
export interface ProjectGraph {
  /** The project the caller asked for (the entry point). */
  root: ProjectNode
  /** Every visited project's absolute path — also used for cycle detection. */
  visited: Set<string>
  /**
   * Merged UUID → IndexEntry across every project in the chain. On collision
   * (two projects use the same UUID) the later visit wins and a warning is
   * accumulated under `warnings`. Cross-project UUID collisions are
   * legitimate-but-confusing, so we surface them rather than silently
   * shadowing.
   */
  idIndex: Map<string, IndexEntry>
  /**
   * Non-fatal observations from graph construction: cycles broken, UUID
   * collisions, security rejections. Surface to the user via
   * `useNotificationsStore` rather than blocking the request.
   */
  warnings: ProjectGraphWarning[]
}

export type ProjectGraphWarning =
  | { kind: 'cycle'; absPath: string }
  | { kind: 'id-collision'; id: string; firstNode: string; secondNode: string }
  | {
      kind: 'parent-rejected'
      childAbsPath: string
      parentPath: string
      reason: 'escapes-project-root' | 'not-a-xomda-project' | 'parse-failed'
    }

export interface LoadProjectGraphOptions {
  /**
   * Maximum number of parents to walk before stopping. Defaults to 32 — a
   * sane ceiling that catches accidental infinite chains while leaving room
   * for legitimate workspace hierarchies.
   */
  maxDepth?: number
}

const DEFAULT_MAX_DEPTH = 32

/**
 * Load a project graph rooted at `rootAbsPath`. Walks `parentProject`
 * iteratively, builds a per-project id index, and a merged graph index.
 *
 * Cycle detection: a project that has already been visited (by realpath) is
 * skipped and reported as a warning. The loader never throws on a bad
 * parent — it reports the reason and continues with what it has.
 */
export async function loadProjectGraph(
  rootAbsPath: string,
  options: LoadProjectGraphOptions = {}
): Promise<ProjectGraph> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const visited = new Set<string>()
  const warnings: ProjectGraphWarning[] = []
  const idIndex = new Map<string, IndexEntry>()

  const root = await loadProjectNode(rootAbsPath, visited, warnings, idIndex)

  // Walk the parent chain breadth-first (linear since each project has at
  // most one parent). Stop on first error / cycle / depth cap.
  let current = root
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const parentRelative = current.project.parentProject
    if (!parentRelative) break

    const guard = resolveParentProject(current.absPath, parentRelative, {
      restrictReadsToProjectRoot: current.project.settings.restrictReadsToProjectRoot ?? true,
    })
    if (!guard.ok) {
      warnings.push({
        kind: 'parent-rejected',
        childAbsPath: current.absPath,
        parentPath: guard.resolved ?? parentRelative,
        reason: guard.reason,
      })
      break
    }
    if (visited.has(guard.absPath)) {
      warnings.push({ kind: 'cycle', absPath: guard.absPath })
      break
    }

    try {
      const parent = await loadProjectNode(guard.absPath, visited, warnings, idIndex)
      current.parent = parent
      current = parent
    } catch (e) {
      warnings.push({
        kind: 'parent-rejected',
        childAbsPath: current.absPath,
        parentPath: guard.absPath,
        reason: 'parse-failed',
      })
      // Annotate to satisfy the linter — the error itself is captured by the
      // warning; we don't surface stack traces through the graph.
      void e
      break
    }
  }

  return { root, visited, idIndex, warnings }
}

async function loadProjectNode(
  absPath: string,
  visited: Set<string>,
  warnings: ProjectGraphWarning[],
  graphIndex: Map<string, IndexEntry>
): Promise<ProjectNode> {
  const canonical = (() => {
    try {
      return realpathSync(absPath)
    } catch {
      return absPath
    }
  })()

  visited.add(canonical)

  const projectMeta = await readProjectMeta(canonical)
  // ProjectFile is optional on disk; synthesise a minimal default so the
  // graph build doesn't fail just because the user hasn't created the file
  // yet. `parentProject` will be undefined either way.
  const project: ProjectFile = projectMeta ?? {
    name: canonical,
    versions: { head: null, versions: [] },
    settings: {
      restrictWritesToProjectRoot: true,
      restrictReadsToProjectRoot: true,
      isRoot: false,
      excludeFromScan: [],
      diagramMaxEntityAttributes: 10,
      diagramMaxEnumValues: 10,
    },
    plugins: [],
  }

  const models = await listModels(canonical)
  const node: ProjectNode = {
    absPath: canonical,
    project,
    models,
    idIndex: new Map(),
    packageParent: new Map(),
  }

  for (const model of models) indexModel(node, model, graphIndex, warnings)

  return node
}

function indexModel(
  node: ProjectNode,
  model: Model,
  graphIndex: Map<string, IndexEntry>,
  warnings: ProjectGraphWarning[]
): void {
  const record = (entry: IndexEntry): void => {
    node.idIndex.set(getEntryId(entry), entry)
    const id = getEntryId(entry)
    const prior = graphIndex.get(id)
    if (prior && prior.node.absPath !== node.absPath) {
      warnings.push({
        kind: 'id-collision',
        id,
        firstNode: prior.node.absPath,
        secondNode: node.absPath,
      })
    }
    graphIndex.set(id, entry)
  }

  record({ kind: 'model', node, model, value: model })
  walkPackages(model.packages, undefined, (pkg, parent) => {
    node.packageParent.set(pkg.id, parent?.id ?? null)
    record({ kind: 'package', node, model, package: parent, value: pkg })
    for (const ent of pkg.entities) {
      record({ kind: 'entity', node, model, package: pkg, value: ent })
      for (const attr of ent.attributes) {
        record({ kind: 'attribute', node, model, package: pkg, value: attr })
      }
    }
    for (const en of pkg.enums) {
      record({ kind: 'enum', node, model, package: pkg, value: en })
    }
  })
}

function getEntryId(entry: IndexEntry): string {
  return entry.value.id
}

function walkPackages(
  pkgs: readonly Package[],
  parent: Package | undefined,
  visit: (pkg: Package, parent: Package | undefined) => void
): void {
  for (const pkg of pkgs) {
    visit(pkg, parent)
    walkPackages(pkg.packages, pkg, visit)
  }
}
