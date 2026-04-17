import type { AnalysisContext } from '@xomda/analysis-core'
import { describe, expect, it } from 'vitest'

import { vitePlugin } from '../index'

/**
 * Lens 3 H14 coverage. The vite plugin detects any of five config-file
 * variants and contributes a "Configured" status section to the project
 * overview. Multi-suffix detection is the only meaningful logic; this
 * spec pins which file names match and the shape of the overview row.
 */

const ALL_CONFIG_FILES = [
  'vite.config.js',
  'vite.config.ts',
  'vite.config.mjs',
  'vite.config.mts',
  'vite.config.cjs',
]

function ctxWith(present: ReadonlySet<string>): AnalysisContext {
  return {
    rootPath: '/r',
    fileExists: (path: string) => present.has(path),
    listFiles: () => [],
    readFile: async () => null,
  }
}

describe('vitePlugin.loadOverview', () => {
  it('returns null when no vite config exists', async () => {
    expect(await vitePlugin.loadOverview!(ctxWith(new Set()))).toBeNull()
  })

  it.each(ALL_CONFIG_FILES)('detects %s', async (filename) => {
    const contribution = await vitePlugin.loadOverview!(ctxWith(new Set([filename])))
    expect(contribution).not.toBeNull()
    expect(contribution!.pluginId).toBe('vite')
    expect(contribution!.sections).toHaveLength(1)
    expect(contribution!.sections[0]).toMatchObject({
      id: 'detected',
      kind: 'status',
      tone: 'success',
      label: 'Configured',
      sub: filename,
    })
  })

  it('lists multiple variants in display order when several are present', async () => {
    const contribution = await vitePlugin.loadOverview!(
      ctxWith(new Set(['vite.config.ts', 'vite.config.mjs']))
    )
    const section = contribution!.sections[0]
    // CONFIG_FILES is declared in canonical order; the overview's `sub` joins
    // present files in that order so two coexisting configs always render the
    // same way regardless of probe sequence.
    expect((section as { sub: string }).sub).toBe('vite.config.ts, vite.config.mjs')
  })
})

describe('vitePlugin descriptor', () => {
  it('declares two fileTypes: explicit config + overlay icon for TS/JS sources', () => {
    const ids = vitePlugin.fileTypes!.map((t) => t.id)
    expect(ids).toEqual(['vite-config', 'vite-source-overlay'])
    const overlay = vitePlugin.fileTypes!.find((t) => t.id === 'vite-source-overlay')
    // Overlay must NOT carry a `preview` so TS/JS plugins keep preview routing.
    expect(overlay?.preview).toBeUndefined()
  })

  it('exposes the canonical id and icon', () => {
    expect(vitePlugin.id).toBe('vite')
    expect(vitePlugin.icon).toBe('vite')
  })
})
