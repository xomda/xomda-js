import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ProjectFileSchema } from '@xomda/core'
import { writeModel } from '@xomda/model/storage'
import type { Template } from '@xomda/template'
import { writeTemplate } from '@xomda/template'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generate, generateRecursive } from '../generate'
import { previewRecursive } from '../preview'

function makeTemplate(name: string): Template {
  return {
    uuid: crypto.randomUUID(),
    name,
    version: '1.0.0',
    cells: [
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: `${name}.txt`,
      },
      {
        uuid: crypto.randomUUID(),
        type: 'handlebars',
        content: `hello from ${name}`,
      },
    ],
  }
}

async function seedProject(
  absRoot: string,
  opts: { name: string; isRoot?: boolean; template: string }
): Promise<void> {
  await mkdir(join(absRoot, '.xomda'), { recursive: true })
  const projectFile = ProjectFileSchema.parse({
    name: opts.name,
    settings: opts.isRoot ? { isRoot: true } : { isRoot: false },
  })
  await writeFile(
    join(absRoot, '.xomda', 'project.json'),
    JSON.stringify(projectFile, null, 2),
    'utf-8'
  )
  await writeModel(
    {
      id: crypto.randomUUID(),
      name: `${opts.name}-model`,
      version: '1.0.0',
      packages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    absRoot
  )
  await writeTemplate(makeTemplate(opts.template), absRoot)
}

describe('generateRecursive', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-gen-recursive-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('generates the workspace and every non-isRoot subproject; lists skipped roots', async () => {
    await seedProject(root, { name: 'root', template: 'r' })
    await seedProject(join(root, 'sub-a'), { name: 'a', template: 'a' })
    await seedProject(join(root, 'iso'), { name: 'iso', isRoot: true, template: 'iso' })

    const projects = await generateRecursive(root, { recursive: true })

    // Workspace first, then non-isRoot subprojects (lexical path order).
    expect(projects.map((p) => p.root.endsWith('iso'))).toEqual([false, false])
    expect(projects).toHaveLength(2) // workspace + sub-a; iso skipped

    // Each project emitted its own template.
    const allPaths = projects.flatMap((p) => p.results.map((r) => r.outputPath))
    expect(allPaths.sort()).toEqual(['a.txt', 'r.txt'])

    // Files landed on disk under the right project roots.
    expect(existsSync(join(root, 'r.txt'))).toBe(true)
    expect(existsSync(join(root, 'sub-a', 'a.txt'))).toBe(true)

    // The isRoot subproject was NOT generated into.
    expect(existsSync(join(root, 'iso', 'iso.txt'))).toBe(false)

    // The workspace entry reports the skipped root.
    expect(projects[0].skippedRoots).toEqual([{ path: 'iso', name: 'iso' }])
    // Sub-a doesn't carry skippedRoots — only the workspace does.
    expect(projects[1].skippedRoots).toBeUndefined()
  })

  it('still works for a single-project workspace (no subprojects)', async () => {
    await seedProject(root, { name: 'solo', template: 's' })
    const projects = await generateRecursive(root, { recursive: true })
    expect(projects).toHaveLength(1)
    expect(projects[0].results.map((r) => r.outputPath)).toEqual(['s.txt'])
    expect(projects[0].skippedRoots).toBeUndefined()
  })

  it('generate() with recursive: true returns a flat aggregated list (back-compat shape)', async () => {
    await seedProject(root, { name: 'root', template: 'r' })
    await seedProject(join(root, 'sub-a'), { name: 'a', template: 'a' })
    const results = await generate(root, { recursive: true })
    expect(results.map((r) => r.outputPath).sort()).toEqual(['a.txt', 'r.txt'])
  })

  it('previewRecursive renders without writing files', async () => {
    await seedProject(root, { name: 'root', template: 'r' })
    await seedProject(join(root, 'sub-a'), { name: 'a', template: 'a' })

    const projects = await previewRecursive(root)
    expect(
      projects
        .map((p) => p.results.map((r) => r.outputPath))
        .flat()
        .sort()
    ).toEqual(['a.txt', 'r.txt'])

    // No files should have been written (preview is dry-run).
    expect(existsSync(join(root, 'r.txt'))).toBe(false)
    expect(existsSync(join(root, 'sub-a', 'a.txt'))).toBe(false)
  })

  it('descends into a non-root subproject to reach a grandchild', async () => {
    await seedProject(root, { name: 'root', template: 'r' })
    await seedProject(join(root, 'sub'), { name: 'sub', template: 's' })
    await seedProject(join(root, 'sub', 'grand'), { name: 'grand', template: 'g' })

    const projects = await generateRecursive(root, { recursive: true })
    const names = projects.flatMap((p) => p.results.map((r) => r.outputPath)).sort()
    expect(names).toEqual(['g.txt', 'r.txt', 's.txt'])
  })

  it('stops at every isRoot boundary independently (multiple boundaries)', async () => {
    await seedProject(root, { name: 'root', template: 'r' })
    await seedProject(join(root, 'iso-a'), { name: 'a', isRoot: true, template: 'a' })
    await seedProject(join(root, 'iso-a', 'inside'), { name: 'inside', template: 'in' })
    await seedProject(join(root, 'iso-b'), { name: 'b', isRoot: true, template: 'b' })

    const projects = await generateRecursive(root, { recursive: true })
    // Only the workspace itself; both isRoot siblings are skipped.
    expect(projects).toHaveLength(1)
    expect(projects[0].skippedRoots?.map((s) => s.name).sort()).toEqual(['a', 'b'])
    expect(existsSync(join(root, 'iso-a', 'inside', 'in.txt'))).toBe(false)
  })
})
