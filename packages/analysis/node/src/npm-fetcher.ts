import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  type PackageFetchContext,
  type PackageMetadata,
  registerPackageFetcher,
} from '@xomda/analysis-core'
import { createConcurrencyQueue, createLogger } from '@xomda/util'

import { parsePackageJson } from './package-parser'

const log = createLogger('analysis.node.npm-fetcher')

/** How many parallel registry requests one fetcher call may have in flight. */
const PER_FETCH_CONCURRENCY = 8
const NPM_REGISTRY = 'https://registry.npmjs.org'

interface NpmLatest {
  version?: string
  license?: string
  deprecated?: string
}

/** Resolve a single package's latest release from the npm registry. */
async function fetchLatest(name: string, signal?: AbortSignal): Promise<NpmLatest | null> {
  // `/{pkg}/latest` returns the manifest of the dist-tag `latest` release.
  // 200 = found, 404 = unpublished. Anything else (5xx, rate limits) bubbles
  // up as an error so the dispatcher can surface it per-package.
  const url = `${NPM_REGISTRY}/${encodeURIComponent(name)}/latest`
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`npm registry ${res.status} for ${name}`)
  }
  const data = (await res.json()) as Record<string, unknown>
  return {
    version: typeof data.version === 'string' ? data.version : undefined,
    license: typeof data.license === 'string' ? data.license : undefined,
    deprecated: typeof data.deprecated === 'string' ? data.deprecated : undefined,
  }
}

/**
 * Read the project's `package.json` (regular + dev dependencies) and ask
 * the npm registry for the latest release of every entry. Returns one
 * `PackageMetadata` per dep: `{ name, range, latest?, license?, deprecated? }`.
 *
 * Registry calls run through an internal `createConcurrencyQueue` bounded
 * by {@link PER_FETCH_CONCURRENCY} so a project with hundreds of deps
 * doesn't open hundreds of sockets at once.
 */
export async function fetchPackageData(ctx: PackageFetchContext): Promise<PackageMetadata[]> {
  const pkgPath = ctx.project.path === '.' ? ctx.rootPath : join(ctx.rootPath, ctx.project.path)
  const manifestPath = join(pkgPath, 'package.json')
  let raw: string
  try {
    raw = await readFile(manifestPath, 'utf-8')
  } catch (err) {
    log.warn(`could not read ${manifestPath}`, { data: err })
    return []
  }
  const meta = parsePackageJson(raw)
  if (!meta) return []

  // Combine regular + dev deps with a `scope` discriminator so the UI can
  // group them later. Skipping peer/optional intentionally — those aren't
  // installed-by-default and confuse the "is anything out of date?" signal.
  const entries: Array<{ name: string; range: string; scope: 'dep' | 'devDep' }> = []
  for (const [name, range] of Object.entries(meta.dependencies)) {
    entries.push({ name, range, scope: 'dep' })
  }
  for (const [name, range] of Object.entries(meta.devDependencies)) {
    entries.push({ name, range, scope: 'devDep' })
  }

  const queue = createConcurrencyQueue(PER_FETCH_CONCURRENCY)
  const results = await Promise.all(
    entries.map((entry) =>
      queue.run(async () => {
        try {
          const latest = await fetchLatest(entry.name, ctx.signal)
          return {
            name: entry.name,
            range: entry.range,
            scope: entry.scope,
            latest: latest?.version,
            license: latest?.license,
            deprecated: latest?.deprecated,
          } satisfies PackageMetadata
        } catch (err) {
          log.info(`failed to resolve ${entry.name}`, { data: err })
          return {
            name: entry.name,
            range: entry.range,
            scope: entry.scope,
            error: err instanceof Error ? err.message : String(err),
          } satisfies PackageMetadata
        }
      })
    )
  )
  return results
}

registerPackageFetcher({ pluginId: 'node', fetchPackageData })
