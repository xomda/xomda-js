import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * AGENTS.md §23 — TypeScript scripts run via `node --experimental-strip-types`.
 * `ts-node` and `tsx` are explicitly banned. This spec scans every workspace
 * package.json `scripts` block for either runtime, with a per-package allow-list
 * for cases where the migration is non-trivial (transitive imports need `.ts`
 * extensions). The allow-list is the executable form of the "tracked for
 * follow-up" note in the C7/H4 commits — every entry needs a justification.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/**
 * Packages whose `scripts` block is allowed to invoke `tsx` while their
 * cross-package import graph awaits the `.ts`-suffix sweep that
 * `node --experimental-strip-types` requires. Empty when the migration is
 * complete. AGENTS.md §23 explicitly sanctions strip-types as the only
 * future runtime.
 */
const TSX_ALLOWLIST: ReadonlySet<string> = new Set([
  // packages/node — dev/start watch the workspace TS entry; transitive
  // imports across @xomda/model and @xomda/template don't use .ts suffixes.
  '@xomda/node',
  // packages/e2e-tests — start:app runs @xomda/node's entry via tsx for
  // the same reason; setup:sandbox imports relative TS files without .ts
  // suffixes. Migrates when @xomda/node migrates.
  '@xomda/e2e-tests',
])

const TS_NODE_ALLOWLIST: ReadonlySet<string> = new Set()

interface PkgJson {
  name?: string
  scripts?: Record<string, string>
}

function walkPackageJsons(root: string): string[] {
  const out: string[] = []
  const visit = (dir: string, depth: number) => {
    if (depth > 3) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (
        name === 'node_modules' ||
        name === 'dist' ||
        name === 'target' ||
        name === 'build' ||
        name === 'output' ||
        name.startsWith('.')
      ) {
        continue
      }
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) visit(full, depth + 1)
      else if (name === 'package.json') out.push(full)
    }
  }
  for (const sub of ['packages', 'integrations/node']) {
    visit(resolve(root, sub), 0)
  }
  return out
}

function readPkg(path: string): PkgJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PkgJson
}

// Use word-boundary aware regexes so we match invocations
// (`tsx watch …`, `node --loader ts-node/esm`) but not strings like
// `xomda-vscode` or a directory called `tsx-fixtures`.
const TSX_INVOCATION = /\btsx\b(?!-)/
const TS_NODE_INVOCATION = /\bts-node\b/

describe('TypeScript runtime policy — AGENTS.md §23', () => {
  const pkgPaths = walkPackageJsons(REPO_ROOT)

  it.each(pkgPaths)('%s does not invoke a banned TS runtime in its scripts', (path) => {
    const pkg = readPkg(path)
    if (!pkg.name || !pkg.scripts) return

    const tsxOffenders: string[] = []
    const tsNodeOffenders: string[] = []
    for (const [scriptName, body] of Object.entries(pkg.scripts)) {
      if (TSX_INVOCATION.test(body) && !TSX_ALLOWLIST.has(pkg.name)) {
        tsxOffenders.push(`${scriptName}: ${body}`)
      }
      if (TS_NODE_INVOCATION.test(body) && !TS_NODE_ALLOWLIST.has(pkg.name)) {
        tsNodeOffenders.push(`${scriptName}: ${body}`)
      }
    }
    expect(
      tsxOffenders,
      `${pkg.name} invokes tsx in scripts. AGENTS.md §23 mandates ` +
        `'node --experimental-strip-types' instead. Either migrate or add the ` +
        `package to TSX_ALLOWLIST with a code-review justification.`
    ).toEqual([])
    expect(
      tsNodeOffenders,
      `${pkg.name} invokes ts-node in scripts. AGENTS.md §23 mandates ` +
        `'node --experimental-strip-types' instead.`
    ).toEqual([])
  })

  it('TSX_ALLOWLIST does not grow silently — every entry is named', () => {
    // Documenting the size makes a new allow-list addition show up in PR diff.
    expect(TSX_ALLOWLIST.size).toBeLessThanOrEqual(2)
    expect(TS_NODE_ALLOWLIST.size).toBe(0)
  })
})
