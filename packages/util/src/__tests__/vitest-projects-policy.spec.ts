import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * The root `vitest.config.ts` carries a `projects: [...]` array so editor
 * Vitest extensions (VS Code, JetBrains) can discover the per-package
 * configs. Without it the IDE loads tests against the root config — which
 * has no Vite plugins wired — and `.tsx` test files fail to transform
 * (`@vitejs/plugin-vue-jsx` lives in the per-package configs).
 *
 * The audit's H13 originally proposed deleting this list because it drifted
 * silently when new packages landed. The compromise: keep the list, but
 * gate it with this spec. Every config file discovered on disk must be in
 * the list; every list entry must point at a real file. New package +
 * config → this spec fails until the list is updated.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const ROOT_VITEST_CONFIG = resolve(REPO_ROOT, 'vitest.config.ts')

/**
 * Configs that DO carry a `test` block but are deliberately excluded from
 * the root projects list (run only via their package's own `pnpm test`).
 * Empty today — the field exists so additions are visible in PR diff.
 */
const EXCLUDED_FROM_ROOT_PROJECTS: ReadonlySet<string> = new Set()

function findConfigsWithTestBlock(root: string): string[] {
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
        continue
      }
      if (name === 'vitest.config.ts' || name === 'vite.config.ts') {
        // Filter out vite-only configs (no test block).
        const body = readFileSync(full, 'utf8')
        if (/\btest\s*:/.test(body)) out.push(full)
      }
    }
  }
  for (const sub of ['packages', 'integrations/node']) {
    visit(resolve(root, sub), 0)
  }
  return out
}

function extractProjects(rootConfigSource: string): string[] {
  // Match the `projects: [ ... ]` block. The array elements are string
  // literals (the spec is paths, not config objects), so a permissive
  // regex pulls each entry.
  const match = rootConfigSource.match(/projects\s*:\s*\[([\s\S]*?)\]/)
  if (!match) return []
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

describe('vitest.config.ts root projects list', () => {
  const rootSrc = readFileSync(ROOT_VITEST_CONFIG, 'utf8')
  const declared = extractProjects(rootSrc)
  const discovered = findConfigsWithTestBlock(REPO_ROOT).map((p) => relative(REPO_ROOT, p))

  it('lists every discovered per-package config (no silent drift on new packages)', () => {
    const missing = discovered.filter(
      (p) => !declared.includes(p) && !EXCLUDED_FROM_ROOT_PROJECTS.has(p)
    )
    expect(
      missing,
      `New per-package config(s) on disk not registered in the root projects list. ` +
        `Add them to vitest.config.ts so editor Vitest extensions find them, ` +
        `or document the exception in EXCLUDED_FROM_ROOT_PROJECTS.`
    ).toEqual([])
  })

  it('has no phantom entries (every listed path resolves to a real file)', () => {
    const phantom = declared.filter((p) => !discovered.includes(p))
    expect(
      phantom,
      `Listed in vitest.config.ts but missing from disk — entries:\n${phantom.join('\n')}`
    ).toEqual([])
  })

  it('is sorted alphabetically (so PR diffs are diff-only)', () => {
    const sorted = [...declared].sort()
    expect(declared).toEqual(sorted)
  })
})
