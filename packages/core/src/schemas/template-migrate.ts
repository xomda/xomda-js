// Normalizes a Template-shaped object so old (pre-loop) representations parse
// against the current schema. Tolerant: accepts arbitrary input and only
// rewrites fields it recognizes.
//
// Migrations:
//  - cell.type 'provider'        -> 'loop'
//  - cell.type 'provider-logic'  -> 'loop-logic'
//  - cell.providerSource         -> cell.loopSource
//  - flat siblings after a top-level loop become its children (per-iteration
//    semantics in the legacy renderer matched "everything after the provider")

interface LegacyCell {
  type?: string
  providerSource?: string
  loopSource?: string
  children?: LegacyCell[]
  [key: string]: unknown
}

interface LegacyTemplate {
  cells?: LegacyCell[]
  [key: string]: unknown
}

function migrateCell(cell: LegacyCell): LegacyCell {
  const out: LegacyCell = { ...cell }
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

function isLoopCell(cell: LegacyCell): boolean {
  return cell.type === 'loop' || cell.type === 'loop-logic'
}

/**
 * Convert a legacy flat cell list into the hierarchical shape:
 *  - The first loop cell adopts every subsequent cell as its children
 *    (matching the legacy semantics where everything after the provider
 *    cell ran per-iteration).
 *  - Nested children are migrated recursively.
 *
 * Cells whose `children` array is already populated are left as-is — that's
 * already the new shape.
 */
function nestFlatChildren(cells: LegacyCell[]): LegacyCell[] {
  const result: LegacyCell[] = []
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (isLoopCell(cell) && (!cell.children || cell.children.length === 0)) {
      const rest = cells.slice(i + 1)
      const nested = nestFlatChildren(rest)
      result.push({ ...cell, children: nested })
      break
    }
    result.push({ ...cell, children: cell.children ? nestFlatChildren(cell.children) : cell.children })
  }
  return result
}

export function normalizeTemplate(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input
  const tpl = input as LegacyTemplate
  if (!Array.isArray(tpl.cells)) return input
  const migrated = tpl.cells.map(migrateCell)
  const nested = nestFlatChildren(migrated)
  return { ...tpl, cells: nested }
}
