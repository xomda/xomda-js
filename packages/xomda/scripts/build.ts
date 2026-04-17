import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PUBLISH_EXTERNALS } from '../../client/vite-plugins/externals.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Repository root. The build script lives at packages/xomda/scripts/build.ts,
 * so two `..` jumps land at the workspace root.
 */
export const REPO_ROOT = resolve(__dirname, '..', '..', '..')

/** Where staged artifacts live before tarballing. Gitignored. */
export const STAGE_PARENT = resolve(REPO_ROOT, 'target', 'npm')

/** Staged package directory (becomes the tarball root). */
export const STAGE_DIR = resolve(STAGE_PARENT, 'xomda')

export interface BuildOptions {
  /** Skip running the SPA + bundle Vite builds (assume they already ran). */
  skipBuilds?: boolean
  /** Skip the final `npm pack` step. */
  skipPack?: boolean
  /** Quiet mode — suppress sub-process stdout. Errors still print. */
  quiet?: boolean
}

export interface BuildResult {
  /** Path to the staged package directory. */
  stageDir: string
  /** Path to the produced .tgz, or null if pack was skipped. */
  tarballPath: string | null
  /** Resolved version (from root package.json). */
  version: string
}

/**
 * Build the publishable `xomda` artifact.
 *
 * Steps:
 *   1. Clean target/npm/.
 *   2. `pnpm -F @xomda/client build` with XOMDA_BUILD=publish (produces
 *      the SPA dist/ with importmap + vendor.manifest.json).
 *   3. `pnpm -F @xomda/bundle build` (produces dist/cli.js + assets).
 *   4. Stage every required file into target/npm/xomda/.
 *   5. Generate the published package.json from package.template.json +
 *      root package.json metadata + the externals list.
 *   6. `npm pack` into target/npm/ (yields xomda-<version>.tgz).
 *
 * Used by both `pnpm build:publish` (humans) and the CI publish workflow
 * (so the artifact and its contents are identical in both paths).
 */
export async function buildPublishArtifact(opts: BuildOptions = {}): Promise<BuildResult> {
  const log = opts.quiet ? () => {} : (msg: string) => console.log(msg)

  const rootPkg = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')
  ) as RootPackageJson
  const version = rootPkg.version
  log(`▶ xomda publish build — version ${version}`)

  log('▶ cleaning target/npm/')
  await rm(STAGE_PARENT, { recursive: true, force: true })
  await mkdir(STAGE_DIR, { recursive: true })

  if (!opts.skipBuilds) {
    log('▶ building SPA (XOMDA_BUILD=publish)')
    await runPnpm(['-F', '@xomda/client', 'build'], { ...opts, env: { XOMDA_BUILD: 'publish' } })
    log('▶ building xomda CLI bundle')
    await runPnpm(['-F', '@xomda/bundle', 'build'], opts)
  } else {
    log('▶ skipBuilds — reusing existing packages/{client,xomda}/dist/')
  }

  log('▶ staging files')
  await stageFiles()

  log('▶ generating package.json')
  await writePublishedPackageJson(rootPkg)

  log('▶ rendering README.md')
  await renderReadme(rootPkg)

  log('▶ verifying externals integrity')
  await verifyExternalsConsistency()

  if (opts.skipPack) {
    return { stageDir: STAGE_DIR, tarballPath: null, version }
  }

  log('▶ npm pack')
  const tarballName = `xomda-${version}.tgz`
  await runCommand('npm', ['pack', '--pack-destination', STAGE_PARENT, '--silent'], {
    cwd: STAGE_DIR,
    quiet: opts.quiet,
  })
  const tarballPath = resolve(STAGE_PARENT, tarballName)
  log(`✓ ${relative(REPO_ROOT, tarballPath)}`)

  return { stageDir: STAGE_DIR, tarballPath, version }
}

async function stageFiles(): Promise<void> {
  // CLI bundle (dist/cli.js + assets/*)
  const xomdaDist = resolve(REPO_ROOT, 'packages', 'xomda', 'dist')
  assertExists(xomdaDist, '`pnpm -F @xomda/bundle build` produced no dist/ — run a build first.')
  await cp(xomdaDist, resolve(STAGE_DIR, 'dist'), { recursive: true })

  // SPA (index.html + assets/*) → published as ./client/
  const clientDist = resolve(REPO_ROOT, 'packages', 'client', 'dist')
  assertExists(
    clientDist,
    '`XOMDA_BUILD=publish pnpm -F @xomda/client build` produced no dist/ — run it first.'
  )
  await cp(clientDist, resolve(STAGE_DIR, 'client'), { recursive: true })

  // SPA vendor manifest must exist in publish mode.
  const manifest = resolve(STAGE_DIR, 'client', 'vendor.manifest.json')
  assertExists(
    manifest,
    'vendor.manifest.json missing — was the SPA built with XOMDA_BUILD=publish?'
  )

  // LICENSE.
  await cp(resolve(REPO_ROOT, 'LICENSE'), resolve(STAGE_DIR, 'LICENSE'))

  // AI-targeted docs.
  const aiDocsSrc = resolve(REPO_ROOT, 'docs', '.ai')
  if (existsSync(aiDocsSrc)) {
    await cp(aiDocsSrc, resolve(STAGE_DIR, 'docs', '.ai'), { recursive: true })
  }
}

