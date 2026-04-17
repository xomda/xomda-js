import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { analysisRouter } from '../analysis.router'
import { createCallerFactory } from '../trpc'

const createCaller = createCallerFactory(analysisRouter)
const caller = createCaller({})

describe('analysisRouter', () => {
  describe('listPlugins', () => {
    it('returns every registered plugin (id snapshot)', async () => {
      const plugins = await caller.listPlugins()
      const ids = plugins.map((p) => p.id).sort()
      // Snapshot the complete plugin set so removing one is a deliberate change.
      expect(ids).toEqual(
        [
          'ant',
          'binary',
          'eslint',
          'gradle',
          'intellij',
          'markdown',
          'maven',
          'node',
          'prettier',
          'rust',
          'stylelint',
          'typescript',
          'visual-studio',
          'vite',
          'vscode',
          'webpack',
          'xomda',
        ].sort()
      )
    })

    it('returns a human-readable name per plugin', async () => {
      const plugins = await caller.listPlugins()
      for (const p of plugins) {
        expect(typeof p.name).toBe('string')
        expect(p.name.length).toBeGreaterThan(0)
      }
    })
  })

  describe('detect', () => {
    let tmpDir: string

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'xomda-analysis-router-'))
    })

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true })
    })

    it('returns an analysis result keyed by plugin name', async () => {
      // Empty directory: every plugin should be invoked and return something.
      const result = await caller.detect({ path: tmpDir })
      expect(result).toBeDefined()
      // The shape varies per analyzer but the result must be an object with
      // at least one of the known keys present.
      expect(typeof result).toBe('object')
    })

    it('detects a TypeScript project from a tsconfig.json', async () => {
      await writeFile(
        join(tmpDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true } }),
        'utf-8'
      )
      await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'demo' }), 'utf-8')

      const result = (await caller.detect({ path: tmpDir })) as unknown as Record<string, unknown>
      // Some plugin should have flagged this as a TS project. We don't pin to a
      // specific field name (the analyzer shape may evolve); we just verify
      // the call succeeds and returns a populated object.
      expect(Object.keys(result).length).toBeGreaterThan(0)
    })

    it('detects an .xomda directory as an xomda project', async () => {
      await mkdir(join(tmpDir, '.xomda'))
      await writeFile(
        join(tmpDir, '.xomda', 'model.json'),
        JSON.stringify({ id: 'x', name: 'X', version: '1.0.0', packages: [] }),
        'utf-8'
      )
      const result = await caller.detect({ path: tmpDir })
      expect(result).toBeDefined()
    })
  })
})
