import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { writeRenderResults } from '../renderer'
import type { RenderResult } from '../types'

const results: RenderResult[] = [
  { templateId: 'foo.tpl', outputPath: 'src/foo.ts', content: 'export const foo = 1\n' },
]

describe('writeRenderResults', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-write-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes files relative to root', async () => {
    await writeRenderResults(results, { root })
    const written = await readFile(join(root, 'src/foo.ts'), 'utf-8')
    expect(written).toBe('export const foo = 1\n')
  })

  it('calls resolveTarget and writes to the returned path', async () => {
    const altRoot = await mkdtemp(join(tmpdir(), 'xomda-write-alt-'))
    try {
      await writeRenderResults(results, {
        root,
        resolveTarget: (_candidate, outputPath) => join(altRoot, outputPath),
      })
      expect(existsSync(join(root, 'src/foo.ts'))).toBe(false)
      const written = await readFile(join(altRoot, 'src/foo.ts'), 'utf-8')
      expect(written).toBe('export const foo = 1\n')
    } finally {
      await rm(altRoot, { recursive: true, force: true })
    }
  })

  it('fires onRemap when actualPath differs from candidatePath', async () => {
    const altRoot = await mkdtemp(join(tmpdir(), 'xomda-remap-'))
    const onRemap = vi.fn()
    try {
      await writeRenderResults(results, {
        root,
        resolveTarget: (_candidate, outputPath) => join(altRoot, outputPath),
        onRemap,
      })
      expect(onRemap).toHaveBeenCalledTimes(1)
      const arg = onRemap.mock.calls[0][0] as {
        candidatePath: string
        actualPath: string
        outputPath: string
      }
      expect(arg.outputPath).toBe('src/foo.ts')
      expect(arg.actualPath.startsWith(altRoot)).toBe(true)
    } finally {
      await rm(altRoot, { recursive: true, force: true })
    }
  })

  it('does not fire onRemap when resolver returns the candidate unchanged', async () => {
    const onRemap = vi.fn()
    await writeRenderResults(results, {
      root,
      resolveTarget: (candidate) => candidate,
      onRemap,
    })
    expect(onRemap).not.toHaveBeenCalled()
  })

  it('propagates errors thrown by resolveTarget (sandbox rejection)', async () => {
    await expect(
      writeRenderResults(results, {
        root,
        resolveTarget: () => {
          throw new Error('outside sandbox')
        },
      })
    ).rejects.toThrow('outside sandbox')
  })
})
