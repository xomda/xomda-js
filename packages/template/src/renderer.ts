import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { Entity, Enum, Model, Package, Template } from '@xomda/core'

import { executeTemplate } from './engine'
import { collectProviderItems } from './processors/provider'
import { readTemplate } from './storage'
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

async function resolveInheritance(
  template: Template,
  visited = new Set<string>()
): Promise<Template> {
  if (!template.extends || visited.has(template.uuid)) return template
  visited.add(template.uuid)
  let parent: Template | null
  try {
    parent = await readTemplate(template.extends)
  } catch {
    return template
  }
  if (!parent) return template
  const resolvedParent = await resolveInheritance(parent, visited)
  return { ...template, cells: [...resolvedParent.cells, ...template.cells] }
}

export async function renderTemplateByScope(template: Template, model: Model): Promise<RenderResult[]> {
  const resolved = await resolveInheritance(template)

  // Provider cell takes precedence over template.scope
  const providerCell = resolved.cells.find((c) => c.type === 'provider' || c.type === 'provider-logic')
  if (providerCell) {
    const varName = providerCell.variableName ?? 'item'
    const source = providerCell.type === 'provider-logic' ? 'javascript' : providerCell.providerSource
    const items = await collectProviderItems(source, providerCell.content, model)
    const results = await Promise.all(
      items.map((item) =>
        executeTemplate(resolved, model, { [varName]: item, ...(item as Record<string, unknown>) })
      )
    )
    return results.flatMap((r) => r.files)
  }

  // Fallback to legacy template.scope
  if (resolved.scope === 'Entity') {
    const results = await Promise.all(
      getAllEntities(model).map((entity) =>
        executeTemplate(resolved, model, { entity, ...entity })
      )
    )
    return results.flatMap((r) => r.files)
  }

  if (resolved.scope === 'Enum') {
    const results = await Promise.all(
      getAllEnums(model).map((en) => executeTemplate(resolved, model, { enum: en, ...en }))
    )
    return results.flatMap((r) => r.files)
  }

  if (resolved.scope === 'Package') {
    const results = await Promise.all(
      getAllPackages(model).map((pkg) =>
        executeTemplate(resolved, model, { package: pkg, ...pkg })
      )
    )
    return results.flatMap((r) => r.files)
  }

  return (await executeTemplate(resolved, model)).files
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

// backwards-compat alias
export const renderTemplatePPByScope = renderTemplateByScope
