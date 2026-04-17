import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fileRouter } from '../file.router'
import { createCallerFactory } from '../trpc'

const createCaller = createCallerFactory(fileRouter)
const caller = createCaller({})

describe('file router', () => {
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

  describe('read', () => {
    it('reads an existing file', async () => {
      await writeFile(join(tmpDir, 'hello.txt'), 'hello world', 'utf-8')
      const { content } = await caller.read('hello.txt')
      expect(content).toBe('hello world')
    })

    it('reads a file in a subdirectory', async () => {
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

    it('throws FORBIDDEN for an absolute path outside cwd', async () => {
      await expect(caller.read('/etc/passwd')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })

    it('throws NOT_FOUND when the path is a directory', async () => {
      await mkdir(join(tmpDir, 'adir'))
      await expect(caller.read('adir')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })

  describe('list', () => {
    it('lists entries sorted by directory then name, skipping dotfiles by default', async () => {
      await writeFile(join(tmpDir, 'b.txt'), '', 'utf-8')
      await writeFile(join(tmpDir, 'a.txt'), '', 'utf-8')
      await writeFile(join(tmpDir, '.hidden'), '', 'utf-8')
      await mkdir(join(tmpDir, 'zfolder'))

      const entries = await caller.list({ path: '.' })
      expect(entries.map((e) => e.name)).toEqual(['zfolder', 'a.txt', 'b.txt'])
      expect(entries.find((e) => e.name === 'zfolder')?.isDirectory).toBe(true)
    })

    it('includes dotfiles when showHidden is true', async () => {
      await writeFile(join(tmpDir, '.hidden'), '', 'utf-8')
      const entries = await caller.list({ path: '.', showHidden: true })
      expect(entries.find((e) => e.name === '.hidden')?.isHidden).toBe(true)
    })

    it('flags directories that contain a `.xomda` subfolder as isXomda', async () => {
      await mkdir(join(tmpDir, 'project'))
      await mkdir(join(tmpDir, 'project', '.xomda'))
      const entries = await caller.list({ path: '.' })
      const project = entries.find((e) => e.name === 'project')
      expect(project?.isXomda).toBe(true)
    })

    it('flags a directory named `.xomda` with isXomdaDir', async () => {
      await mkdir(join(tmpDir, '.xomda'))
      const entries = await caller.list({ path: '.', showHidden: true })
      expect(entries.find((e) => e.name === '.xomda')?.isXomdaDir).toBe(true)
    })

    it('produces ids using dev:ino (not gid:ino)', async () => {
      await writeFile(join(tmpDir, 'a.txt'), '', 'utf-8')
      const entries = await caller.list({ path: '.' })
      const [entry] = entries
      // dev id is non-zero on real filesystems
      expect(entry.id).toMatch(/^\d+:\d+$/)
      // sanity: id is not the gid (gid would usually be a small group number on
      // POSIX; dev is a much larger 64-bit composite). We can't assert the exact
      // value, but the format must be `<positive int>:<positive int>`.
      const [dev, ino] = entry.id.split(':').map(Number)
      expect(Number.isFinite(dev)).toBe(true)
      expect(Number.isFinite(ino)).toBe(true)
      expect(ino).toBeGreaterThan(0)
    })

    it('throws FORBIDDEN for a path that escapes cwd', async () => {
      await expect(caller.list({ path: '../../..' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })

    it('throws FORBIDDEN for an absolute path outside cwd', async () => {
      await expect(caller.list({ path: '/etc' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })

    it('throws NOT_FOUND for a missing directory', async () => {
      await expect(caller.list({ path: 'no-such-dir' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('throws NOT_FOUND when path refers to a file, not a directory', async () => {
      await writeFile(join(tmpDir, 'file.txt'), '', 'utf-8')
      await expect(caller.list({ path: 'file.txt' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })

  describe('getStats', () => {
    it('returns stats for an existing file', async () => {
      await writeFile(join(tmpDir, 'a.txt'), 'hello', 'utf-8')
      const stats = await caller.getStats('a.txt')
      expect(stats.name).toBe('a.txt')
      expect(stats.path).toBe('a.txt')
      expect(stats.isDirectory).toBe(false)
      expect(stats.size).toBeGreaterThan(0)
      expect(typeof stats.mode).toBe('number')
      expect(stats.mode).toBeGreaterThan(0)
      expect(stats.mode).toBeLessThanOrEqual(0o777)
      expect(typeof stats.isReadOnly).toBe('boolean')
      expect(stats.isHidden).toBe(false)
    })

    it('reports isHidden for dot files', async () => {
      await writeFile(join(tmpDir, '.secret'), '', 'utf-8')
      const stats = await caller.getStats('.secret')
      expect(stats.isHidden).toBe(true)
    })

    it('reports isReadOnly for files with owner-write bit cleared', async () => {
      const path = join(tmpDir, 'ro.txt')
      await writeFile(path, '', 'utf-8')
      await chmod(path, 0o444)
      const stats = await caller.getStats('ro.txt')
      expect(stats.isReadOnly).toBe(true)
      expect(stats.mode & 0o200).toBe(0)
    })

    it('returns stats for a directory and flags isXomda when applicable', async () => {
      await mkdir(join(tmpDir, 'proj'))
      await mkdir(join(tmpDir, 'proj', '.xomda'))
      const stats = await caller.getStats('proj')
      expect(stats.isDirectory).toBe(true)
      expect(stats.isXomda).toBe(true)
      expect(stats.isXomdaDir).toBe(false)
    })

    it('throws NOT_FOUND for a missing path', async () => {
      await expect(caller.getStats('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('throws FORBIDDEN for a path that escapes cwd', async () => {
      await expect(caller.getStats('../../../etc/passwd')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })

    it('throws FORBIDDEN for an absolute path outside cwd', async () => {
      await expect(caller.getStats('/etc/passwd')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      })
    })
  })
})
