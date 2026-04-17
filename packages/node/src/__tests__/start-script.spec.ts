import { type ChildProcess, spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_DIR = resolve(__dirname, '..', '..')
const WORKSPACE_ROOT = resolve(PACKAGE_DIR, '..', '..')

const BOOT_TIMEOUT_MS = 20_000

/**
 * Spawn `pnpm -F @xomda/node start` from the given cwd and resolve once
 * the banner has printed its "Cwd:" line. Captures stdout for assertion.
 */
function bootStartScript(cwd: string): Promise<{ proc: ChildProcess; stdout: string }> {
  return new Promise((resolveBoot, reject) => {
    const proc = spawn('pnpm', ['-F', '@xomda/node', 'start'], {
      cwd,
      env: { ...process.env, XOMDA_PORT: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let resolved = false

    const timer = setTimeout(() => {
      if (resolved) return
      proc.kill('SIGKILL')
      reject(
        new Error(
          `start script did not finish banner within ${BOOT_TIMEOUT_MS}ms\n` +
            `stdout:\n${stdout}\nstderr:\n${stderr}`
        )
      )
    }, BOOT_TIMEOUT_MS)

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (/http:\/\/localhost:\d+/.test(stdout) && /Cwd:/.test(stdout)) {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        resolveBoot({ proc, stdout })
      }
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on('exit', (code) => {
      if (resolved) return
      clearTimeout(timer)
      reject(
        new Error(
          `start script exited before banner (code ${code})\n` +
            `stdout:\n${stdout}\nstderr:\n${stderr}`
        )
      )
    })
    proc.on('error', (err) => {
      if (resolved) return
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function shutdown(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.killed) return
  proc.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 200))
  if (!proc.killed) proc.kill('SIGKILL')
}

/**
 * Regression guard for the `pnpm dev` / `pnpm start` cwd bug.
 *
 * `pnpm -F @xomda/node start` runs the start script from packages/node/.
 * The script must `cd ../..` so cwd lands on the workspace root — that's
 * where `.xomda/model.json` and `.xomda/templates/` live. If a future
 * refactor drops that `cd`, the homepage shows the wrong project root,
 * the templates view comes up empty, and several Cypress specs fail
 * (they look for the workspace's seeded templates). This integration
 * test catches the regression at the package-script level.
 *
 * The test exercises `start` rather than `dev` because `dev` watches and
 * never exits cleanly, which would slow the suite down without adding
 * coverage — both scripts share the `cd ../..` prefix.
 */
describe('@xomda/node start script cwd', () => {
  let running: ChildProcess | undefined

  afterEach(async () => {
    await shutdown(running)
    running = undefined
  })

  it('lands on the workspace root when invoked from the worktree root', async () => {
    const { proc, stdout } = await bootStartScript(WORKSPACE_ROOT)
    running = proc
    const cwdLine = stdout.split('\n').find((l) => l.includes('Cwd:'))
    expect(cwdLine, `no Cwd line in banner:\n${stdout}`).toBeTruthy()
    expect(cwdLine).toContain(WORKSPACE_ROOT)
    expect(cwdLine).not.toContain(`${WORKSPACE_ROOT}/packages/node`)
  })
})
