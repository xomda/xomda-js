import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveParentProject } from '../security'

let root = ''
let workspace = ''

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'xomda-pg-security-'))
  root = join(workspace, 'current')
  mkdirSync(join(root, '.xomda'), { recursive: true })
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('F2 — parentProject security guard (resolveParentProject)', () => {
  it('"./subproject" with .xomda/ inside: ok', () => {
    const sub = join(root, 'subproject')
    mkdirSync(join(sub, '.xomda'), { recursive: true })
    const r = resolveParentProject(root, './subproject', {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.absPath).toBe(realpathSync(sub))
  })

  it('"./subproject" without .xomda/: rejected (not-a-xomda-project)', () => {
    mkdirSync(join(root, 'subproject'), { recursive: true })
    const r = resolveParentProject(root, './subproject', {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('not-a-xomda-project')
  })

  it('"../sibling-project" with restrictReads true: rejected (escapes-project-root)', () => {
    const sibling = join(workspace, 'sibling-project')
    mkdirSync(join(sibling, '.xomda'), { recursive: true })
    const r = resolveParentProject(root, '../sibling-project', {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('escapes-project-root')
  })

  it('"../sibling-project" with restrictReads false AND valid .xomda/: ok', () => {
    const sibling = join(workspace, 'sibling-project')
    mkdirSync(join(sibling, '.xomda'), { recursive: true })
    const r = resolveParentProject(root, '../sibling-project', {
      restrictReadsToProjectRoot: false,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.absPath).toBe(realpathSync(sibling))
  })

  it('"../sibling-without-xomda" with restrictReads false: still rejected (not-a-xomda-project)', () => {
    const sibling = join(workspace, 'sibling-no-xomda')
    mkdirSync(sibling, { recursive: true })
    const r = resolveParentProject(root, '../sibling-no-xomda', {
      restrictReadsToProjectRoot: false,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('not-a-xomda-project')
  })

  it('absolute path inside the project root: ok', () => {
    const sub = join(root, 'subproject')
    mkdirSync(join(sub, '.xomda'), { recursive: true })
    const r = resolveParentProject(root, sub, {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(true)
  })

  it('absolute path outside the project root with restrictReads true: rejected', () => {
    const elsewhere = join(workspace, 'elsewhere')
    mkdirSync(join(elsewhere, '.xomda'), { recursive: true })
    const r = resolveParentProject(root, elsewhere, {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('escapes-project-root')
  })

  it('symlink pointing outside the project root with restrictReads true: rejected', () => {
    const outside = join(workspace, 'outside-target')
    mkdirSync(join(outside, '.xomda'), { recursive: true })
    const link = join(root, 'link-to-outside')
    symlinkSync(outside, link)
    const r = resolveParentProject(root, './link-to-outside', {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('escapes-project-root')
  })

  it('symlink pointing inside the project root: ok', () => {
    const sub = join(root, 'subproject')
    mkdirSync(join(sub, '.xomda'), { recursive: true })
    const link = join(root, 'link-to-sub')
    symlinkSync(sub, link)
    const r = resolveParentProject(root, './link-to-sub', {
      restrictReadsToProjectRoot: true,
    })
    expect(r.ok).toBe(true)
  })
})
