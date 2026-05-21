import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * AGENTS.md §"Package layout" → Dependency direction is the documented
 * graph below. Every workspace `package.json` is parsed and every
 * `workspace:*` dep is checked against this allow-list. Reverse edges
 * (e.g. `@xomda/core → @xomda/model`) silently work at build time but
 * tangle the platform — AGENTS.md §"Repository structure" calls them a
 * "finding". This spec catches them at PR time instead of next audit.
 *
 * To add a new edge: extend the entry for the importing package. To add
 * a new package: register it with an entry (empty if it has no workspace
 * deps). Missing the entry fails this spec — that's the gate.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/**
 * Allowed workspace deps per package. The values are unions, not exact
 * sets — a package may legitimately depend on a subset. Reverse edges
 * (anything the importer is NOT in the allowed-deps list for) trigger
 * a failure.
 *
 * Keep this list synchronised with AGENTS.md §"Package layout" — it is
 * the executable form of that documentation.
 */
// Shared base for every leaf plugin's allowed deps.
const PLUGIN_BASE_DEPS: readonly string[] = [
  '@xomda/analysis-client',
  '@xomda/analysis-core',
  '@xomda/core',
  '@xomda/icons',
]

function pluginDeps(...extra: string[]): ReadonlySet<string> {
  return new Set([...PLUGIN_BASE_DEPS, ...extra])
}

const ALL_PLUGIN_NAMES: readonly string[] = [
  '@xomda/plugin-analysis-ant',
  '@xomda/plugin-analysis-binary',
  '@xomda/plugin-analysis-eslint',
  '@xomda/plugin-analysis-gradle',
  '@xomda/plugin-analysis-intellij',
  '@xomda/plugin-analysis-markdown',
  '@xomda/plugin-analysis-maven',
  '@xomda/plugin-analysis-node',
  '@xomda/plugin-analysis-prettier',
  '@xomda/plugin-analysis-rust',
  '@xomda/plugin-analysis-stylelint',
  '@xomda/plugin-analysis-typescript',
  '@xomda/plugin-analysis-visualstudio',
  '@xomda/plugin-analysis-vite',
  '@xomda/plugin-analysis-vscode',
  '@xomda/plugin-analysis-webpack',
  '@xomda/plugin-analysis-xomda',
]

