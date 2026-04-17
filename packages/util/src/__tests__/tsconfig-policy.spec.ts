import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Policy regressions the audit's Lens 6 documented:
 *
 *   - Per-package `paths` overrides drift from the workspace dep graph
 *     (omit real deps; include phantom ones). Root tsconfig is the single
 *     source of truth — no leaf package should redeclare `paths`.
 *   - `types: ["node"]` in browser-target packages leaks @types/node so
 *     `Buffer`/`process`/`__dirname` typecheck successfully — code that
 *     uses them then breaks at runtime in the browser.
 *
 * Both are silent (build passes, source-jump degrades, runtime crashes
 * months later). This spec catches both at PR time.
 */

// JSONC is allowed — strip line + block comments before parsing.
function parseJsonc(raw: string): unknown {
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  return JSON.parse(stripped)
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/**
 * Packages that target the browser (Vuetify, Vue, Storybook). None of these
 * should pull `@types/node` into their type-check graph.
 */
const BROWSER_PACKAGES: ReadonlySet<string> = new Set([
  'packages/client',
  'packages/codeeditor',
  'packages/diagram',
  'packages/icons',
  'packages/ui',
  'packages/analysis/client',
])

/**
 * Browser-shaped packages that legitimately keep `types: ["node"]` because
 * TS's transitive resolution pulls in node-side sibling files. The need
 * disappears once project references (audit H2) land — declaration files
 * replace transitive source resolution.
 */
const TYPES_NODE_BROWSER_EXCEPTIONS: ReadonlySet<string> = new Set([
  // analysis/plugins-client aggregates every plugin's /client deep import;
  // tsc's transitive walk pulls in each plugin's index.ts (the node half)
  // which uses `node:fs` etc. Captured-and-documented exception, not drift.
  'packages/analysis/plugins-client',
])

function findLeafTsconfigs(root: string): string[] {
  const out: string[] = []
  const visit = (dir: string, depth: number) => {
    if (depth > 4) return
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
      if (st.isDirectory()) {
        visit(full, depth + 1)
      } else if (name === 'tsconfig.json') {
        out.push(full)
      }
    }
  }
  for (const sub of ['packages', 'integrations/node']) {
    visit(resolve(root, sub), 0)
  }
  return out
}

interface TsConfig {
  extends?: string
  compilerOptions?: {
    paths?: Record<string, unknown>
    types?: string[]
  }
}

const leafConfigs = findLeafTsconfigs(REPO_ROOT)

describe('tsconfig policy', () => {
  it.each(leafConfigs)(
    '%s does not narrow `paths` — root tsconfig is the single source of truth',
    (path) => {
      const cfg = parseJsonc(readFileSync(path, 'utf8')) as TsConfig
      if (!cfg.extends) return // root tsconfig itself or a non-extending config.
      const paths = cfg.compilerOptions?.paths
      if (paths === undefined) return
      // `paths: {}` (empty) is the sanctioned reset pattern used by every
      // analysis plugin — they're leaves and shouldn't see the rest of the
      // workspace as source-mapped (Lens 6 #11). That's allowed. What's
      // NOT allowed is a non-empty narrowing — tsc REPLACES rather than
      // merges, so any selective override silently masks real deps and
      // includes phantoms (Lens 6 #2-4).
      expect(
        Object.keys(paths),
        `${path} narrows \`paths\` with ${Object.keys(paths).length} entries. ` +
          `tsc REPLACES rather than merges; this silently masks real deps and ` +
          `includes phantoms. Either delete the override entirely (inherit ` +
          `from root tsconfig — recommended), or reset with \`paths: {}\` if ` +
          `this package must NOT see other workspace packages as source-mapped.`
      ).toEqual([])
    }
  )

  const browserPaths = leafConfigs.filter((p) => {
    if ([...TYPES_NODE_BROWSER_EXCEPTIONS].some((e) => p.startsWith(`${resolve(REPO_ROOT, e)}/`))) {
      return false
    }
    return [...BROWSER_PACKAGES].some((b) => p.startsWith(`${resolve(REPO_ROOT, b)}/`))
  })

  it.each(browserPaths)('%s (browser package) does not declare types: ["node"]', (path) => {
    const cfg = parseJsonc(readFileSync(path, 'utf8')) as TsConfig
    const types = cfg.compilerOptions?.types
    // No `types` declared → fine (inherits whatever the root tsconfig wants).
    // Declared but missing 'node' → fine. Declared with 'node' in the list →
    // the regression we're guarding against.
    if (types === undefined) return
    expect(
      types,
      `${path} declares \`types: ${JSON.stringify(types)}\`. This is a ` +
        `browser-target package — including @types/node makes Buffer/process/__dirname ` +
        `typecheck successfully but breaks at runtime in the browser. ` +
        `If TS resolution legitimately needs node types here, add the package ` +
        `to TYPES_NODE_BROWSER_EXCEPTIONS with a code-review justification.`
    ).not.toContain('node')
  })

  it('TYPES_NODE_BROWSER_EXCEPTIONS does not grow silently', () => {
    expect(TYPES_NODE_BROWSER_EXCEPTIONS.size).toBeLessThanOrEqual(1)
  })
})
