import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { executeTemplate } from '../engine'

interface FixtureFile {
  outputPath: string
  content: string
}

interface Fixture {
  description: string
  cells: unknown[]
  model: unknown
  scopeContext?: Record<string, unknown>
  expectedFiles?: FixtureFile[]
  expectedContextDiff?: Record<string, unknown>
  expectedOutput?: string
}

function loadFixtures(): Array<[string, Fixture]> {
  const dir = join(import.meta.dirname, '../__fixtures__')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const fixture = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Fixture
      return [fixture.description, fixture] as [string, Fixture]
    })
}

describe('shared fixtures', () => {
  for (const [description, fixture] of loadFixtures()) {
    it(description, async () => {
      const template = {
        uuid: 'test-uuid',
        name: 'Test',
        version: '1.0.0',
        cells: fixture.cells,
      } as Parameters<typeof executeTemplate>[0]

      const { files, cellOutputs } = await executeTemplate(
        template,
        fixture.model as Parameters<typeof executeTemplate>[1],
        fixture.scopeContext ?? {},
      )

      if (fixture.expectedFiles) {
        expect(files).toHaveLength(fixture.expectedFiles.length)
        for (let i = 0; i < fixture.expectedFiles.length; i++) {
          expect(files[i].outputPath).toBe(fixture.expectedFiles[i].outputPath)
          expect(files[i].content).toBe(fixture.expectedFiles[i].content)
        }
      }

      if (fixture.expectedContextDiff !== undefined) {
        const lastDiff = cellOutputs[cellOutputs.length - 1].contextDiff
        expect(lastDiff).toMatchObject(fixture.expectedContextDiff)
      }
    })
  }
})