const ALLOWED: Record<string, ReadonlySet<string>> = {
  // Tier-0 — pure leaves.
  '@xomda/util': new Set(),
  '@xomda/icons': new Set(),
  '@xomda/core': new Set(['@xomda/util']),

  // Tier-1 — platform libraries.
  '@xomda/template': new Set(['@xomda/core', '@xomda/util']),
  '@xomda/codeeditor': new Set(['@xomda/util']),
  '@xomda/ui': new Set(['@xomda/codeeditor', '@xomda/core', '@xomda/icons', '@xomda/util']),
  '@xomda/diagram': new Set(['@xomda/core', '@xomda/icons', '@xomda/util']),

  // Analysis subsystem.
  '@xomda/analysis-core': new Set(['@xomda/core', '@xomda/icons', '@xomda/util']),
  '@xomda/analysis-client': new Set(['@xomda/analysis-core', '@xomda/icons', '@xomda/ui']),
  // Every plugin may depend on the analysis-core node API + analysis-client
  // for its client-side icon/preview register + icons + (transitively) core.
  // Some plugins (markdown, node) pull more — locked here so any new dep is
  // a deliberate review decision.
  '@xomda/plugin-analysis-ant': pluginDeps(),
  '@xomda/plugin-analysis-binary': pluginDeps(),
  '@xomda/plugin-analysis-eslint': pluginDeps(),
  '@xomda/plugin-analysis-gradle': pluginDeps(),
  '@xomda/plugin-analysis-intellij': pluginDeps(),
  '@xomda/plugin-analysis-markdown': pluginDeps('@xomda/codeeditor'),
  '@xomda/plugin-analysis-maven': pluginDeps(),
  '@xomda/plugin-analysis-node': pluginDeps('@xomda/util'),
  '@xomda/plugin-analysis-prettier': pluginDeps(),
  '@xomda/plugin-analysis-rust': pluginDeps(),
  '@xomda/plugin-analysis-stylelint': pluginDeps(),
  '@xomda/plugin-analysis-typescript': pluginDeps(),
  '@xomda/plugin-analysis-visualstudio': pluginDeps(),
  '@xomda/plugin-analysis-vite': pluginDeps(),
  '@xomda/plugin-analysis-vscode': pluginDeps(),
  '@xomda/plugin-analysis-webpack': pluginDeps(),
  '@xomda/plugin-analysis-xomda': pluginDeps(),
  '@xomda/analysis-plugins': new Set([
    // Side-effect aggregator — imports every node-side plugin.
    '@xomda/analysis-core',
    '@xomda/core',
    '@xomda/icons',
    ...ALL_PLUGIN_NAMES,
  ]),
  '@xomda/analysis-plugins-client': new Set([
    // Side-effect aggregator — imports every client-side plugin half plus
    // both halves of analysis-core/analysis-plugins for shared types.
    '@xomda/analysis-client',
    '@xomda/analysis-core',
    '@xomda/analysis-plugins',
    '@xomda/icons',
    ...ALL_PLUGIN_NAMES,
  ]),

  // Tier-2 — apps and consumers.
  '@xomda/model': new Set([
    '@xomda/analysis-core',
    '@xomda/analysis-plugins',
    '@xomda/core',
    '@xomda/template',
    '@xomda/util',
  ]),
  '@xomda/node': new Set(['@xomda/model', '@xomda/util']),
  '@xomda/cli': new Set(['@xomda/core', '@xomda/model', '@xomda/template', '@xomda/util']),
  '@xomda/client': new Set([
    '@xomda/analysis-client',
    '@xomda/analysis-core',
    '@xomda/analysis-plugins-client',
    '@xomda/codeeditor',
    '@xomda/core',
    '@xomda/diagram',
    '@xomda/icons',
    '@xomda/model',
    '@xomda/template',
    '@xomda/ui',
    '@xomda/unplugin',
    '@xomda/util',
  ]),
  '@xomda/bundle': new Set([
    // The bundle (workspace name) — pulls every workspace package into
    // the published `xomda` tarball.
    '@xomda/analysis-core',
    '@xomda/analysis-plugins',
    '@xomda/analysis-plugins-client',
    '@xomda/cli',
    '@xomda/client',
    '@xomda/codeeditor',
    '@xomda/core',
    '@xomda/diagram',
    '@xomda/icons',
    '@xomda/model',
    '@xomda/node',
    '@xomda/template',
    '@xomda/ui',
    '@xomda/util',
  ]),
  '@xomda/e2e-tests': new Set(),

  // Integrations live below the platform: they may pull anything in.
  '@xomda/unplugin': new Set(['@xomda/cli', '@xomda/core', '@xomda/template', '@xomda/util']),
  'xomda-vscode': new Set([
    '@xomda/cli',
    '@xomda/core',
    '@xomda/model',
    '@xomda/node',
    '@xomda/template',
    '@xomda/util',
  ]),
}

interface PkgJson {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function readPkg(path: string): PkgJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PkgJson
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
      if (st.isDirectory()) {
        visit(full, depth + 1)
      } else if (name === 'package.json') {
        out.push(full)
      }
    }
  }
  for (const sub of ['packages', 'integrations/node']) {
    visit(resolve(root, sub), 0)
  }
  return out
}

const pkgPaths = walkPackageJsons(REPO_ROOT)

describe('workspace dependency direction', () => {
  it('every package is registered in the ALLOWED graph', () => {
    const missing: string[] = []
    for (const path of pkgPaths) {
      const pkg = readPkg(path)
      if (!pkg.name) continue
      if (!(pkg.name in ALLOWED)) missing.push(`${pkg.name} (${path})`)
    }
    expect(missing, 'add an entry to ALLOWED in this spec').toEqual([])
  })

  it.each(pkgPaths)('%s honours its allowed workspace deps', (path) => {
    const pkg = readPkg(path)
    if (!pkg.name) return
    const allowed = ALLOWED[pkg.name]
    if (!allowed) return // Handled by the registration test above.

    // Collect every workspace dep across dependencies + devDependencies +
    // peerDependencies. Workspace deps are identified by `workspace:` value
    // prefix, which pnpm rewrites at publish time.
    const all: Record<string, string> = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    }
    const workspaceDeps = Object.entries(all)
      .filter(([, v]) => v.startsWith('workspace:'))
      .map(([k]) => k)

    const offenders = workspaceDeps.filter((dep) => !allowed.has(dep))
    expect(
      offenders,
      `${pkg.name} has unauthorised workspace deps: [${offenders.join(', ')}]. ` +
        `Either remove the dep or extend ALLOWED in this spec (with a code-review justification).`
    ).toEqual([])
  })
})
