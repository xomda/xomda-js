import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { POSIX_SCRIPT, WINDOWS_SCRIPT } from './wrapper-scripts'

export interface WrapperOptions {
  /** Pinned xomda version. Defaults to the currently running CLI's package.json version. */
  version?: string
  /** Rewrite scripts even if they already exist. Default: false. */
  force?: boolean
}

export interface WrapperResult {
  posixScriptPath: string
  windowsScriptPath: string
  configPath: string
  version: string
  wroteScripts: boolean
}

export async function wrapper(root: string, options: WrapperOptions = {}): Promise<WrapperResult> {
  const version = options.version ?? (await readOwnCliVersion())
  if (!version)
    throw new Error('wrapper: could not determine xomda version; pass --version explicitly')

  const posixScriptPath = join(root, 'xomdaw')
  const windowsScriptPath = join(root, 'xomdaw.cmd')
  const wrapperDir = join(root, '.xomda', 'wrapper')
  const configPath = join(wrapperDir, 'xomda-wrapper.json')

  await mkdir(wrapperDir, { recursive: true })

  const scriptsExist = existsSync(posixScriptPath) && existsSync(windowsScriptPath)
  const wroteScripts = options.force || !scriptsExist
  if (wroteScripts) {
    await writeFile(posixScriptPath, POSIX_SCRIPT, 'utf-8')
    await writeFile(windowsScriptPath, WINDOWS_SCRIPT, 'utf-8')
    await chmod(posixScriptPath, 0o755)
  }

  await writeFile(configPath, `${JSON.stringify({ version }, null, 2)}\n`, 'utf-8')

  return { posixScriptPath, windowsScriptPath, configPath, version, wroteScripts }
}

/** @internal exported for unit testing only */
export async function readOwnCliVersion(startDir?: string): Promise<string | undefined> {
  const here = startDir ?? dirname(fileURLToPath(import.meta.url))
  for (const candidate of [
    // Published bundle: import.meta.url resolves to dist/<chunk>.js, so
    // `here` is the `dist/` directory.  One level up reaches package.json:
    //   node_modules/xomda-js/dist/../package.json = node_modules/xomda-js/package.json
    join(here, '..', 'package.json'),
    // Dev workspace: import.meta.url is packages/cli/src/commands/wrapper.ts,
    // so `here` is packages/cli/src/commands/.  Two levels up reaches:
    //   packages/cli/src/commands/../../package.json = packages/cli/package.json
    join(here, '..', '..', 'package.json'),
    join(here, '..', '..', '..', 'package.json'),
  ]) {
    try {
      const pkg = JSON.parse(await readFile(candidate, 'utf-8')) as {
        name?: string
        version?: string
      }
      // Accept any xomda package: '@xomda/cli' (dev workspace, scoped),
      // 'xomda' (legacy), or 'xomda-js' (the published npm package name).
      if (pkg.version && /^(@xomda\/|xomda)/.test(pkg.name ?? '')) return pkg.version
    } catch {
      // try next candidate
    }
  }
  return undefined
}
