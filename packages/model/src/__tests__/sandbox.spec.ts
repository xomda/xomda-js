import { join, resolve } from 'node:path'

import { defaultProjectSettings, type ProjectSettings } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { resolveWriteTarget, WriteOutsideProjectRootError } from '../sandbox'

const RESTRICTED: ProjectSettings = defaultProjectSettings()
const UNRESTRICTED: ProjectSettings = {
  ...defaultProjectSettings(),
  restrictWritesToProjectRoot: false,
}

const ROOT = '/my/project'

describe('resolveWriteTarget', () => {
  it('passes through targets inside the project root', () => {
    const t = resolveWriteTarget(join(ROOT, 'src', 'a.ts'), ROOT, RESTRICTED)
    expect(t.path).toBe(join(ROOT, 'src', 'a.ts'))
  })

  it('passes through outside-root targets when restriction is off', () => {
    const t = resolveWriteTarget('/elsewhere/x.ts', ROOT, UNRESTRICTED)
    expect(t.path).toBe('/elsewhere/x.ts')
  })

  it('rejects outside-root targets when restriction is on', () => {
    expect(() => resolveWriteTarget('/elsewhere/x.ts', ROOT, RESTRICTED)).toThrow(
      WriteOutsideProjectRootError
    )
  })

  it('rejects when project root is null and restriction is on', () => {
    // Nothing to be inside of → everything is "outside" → restricted blocks.
    expect(() => resolveWriteTarget('/anywhere/x.ts', null, RESTRICTED)).toThrow(
      WriteOutsideProjectRootError
    )
  })

  it('allows anything when project root is null and restriction is off', () => {
    const t = resolveWriteTarget('/anywhere/x.ts', null, UNRESTRICTED)
    expect(t.path).toBe('/anywhere/x.ts')
  })

  it('resolves relative targets against the project root', () => {
    const t = resolveWriteTarget('src/a.ts', ROOT, RESTRICTED)
    expect(t.path).toBe(resolve(ROOT, 'src/a.ts'))
  })

  it('rejects a `..`-escape attempt under restriction', () => {
    expect(() => resolveWriteTarget(join(ROOT, '..', 'other', 'x.ts'), ROOT, RESTRICTED)).toThrow(
      WriteOutsideProjectRootError
    )
  })

  it('exposes target + projectRoot on the thrown error', () => {
    try {
      resolveWriteTarget('/elsewhere/x.ts', ROOT, RESTRICTED)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(WriteOutsideProjectRootError)
      const e = err as WriteOutsideProjectRootError
      expect(e.projectRoot).toBe(ROOT)
      expect(e.target).toBe('/elsewhere/x.ts')
    }
  })
})
