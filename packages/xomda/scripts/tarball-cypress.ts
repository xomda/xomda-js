import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildPublishArtifact, REPO_ROOT } from './build.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CYPRESS_PORT = 6451 // disjoint from the dev-server Cypress port (6440)
const READY_TIMEOUT_MS = 30_000

const E2E_DIR = resolve(REPO_ROOT, 'packages', 'e2e-tests')
const SPEC = resolve(E2E_DIR, 'cypress', 'e2e', 'smoke', 'tarball.cy.ts')

/**
 * Orchestrate the tarball Cypress smoke:
 *   1. Build the tarball.
 *   2. `npm install` it into a fresh tmp dir.
 *   3. Spawn `xomda --port CYPRESS_PORT` from the install dir.
 *   4. Wait until GET / returns 200.
 *   5. Run Cypress against that origin, targeting the tarball-smoke spec.
 *   6. Tear down regardless of pass/fail.
 *
 * Cypress is invoked from `packages/e2e-tests` so it picks up that package's
 * cypress.config.ts, but baseUrl is overridden via env so the spec talks to
 * the installed `xomda` rather than the dev `@xomda/node` server.
 */
async function main(): Promise<void> {
  const result = await buildPublishArtifact({ quiet: true })
  if (!result.tarballPath) throw new Error('build produced no tarball')

  const installDir = mkdtempSync(join(tmpdir(), 'xomda-tarball-cypress-'))
  let server: ChildProcess | undefined
  // Only assigned after the cypress run completes; the surrounding
  // try/finally ensures we reach the read at line ~90 only on success.
  let exitCode: number | undefined

  try {
    writeFileSync(
      join(installDir, 'package.json'),
      JSON.stringify({ name: 'xomda-tarball-cypress', private: true }, null, 2)
    )

    console.log(`▶ npm install ${result.tarballPath} → ${installDir}`)
    const install = spawnSync('npm', ['install', result.tarballPath, '--no-audit', '--no-fund'], {
      cwd: installDir,
      stdio: 'inherit',
    })
    if (install.status !== 0) throw new Error(`npm install failed (status ${install.status})`)

    const xomdaBin = resolve(installDir, 'node_modules', '.bin', 'xomda')
    if (!existsSync(xomdaBin)) throw new Error(`xomda bin not present at ${xomdaBin}`)

    console.log(`▶ starting xomda on port ${CYPRESS_PORT}`)
    server = spawn(xomdaBin, ['--port', String(CYPRESS_PORT)], {
      cwd: installDir,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'inherit', 'inherit'],
    })

    await waitForReady(CYPRESS_PORT)

    console.log('▶ running Cypress')
    // Override the default cypress.config.ts `excludeSpecPattern` (which
    // skips smoke/tarball.cy.ts so it doesn't run in the dev-server suite).
    // Cypress --config takes a JSON string for non-trivial values.
    const cypressConfig = JSON.stringify({
      baseUrl: `http://localhost:${CYPRESS_PORT}`,
      excludeSpecPattern: [],
    })
    const cy = spawnSync(
      'npx',
      [
        'cypress',
        'run',
        '--spec',
        SPEC,
        '--config-file',
        'cypress.config.ts',
        '--config',
        cypressConfig,
      ],
      {
        cwd: E2E_DIR,
        env: { ...process.env, CYPRESS_BASE_URL: `http://localhost:${CYPRESS_PORT}` },
        stdio: 'inherit',
      }
    )
    exitCode = cy.status ?? 1
  } finally {
    if (server && !server.killed) {
      server.kill('SIGTERM')
      await new Promise((r) => setTimeout(r, 300))
      if (!server.killed) server.kill('SIGKILL')
    }
    rmSync(installDir, { recursive: true, force: true })
  }

  if (exitCode !== undefined && exitCode !== 0) process.exit(exitCode)
}

async function waitForReady(port: number): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${port}/`)
      if (r.status === 200) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`xomda did not become ready on port ${port} within ${READY_TIMEOUT_MS}ms`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  await main()
}

// Reference imports to keep them in scope when the module is loaded but main() doesn't run.
void __dirname