async function writePublishedPackageJson(rootPkg: RootPackageJson): Promise<void> {
  const tpl = JSON.parse(
    await readFile(resolve(REPO_ROOT, 'packages', 'xomda', 'package.template.json'), 'utf8')
  ) as PublishedPackageJson

  const merged: PublishedPackageJson = {
    name: tpl.name,
    version: rootPkg.version,
    description: rootPkg.description,
    keywords: rootPkg.keywords,
    homepage: rootPkg.homepage,
    bugs: rootPkg.bugs,
    repository: rootPkg.repository,
    author: rootPkg.author,
    license: rootPkg.license,
    type: tpl.type,
    bin: tpl.bin,
    exports: tpl.exports,
    files: tpl.files,
    engines: tpl.engines,
    dependencies: tpl.dependencies,
  }

  await writeFile(
    resolve(STAGE_DIR, 'package.json'),
    `${JSON.stringify(merged, null, 2)}\n`,
    'utf8'
  )
}

async function renderReadme(rootPkg: RootPackageJson): Promise<void> {
  const tpl = await readFile(resolve(REPO_ROOT, 'packages', 'xomda', 'README.template.md'), 'utf8')
  const rendered = tpl.replaceAll('{{version}}', rootPkg.version)
  await writeFile(resolve(STAGE_DIR, 'README.md'), rendered, 'utf8')
}

/**
 * Every SPA external must appear in the published package.json `dependencies`.
 * Catches the failure mode where someone adds a package to PUBLISH_EXTERNALS but
 * forgets to wire it into package.template.json — the SPA would 404 the import
 * at runtime in a fresh install.
 */
async function verifyExternalsConsistency(): Promise<void> {
  const staged = JSON.parse(
    await readFile(resolve(STAGE_DIR, 'package.json'), 'utf8')
  ) as PublishedPackageJson
  const declared = new Set(Object.keys(staged.dependencies ?? {}))
  const missing = PUBLISH_EXTERNALS.filter((pkg) => !declared.has(pkg))
  if (missing.length > 0) {
    throw new Error(
      `SPA externals not present in published package.json dependencies: ${missing.join(', ')}\n` +
        `  Add them to packages/xomda/package.template.json or remove from PUBLISH_EXTERNALS.`
    )
  }
}

function assertExists(path: string, hint: string): void {
  if (!existsSync(path)) {
    throw new Error(`Missing required path: ${path}\n  ${hint}`)
  }
}

interface ProcessOptions {
  cwd?: string
  env?: Record<string, string>
  quiet?: boolean
}

async function runPnpm(args: string[], opts: ProcessOptions): Promise<void> {
  await runCommand('pnpm', args, opts)
}

async function runCommand(cmd: string, args: string[], opts: ProcessOptions): Promise<void> {
  await new Promise<void>((resolveExit, rejectExit) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? REPO_ROOT,
      env: { ...process.env, ...opts.env },
      stdio: opts.quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    })
    child.on('error', rejectExit)
    child.on('exit', (code) => {
      if (code === 0) resolveExit()
      else rejectExit(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

/** A subset of the root package.json fields the build script reads. */
interface RootPackageJson {
  version: string
  description?: string
  keywords?: string[]
  homepage?: string
  bugs?: { url: string }
  repository?: { type: string; url: string }
  author?: string
  license?: string
}

/** Shape of both the template and the rendered published package.json. */
interface PublishedPackageJson {
  name: string
  version?: string
  description?: string
  keywords?: string[]
  homepage?: string
  bugs?: { url: string }
  repository?: { type: string; url: string }
  author?: string
  license?: string
  type: 'module'
  bin: Record<string, string>
  exports: Record<string, string>
  files: string[]
  engines: Record<string, string>
  dependencies?: Record<string, string>
}

// CLI invocation: `node --experimental-strip-types build.ts`
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    await buildPublishArtifact()
  } catch (err) {
    const e = err as Error
    process.stderr.write(`\n✗ ${e.message}\n`)
    process.exit(1)
  }
}
