#!/usr/bin/env node
// One-shot migration: rewrites every *.template.json under repo so that:
//  - cell.type 'provider' -> 'loop'
//  - cell.type 'provider-logic' -> 'loop-logic'
//  - cell.providerSource -> cell.loopSource
//  - all subsequent flat siblings of a top-level loop become its children
// Mirrors `normalizeTemplate` in @xomda/core, but writes the migration back
// to disk so the templates ship in the new hierarchical shape.

import { execSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

function migrateCell(cell) {
  const out = { ...cell }
  if (out.type === 'provider') out.type = 'loop'
  else if (out.type === 'provider-logic') out.type = 'loop-logic'
  if (out.providerSource !== undefined && out.loopSource === undefined) {
    out.loopSource = out.providerSource
  }
  delete out.providerSource
  if (Array.isArray(out.children)) {
    out.children = out.children.map(migrateCell)
  }
  return out
}

function isLoop(cell) {
  return cell.type === 'loop' || cell.type === 'loop-logic'
}

function nestFlatChildren(cells) {
  const result = []
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (isLoop(cell) && (!cell.children || cell.children.length === 0)) {
      const rest = cells.slice(i + 1)
      const nested = nestFlatChildren(rest)
      result.push({ ...cell, children: nested })
      return result
    }
    result.push({
      ...cell,
      ...(cell.children ? { children: nestFlatChildren(cell.children) } : {}),
    })
  }
  return result
}

function migrateTemplate(tpl) {
  if (!Array.isArray(tpl.cells)) return tpl
  return { ...tpl, cells: nestFlatChildren(tpl.cells.map(migrateCell)) }
}

const files = execSync(
  `find . -name "*.template.json" -not -path "*/node_modules/*" -not -path "*/.git/*"`,
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter(Boolean)

for (const file of files) {
  const raw = await readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  const migrated = migrateTemplate(parsed)
  const next = `${JSON.stringify(migrated, null, 2)  }\n`
  if (next !== raw) {
    await writeFile(file, next)
    console.log(`migrated ${file}`)
  }
}
