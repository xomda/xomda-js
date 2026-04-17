import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getRegisteredAnalysisPlugins, resetAnalysisRegistry } from '@xomda/analysis-core'
import { XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { xomdaPlugin } from '../index'

describe('xomdaPlugin manifest', () => {
  it('self-registers in the analysis registry on import', () => {
    expect(getRegisteredAnalysisPlugins().map((p) => p.id)).toContain('xomda')
  })

  it('claims model.json, project.json, *.template.json, and .txt (plaintext fallback)', () => {
    expect(xomdaPlugin.fileTypes?.map((ft) => ft.id)).toEqual([
      'xomda-model',
      'xomda-project',
      'xomda-template',
      'xomda-plaintext',
    ])
  })

  it('is a core plugin (always-on; cannot be disabled)', () => {
    expect(xomdaPlugin.core).toBe(true)
  })

  it('marks .xomda as its project marker', () => {
    expect(xomdaPlugin.projectKind?.marker).toBe(XOMDA_DIR)
  })
})

describe('xomdaPlugin.projectKind hooks', () => {
  let root: string

  beforeEach(async () => {
    resetAnalysisRegistry()
    // re-import to re-register after reset
    await import('../index')
    root = await mkdtemp(join(tmpdir(), 'xomda-plugin-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('loadMeta reads name from .xomda/project.json', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await writeFile(
      join(root, XOMDA_DIR, 'project.json'),
      JSON.stringify({ name: 'demo', description: 'desc' }),
      'utf-8'
    )
    const meta = await xomdaPlugin.projectKind?.loadMeta?.(root)
    expect(meta?.name).toBe('demo')
    expect(meta?.description).toBe('desc')
  })

  it('loadMeta falls back to folder basename when project.json is absent', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    const meta = await xomdaPlugin.projectKind?.loadMeta?.(root)
    expect(meta?.name).toMatch(/^xomda-plugin-/)
  })

  it('loadMeta returns null when .xomda is absent', async () => {
    expect(await xomdaPlugin.projectKind?.loadMeta?.(root)).toBeNull()
  })

  it('listSubprojects finds nested .xomda folders, excluding the root', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'packages', 'a', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'packages', 'b', XOMDA_DIR), { recursive: true })

    const subs = await xomdaPlugin.projectKind?.hooks?.listSubprojects?.(root)
    expect(subs?.map((s) => s.path).sort()).toEqual(['packages/a', 'packages/b'])
  })

  it('listSubprojects skips ignored dirs (node_modules, .git)', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'node_modules', 'pkg', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, '.git', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'packages', 'real', XOMDA_DIR), { recursive: true })

    const subs = await xomdaPlugin.projectKind?.hooks?.listSubprojects?.(root)
    expect(subs?.map((s) => s.path)).toEqual(['packages/real'])
  })

  it('detects when .xomda exists', () => {
    // sanity check on the marker — analyzer would do the actual detect
    expect(existsSync(join(root, XOMDA_DIR))).toBe(false)
  })

  it('listSubprojects honors a custom excludeFromScan', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    // Mark `vendor/` as an excluded folder via project settings.
    await writeFile(
      join(root, XOMDA_DIR, 'project.json'),
      JSON.stringify({ name: 'demo', settings: { excludeFromScan: ['vendor'] } }),
      'utf-8'
    )
    await mkdir(join(root, 'vendor', 'lib', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'apps', 'web', XOMDA_DIR), { recursive: true })

    const subs = await xomdaPlugin.projectKind?.hooks?.listSubprojects?.(root)
    expect(subs?.map((s) => s.path).sort()).toEqual(['apps/web'])
  })

  it('listSubprojects supports glob patterns in excludeFromScan', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await writeFile(
      join(root, XOMDA_DIR, 'project.json'),
      JSON.stringify({
        name: 'demo',
        settings: { excludeFromScan: ['packages/legacy-*'] },
      }),
      'utf-8'
    )
    await mkdir(join(root, 'packages', 'keep', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'packages', 'legacy-foo', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'packages', 'legacy-bar', XOMDA_DIR), { recursive: true })

    const subs = await xomdaPlugin.projectKind?.hooks?.listSubprojects?.(root)
    expect(subs?.map((s) => s.path).sort()).toEqual(['packages/keep'])
  })

  it('marks a subproject with isRoot=true and stops recursing into it', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'apps', 'service', XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'apps', 'service', 'inner', XOMDA_DIR), { recursive: true })
    // service is its own root — its 'inner' subproject should not surface
    // in the parent's scan.
    await writeFile(
      join(root, 'apps', 'service', XOMDA_DIR, 'project.json'),
      JSON.stringify({ name: 'service', settings: { isRoot: true } }),
      'utf-8'
    )

    const subs = await xomdaPlugin.projectKind?.hooks?.listSubprojects?.(root)
    const paths = subs?.map((s) => s.path).sort() ?? []
    expect(paths).toContain('apps/service')
    expect(paths).not.toContain('apps/service/inner')
    const service = subs?.find((s) => s.path === 'apps/service')
    expect(service?.isRoot).toBe(true)
  })

  it('regular subprojects are flagged with isRoot=false', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'apps', 'plain', XOMDA_DIR), { recursive: true })
    await writeFile(
      join(root, 'apps', 'plain', XOMDA_DIR, 'project.json'),
      JSON.stringify({ name: 'plain' }),
      'utf-8'
    )

    const subs = await xomdaPlugin.projectKind?.hooks?.listSubprojects?.(root)
    const plain = subs?.find((s) => s.path === 'apps/plain')
    expect(plain?.isRoot).toBe(false)
  })
})
