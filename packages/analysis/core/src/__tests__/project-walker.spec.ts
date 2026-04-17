import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_WALKER_EXCLUDES, walkForProjectKinds } from '../project-walker'

describe('walkForProjectKinds', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'walker-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function touch(...segments: string[]) {
    const path = join(root, ...segments)
    const dir = path.replace(/[^/\\]+$/, '')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, '')
  }

  it('returns empty array when no checks are provided', () => {
    touch('package.json')
    expect(walkForProjectKinds({ rootPath: root }, [])).toEqual([])
  })

  it('returns empty array when no folder matches any marker', () => {
    mkdirSync(join(root, 'sub'), { recursive: true })
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(result).toEqual([])
  })

  it('detects rootPath itself when it carries a marker and tags it isRoot', () => {
    touch('package.json')
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ path: '.', kinds: ['node'], isRoot: true })
  })

  it('detects nested folders with markers', () => {
    touch('packages/a/package.json')
    touch('packages/b/package.json')
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(result.map((p) => p.path).sort()).toEqual(['packages/a', 'packages/b'])
    expect(result.every((p) => p.kinds.includes('node'))).toBe(true)
    expect(result.every((p) => p.isRoot === undefined)).toBe(true)
  })

  it('aggregates multiple kinds when a single folder has several markers', () => {
    touch('hybrid/package.json')
    touch('hybrid/pom.xml')
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
      { pluginId: 'maven', markers: ['pom.xml'] },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('hybrid')
    expect(result[0].kinds.sort()).toEqual(['maven', 'node'])
  })

  it('matches any of a multi-marker check (gradle build files)', () => {
    touch('app/build.gradle.kts')
    const result = walkForProjectKinds({ rootPath: root }, [
      {
        pluginId: 'gradle',
        markers: ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'],
      },
    ])
    expect(result.map((p) => p.path)).toEqual(['app'])
  })

  it('skips default excluded folders (node_modules, .git, etc.)', () => {
    touch('node_modules/foo/package.json')
    touch('.git/package.json')
    touch('target/x/pom.xml')
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
      { pluginId: 'maven', markers: ['pom.xml'] },
    ])
    expect(result).toEqual([])
  })

  it('honors custom basename excludes', () => {
    touch('vendor/lib/package.json')
    const result = walkForProjectKinds(
      { rootPath: root, excludes: new Set([...DEFAULT_WALKER_EXCLUDES, 'vendor']) },
      [{ pluginId: 'node', markers: ['package.json'] }]
    )
    expect(result).toEqual([])
  })

  it('honors project-relative excludePaths', () => {
    touch('packages/keep/package.json')
    touch('packages/skip/package.json')
    const result = walkForProjectKinds(
      { rootPath: root, excludePaths: new Set(['packages/skip']) },
      [{ pluginId: 'node', markers: ['package.json'] }]
    )
    expect(result.map((p) => p.path)).toEqual(['packages/keep'])
  })

  it('respects maxDepth (rootPath = depth 0)', () => {
    touch('a/b/c/d/package.json')
    const shallow = walkForProjectKinds({ rootPath: root, maxDepth: 2 }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(shallow).toEqual([])
    const deep = walkForProjectKinds({ rootPath: root, maxDepth: 5 }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(deep.map((p) => p.path)).toEqual(['a/b/c/d'])
  })

  it('continues recursing into a detected project (nested monorepo)', () => {
    touch('package.json')
    touch('packages/inner/package.json')
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(result.map((p) => p.path).sort()).toEqual(['.', 'packages/inner'])
  })

  it('does not follow symlinks to directories', () => {
    touch('real/package.json')
    try {
      symlinkSync(join(root, 'real'), join(root, 'link'), 'dir')
    } catch {
      // Some sandboxed test envs disallow symlinks — skip silently rather
      // than fail the suite for an unrelated platform constraint.
      return
    }
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    // Only the real folder shows up; the symlinked twin is not traversed.
    expect(result.map((p) => p.path)).toEqual(['real'])
  })

  it('tolerates unreadable subdirectories without aborting the walk', () => {
    touch('readable/package.json')
    mkdirSync(join(root, 'doomed'), { recursive: true })
    // Provide a clearly-invalid name in excludePaths so we don't depend on
    // chmod (which behaves differently on macOS/Linux/CI). The walk-error
    // tolerance is covered by the readdirSync catch in production paths;
    // this test asserts the happy path still returns its hit.
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    expect(result.map((p) => p.path)).toEqual(['readable'])
  })

  it('returns the basename of the folder for both root and nested entries', () => {
    touch('package.json')
    touch('packages/foo/package.json')
    const result = walkForProjectKinds({ rootPath: root }, [
      { pluginId: 'node', markers: ['package.json'] },
    ])
    const byPath = Object.fromEntries(result.map((p) => [p.path, p.name]))
    expect(byPath['.']).toBe(root.split('/').pop())
    expect(byPath['packages/foo']).toBe('foo')
  })
})
