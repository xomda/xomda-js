import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fileRouter } from '../file.router'
import { createCallerFactory } from '../trpc'

const createCaller = createCallerFactory(fileRouter)
const caller = createCaller({})

describe('file.read', () => {
  let tmpDir: string
  let originalCwd: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'xomda-file-router-'))
    originalCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('reads an existing file', async () => {
    await writeFile(join(tmpDir, 'hello.txt'), 'hello world', 'utf-8')
    const { content } = await caller.read('hello.txt')
    expect(content).toBe('hello world')
  })

  it('reads a file in a subdirectory', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(tmpDir, 'sub'))
    await writeFile(join(tmpDir, 'sub', 'nested.ts'), 'export {}', 'utf-8')
    const { content } = await caller.read('sub/nested.ts')
    expect(content).toBe('export {}')
  })

  it('throws NOT_FOUND for a missing file', async () => {
    await expect(caller.read('nonexistent.txt')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws FORBIDDEN for a path that escapes cwd', async () => {
    await expect(caller.read('../../../etc/passwd')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('throws NOT_FOUND when the path is a directory', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(tmpDir, 'adir'))
    await expect(caller.read('adir')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
