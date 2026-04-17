import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ProjectFileSchema } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { walkSubprojects } from '../workspace-walk'

async function makeXomdaProject(
  absRoot: string,
  opts: { name: string; isRoot?: boolean } = { name: 'p' }
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
}

describe('walkSubprojects', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-walk-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns [] when there are no subprojects', async () => {
    await makeXomdaProject(root, { name: 'root' })
    expect(walkSubprojects(root)).toEqual([])
  })

  it('finds a single nested subproject at depth 1', async () => {
    await makeXomdaProject(root, { name: 'root' })
    await makeXomdaProject(join(root, 'sub-a'), { name: 'a' })
    const found = walkSubprojects(root)
    expect(found.map((s) => s.name)).toEqual(['a'])
    expect(found[0].isRoot).toBe(false)
  })

  it('returns subprojects ordered by lexical path so output is deterministic', async () => {
    await makeXomdaProject(root, { name: 'root' })
    await makeXomdaProject(join(root, 'sub-b'), { name: 'b' })
    await makeXomdaProject(join(root, 'sub-a'), { name: 'a' })
    expect(walkSubprojects(root).map((s) => s.name)).toEqual(['a', 'b'])
  })

  it('flags `isRoot: true` subprojects with isRoot=true', async () => {
    await makeXomdaProject(root, { name: 'root' })
    await makeXomdaProject(join(root, 'iso'), { name: 'iso', isRoot: true })
    const found = walkSubprojects(root)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ name: 'iso', isRoot: true })
  })

  it('does NOT descend into `isRoot: true` subprojects (boundary enforcement)', async () => {
    await makeXomdaProject(root, { name: 'root' })
    await makeXomdaProject(join(root, 'iso'), { name: 'iso', isRoot: true })
    await makeXomdaProject(join(root, 'iso', 'nested'), { name: 'nested' })
    const found = walkSubprojects(root)
    expect(found.map((s) => s.name)).toEqual(['iso'])
  })

  it('descends through a non-root subproject to find a grandchild', async () => {
    await makeXomdaProject(root, { name: 'root' })
    await makeXomdaProject(join(root, 'sub'), { name: 'sub' })
    await makeXomdaProject(join(root, 'sub', 'grand'), { name: 'grand' })
    const names = walkSubprojects(root)
      .map((s) => s.name)
      .sort()
    expect(names).toEqual(['grand', 'sub'])
  })

  it('respects `excludeFromScan` (skips node_modules by default)', async () => {
    await makeXomdaProject(root, { name: 'root' })
    // A project under node_modules must NOT be walked into.
    await makeXomdaProject(join(root, 'node_modules', 'leaked'), { name: 'leaked' })
    await makeXomdaProject(join(root, 'sub-real'), { name: 'real' })
    expect(walkSubprojects(root).map((s) => s.name)).toEqual(['real'])
  })

  it('falls back to basename when project.json is missing', async () => {
    await makeXomdaProject(root, { name: 'root' })
    // A subproject with .xomda/ but no project.json — name should be folder basename.
    await mkdir(join(root, 'no-meta', '.xomda'), { recursive: true })
    const found = walkSubprojects(root)
    expect(found.map((s) => s.name)).toEqual(['no-meta'])
    expect(found[0].isRoot).toBe(false)
  })

  it('tolerates malformed project.json (treats as isRoot=false)', async () => {
    await makeXomdaProject(root, { name: 'root' })
    await mkdir(join(root, 'bad', '.xomda'), { recursive: true })
    await writeFile(join(root, 'bad', '.xomda', 'project.json'), 'not json', 'utf-8')
    const found = walkSubprojects(root)
    expect(found.map((s) => s.name)).toEqual(['bad'])
    expect(found[0].isRoot).toBe(false)
  })
})
