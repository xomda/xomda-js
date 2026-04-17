import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { Entity, Enum, Model, Package } from '@xomda/core'

import { render } from './handlebarsEngine'
import type { HandlebarsRenderContext, HandlebarsTemplate, RenderResult } from './types'

function getAllEntities(model: Model): Entity[] {
  const entities: Entity[] = []
  function walkPackages(packages: Package[]): void {
    for (const pkg of packages) {
      entities.push(...(pkg.entities || []))
      walkPackages(pkg.packages || [])
    }
  }
  walkPackages(model.packages || [])
  return entities
}

function getAllEnums(model: Model): Enum[] {
  const enums: Enum[] = []
  function walkPackages(packages: Package[]): void {
    for (const pkg of packages) {
      enums.push(...(pkg.enums || []))
      walkPackages(pkg.packages || [])
    }
  }
  walkPackages(model.packages || [])
  return enums
}

function getAllPackages(model: Model): Package[] {
  const packages: Package[] = []
  function walkPackages(pkgs: Package[]): void {
    for (const pkg of pkgs) {
      packages.push(pkg)
      walkPackages(pkg.packages || [])
    }
  }
  walkPackages(model.packages || [])
  return packages
}

export function renderHandlebarsTemplate(
  template: HandlebarsTemplate,
  context: HandlebarsRenderContext
): RenderResult {
  const outputPath = render(template.outputPath, context as Record<string, unknown>)
  const content = render(template.content, context as Record<string, unknown>)
  return { templateId: template.id, outputPath, content }
}

export function renderHandlebarsPerEntity(
  template: HandlebarsTemplate,
  context: HandlebarsRenderContext
): RenderResult[] {
  const entities = getAllEntities(context.model)
  return entities.map((entity) =>
    renderHandlebarsTemplate(template, { ...context, entity, ...entity })
  )
}

export function renderHandlebarsTemplateByScope(
  template: HandlebarsTemplate,
  model: Model
): RenderResult[] {
  if (template.disabled) return []
  const context: HandlebarsRenderContext = { model }
  if (template.scope === 'Entity') {
    return getAllEntities(model).map((entity) =>
      renderHandlebarsTemplate(template, { ...context, entity, ...entity })
    )
  } else if (template.scope === 'Enum') {
    return getAllEnums(model).map((en) =>
      renderHandlebarsTemplate(template, { ...context, enum: en, ...en })
    )
  } else if (template.scope === 'Package') {
    return getAllPackages(model).map((pkg) =>
      renderHandlebarsTemplate(template, { ...context, package: pkg, ...pkg })
    )
  } else {
    return [renderHandlebarsTemplate(template, context)]
  }
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
