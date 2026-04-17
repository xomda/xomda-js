import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { Entity, Enum, Model, ModelDiff, Package, Template, TemplateCell } from '@xomda/core'

import { executeTemplate } from './engine'
import type { RenderResult } from './types'

function getAllEntities(model: Model): Entity[] {
  const entities: Entity[] = []
  function walk(packages: Package[]): void {
    for (const pkg of packages) {
      entities.push(...(pkg.entities || []))
      walk(pkg.packages || [])
    }
  }
  walk(model.packages || [])
  return entities
}

function getAllEnums(model: Model): Enum[] {
  const enums: Enum[] = []
  function walk(packages: Package[]): void {
    for (const pkg of packages) {
      enums.push(...(pkg.enums || []))
      walk(pkg.packages || [])
    }
  }
  walk(model.packages || [])
  return enums
}

function getAllPackages(model: Model): Package[] {
  const packages: Package[] = []
  function walk(pkgs: Package[]): void {
    for (const pkg of pkgs) {
      packages.push(pkg)
      walk(pkg.packages || [])
    }
  }
  walk(model.packages || [])
  return packages
}

function hasTopLevelLoop(cells: TemplateCell[]): boolean {
  return cells.some((c) => c.type === 'loop' || c.type === 'loop-logic')
}

export async function renderTemplateByScope(
  template: Template,
  model: Model,
  diff?: ModelDiff
): Promise<RenderResult[]> {
  // Loop cells handle iteration inside the engine. If the template has a
  // top-level loop, run once — the engine recurses.
  if (hasTopLevelLoop(template.cells)) {
    return (await executeTemplate(template, model, {}, diff)).files
  }

  // Fallback to legacy template.scope (pre-loop templates).
  if (template.scope === 'Entity') {
    const results = await Promise.all(
      getAllEntities(model).map((entity) =>
        executeTemplate(template, model, { entity, ...entity }, diff)
      )
    )
    return results.flatMap((r) => r.files)
  }

  if (template.scope === 'Enum') {
    const results = await Promise.all(
      getAllEnums(model).map((en) => executeTemplate(template, model, { enum: en, ...en }, diff))
    )
    return results.flatMap((r) => r.files)
  }

  if (template.scope === 'Package') {
    const results = await Promise.all(
      getAllPackages(model).map((pkg) =>
        executeTemplate(template, model, { package: pkg, ...pkg }, diff)
      )
    )
    return results.flatMap((r) => r.files)
  }

  return (await executeTemplate(template, model, {}, diff)).files
}

export async function writeRenderResults(
  results: RenderResult[],
  root = process.cwd()
): Promise<void> {
  for (const result of results) {
    const fullPath = join(root, result.outputPath)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, result.content, 'utf-8')
  }
}
