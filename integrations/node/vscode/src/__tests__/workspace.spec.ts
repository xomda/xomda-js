import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findXomdaProject, findXomdaProjects } from '../workspace'

describe('findXomdaProject', () => {
  let tmp: string

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'xomda-vscode-'))
  })

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true })
  })

  it('returns undefined when .xomda/model.json is absent', () => {
    expect(findXomdaProject(tmp)).toBeUndefined()
  })

  it('returns project info when .xomda/model.json exists', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(tmp, '.xomda'))
    await writeFile(join(tmp, '.xomda', 'model.json'), '{}')
    const project = findXomdaProject(tmp)
    expect(project).toBeDefined()
    expect(project?.root).toBe(tmp)
    expect(project?.modelPath).toBe(join(tmp, '.xomda', 'model.json'))
  })

  it('findXomdaProjects filters out roots without a model', async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(tmp, '.xomda'))
    await writeFile(join(tmp, '.xomda', 'model.json'), '{}')
    const other = await mkdtemp(join(tmpdir(), 'xomda-vscode-empty-'))
    try {
      const projects = findXomdaProjects([tmp, other])
      expect(projects).toHaveLength(1)
      expect(projects[0].root).toBe(tmp)
    } finally {
      await rm(other, { recursive: true, force: true })
    }
  })
})
