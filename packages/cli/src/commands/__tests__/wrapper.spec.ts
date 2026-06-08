import { existsSync, statSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readOwnCliVersion, wrapper } from '../wrapper'
import { POSIX_SCRIPT, WINDOWS_SCRIPT } from '../wrapper-scripts'

describe('wrapper command', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-wrapper-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes xomdaw, xomdaw.cmd, and xomda-wrapper.json', async () => {
    const result = await wrapper(root, { version: '1.2.3' })

    expect(result.version).toBe('1.2.3')
    expect(result.wroteScripts).toBe(true)
    expect(existsSync(result.posixScriptPath)).toBe(true)
    expect(existsSync(result.windowsScriptPath)).toBe(true)
    expect(existsSync(result.configPath)).toBe(true)

    expect(await readFile(result.posixScriptPath, 'utf-8')).toBe(POSIX_SCRIPT)
    expect(await readFile(result.windowsScriptPath, 'utf-8')).toBe(WINDOWS_SCRIPT)

    const config = JSON.parse(await readFile(result.configPath, 'utf-8'))
    expect(config).toEqual({ version: '1.2.3' })
  })

  it('marks xomdaw executable on POSIX', async () => {
    if (process.platform === 'win32') return
    const result = await wrapper(root, { version: '1.2.3' })
    const mode = statSync(result.posixScriptPath).mode & 0o777
    expect(mode & 0o100).toBeTruthy()
  })

  it('is idempotent without --force: preserves scripts, updates version pin', async () => {
    await wrapper(root, { version: '1.2.3' })

    const result = await wrapper(root, { version: '2.0.0' })

    expect(result.wroteScripts).toBe(false)
    expect(await readFile(result.posixScriptPath, 'utf-8')).toBe(POSIX_SCRIPT)
    const config = JSON.parse(await readFile(result.configPath, 'utf-8'))
    expect(config).toEqual({ version: '2.0.0' })
  })

  it('with --force rewrites scripts even when present', async () => {
    await wrapper(root, { version: '1.2.3' })

    const result = await wrapper(root, { version: '2.0.0', force: true })

    expect(result.wroteScripts).toBe(true)
  })

  it('places config under .xomda/wrapper/', async () => {
    const result = await wrapper(root, { version: '1.2.3' })
    expect(result.configPath).toBe(join(root, '.xomda', 'wrapper', 'xomda-wrapper.json'))
  })

  it('places scripts at project root, not inside .xomda/', async () => {
    const result = await wrapper(root, { version: '1.2.3' })
    expect(result.posixScriptPath).toBe(join(root, 'xomdaw'))
    expect(result.windowsScriptPath).toBe(join(root, 'xomdaw.cmd'))
  })
})

// Helper: write a fake package.json two directories above a fake `dist/`
// subdirectory so readOwnCliVersion() finds it at the `../../` candidate.
async function makeFakeCliDir(
  base: string,
  pkg: { name: string; version: string }
): Promise<string> {
  // Structure mirrors the published bundle: <base>/dist/cli.js lives two
  // dirs below <base>/package.json.  readOwnCliVersion is called with the
  // `dist` dir as startDir, so candidates are:
  //   ../../package.json  → <base>/package.json   ✓
  //   ../../../package.json → parent of base        (ignored)
  const distDir = join(base, 'dist')
  await mkdir(distDir, { recursive: true })
  await writeFile(join(base, 'package.json'), JSON.stringify(pkg), 'utf-8')
  return distDir
}

describe('readOwnCliVersion', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'xomda-roclv-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('reads version from a package named "@xomda/cli" (dev workspace layout)', async () => {
    const startDir = await makeFakeCliDir(tmpDir, { name: '@xomda/cli', version: '1.2.3' })
    expect(await readOwnCliVersion(startDir)).toBe('1.2.3')
  })

  it('reads version from a package named "xomda" (legacy name)', async () => {
    const startDir = await makeFakeCliDir(tmpDir, { name: 'xomda', version: '2.0.0' })
    expect(await readOwnCliVersion(startDir)).toBe('2.0.0')
  })

  it('reads version from a package named "xomda-js" (published npm package name)', async () => {
    // Regression: previously only '@xomda/cli' and 'xomda' were accepted,
    // so `npx xomda-js wrapper` always threw "could not determine version".
    const startDir = await makeFakeCliDir(tmpDir, { name: 'xomda-js', version: '0.0.3' })
    expect(await readOwnCliVersion(startDir)).toBe('0.0.3')
  })

  it('returns undefined when no recognisable package.json is found', async () => {
    const startDir = await makeFakeCliDir(tmpDir, { name: 'unrelated-pkg', version: '1.0.0' })
    expect(await readOwnCliVersion(startDir)).toBeUndefined()
  })

  it('returns undefined when the package.json has no version field', async () => {
    const startDir = await makeFakeCliDir(tmpDir, { name: 'xomda-js' } as never)
    expect(await readOwnCliVersion(startDir)).toBeUndefined()
  })
})
