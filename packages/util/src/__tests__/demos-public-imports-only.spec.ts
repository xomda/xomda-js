import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Demos are the user-facing showroom for xomda. End users copy them
 * verbatim into their own projects. The internal `@xomda/*` packages
 * (`@xomda/core`, `@xomda/cli`, `@xomda/model`, `@xomda/template`, …)
 * are dev-time separation of concerns — they are not part of the public
 * surface and must never appear in code or `dependencies` under `demo/`.
 *
 * If this test fails, the fix is to widen the published `xomda` package's
 * public API (add to `packages/xomda/src/index.ts`) or `unplugin-xomda`,
 * not to fall back to the workspace-internal namespace.
 *
 * See `feedback_demos_user_facing_only.md`.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const DEMO_ROOT = join(REPO_ROOT, 'demo')

// Source extensions where a stray `@xomda/*` import would land. Skip generated
// directories, output, build artefacts, and node_modules — those are not
// authored by demo readers.
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.vue']
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'target',
  'output',
  'generated',
  '.git',
  '.vite',
  '.vite-temp',
])

const SCOPED_IMPORT =
  /from\s+['"]@xomda\/[^'"]+['"]|require\(\s*['"]@xomda\/[^'"]+['"]\s*\)|import\(\s*['"]@xomda\/[^'"]+['"]\s*\)/

interface Hit {
  file: string
  line: number
  match: string
}

function walkSource(dir: string, out: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkSource(full, out)
    } else if (SOURCE_EXTS.some((ext) => name.endsWith(ext))) {
      out.push(full)
    }
  }
}

function findScopedImports(): Hit[] {
  const files: string[] = []
  walkSource(DEMO_ROOT, files)
  const hits: Hit[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const m = SCOPED_IMPORT.exec(lines[i])
      if (m) {
        hits.push({ file: relative(REPO_ROOT, file), line: i + 1, match: m[0] })
      }
    }
  }
  return hits
}

function walkPackageJsons(dir: string, out: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      walkPackageJsons(full, out)
    } else if (name === 'package.json') {
      out.push(full)
    }
  }
}

interface DepHit {
  file: string
  field: 'dependencies' | 'devDependencies' | 'peerDependencies'
  packageName: string
}

function findScopedDeps(): DepHit[] {
  const files: string[] = []
  walkPackageJsons(DEMO_ROOT, files)
  const hits: DepHit[] = []
  for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const deps = pkg[field]
      if (!deps) continue
      for (const name of Object.keys(deps)) {
        if (name.startsWith('@xomda/')) {
          hits.push({ file: relative(REPO_ROOT, file), field, packageName: name })
        }
      }
    }
  }
  return hits
}

describe('demos must consume only the public xomda surface', () => {
  it('contains no `from "@xomda/*"` imports under demo/**', () => {
    const hits = findScopedImports()
    if (hits.length > 0) {
      const message = hits.map((h) => `  ${h.file}:${h.line} → ${h.match}`).join('\n')
      throw new Error(
        `Found ${hits.length} forbidden @xomda/* import(s) under demo/. Demos must only import from 'xomda' or 'unplugin-xomda':\n${message}`
      )
    }
    expect(hits).toEqual([])
  })

  it('contains no @xomda/* entries in any demo package.json dependencies', () => {
    const hits = findScopedDeps()
    if (hits.length > 0) {
      const message = hits.map((h) => `  ${h.file} (${h.field}) → ${h.packageName}`).join('\n')
      throw new Error(
        `Found ${hits.length} forbidden @xomda/* dependencies under demo/. Demos must only depend on 'xomda' (and 'unplugin-xomda' for build-tool plugins):\n${message}`
      )
    }
    expect(hits).toEqual([])
  })
})
