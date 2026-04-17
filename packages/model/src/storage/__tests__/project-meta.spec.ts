import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getProjectPath,
  readProjectMeta,
  readVersionsIndex,
  saveProjectMeta,
} from '../file-storage'

describe('readProjectMeta', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-project-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns null when project.json does not exist', async () => {
    expect(await readProjectMeta(root)).toBeNull()
  })

  it('reads and validates project.json', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await writeFile(getProjectPath(root), JSON.stringify({ name: 'my-project' }), 'utf-8')
    const meta = await readProjectMeta(root)
    expect(meta?.name).toBe('my-project')
    expect(meta?.settings.restrictWritesToProjectRoot).toBe(true)
    expect(meta?.versions.versions).toEqual([])
  })

  it('points at .xomda/project.json', () => {
    expect(getProjectPath(root)).toBe(join(root, XOMDA_DIR, 'project.json'))
  })
})

describe('saveProjectMeta', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-project-save-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes project.json (creating .xomda dir) and round-trips through read', async () => {
    const written = await saveProjectMeta(
      {
        name: 'demo',
        description: 'a demo project',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: false },
      },
      root
    )
    expect(written.settings.restrictWritesToProjectRoot).toBe(false)

    const read = await readProjectMeta(root)
    expect(read?.name).toBe('demo')
    expect(read?.description).toBe('a demo project')
    expect(read?.settings.restrictWritesToProjectRoot).toBe(false)
  })

  it('materializes defaults on write', async () => {
    const written = await saveProjectMeta({ name: 'p' } as never, root)
    expect(written.settings.restrictWritesToProjectRoot).toBe(true)
  })
})

describe('versions.json → project.json migration', () => {
  let root: string

  const VERSION_ID = '15c2d6cd-2c5d-4d1b-9f06-7c66bfbf0c2a'

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-migrate-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('synthesizes project.json from legacy versions.json and deletes it', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await writeFile(
      join(root, XOMDA_DIR, 'versions.json'),
      JSON.stringify({
        head: VERSION_ID,
        versions: [
          {
            id: VERSION_ID,
            label: '1.0.0',
            parent: null,
            snapshotFilename: 'v.json',
            timestamp: '2026-05-14T00:00:00.000Z',
          },
        ],
      }),
      'utf-8'
    )

    const index = await readVersionsIndex(root)
    expect(index.head).toBe(VERSION_ID)
    expect(index.versions).toHaveLength(1)

    const meta = await readProjectMeta(root)
    expect(meta).not.toBeNull()
    expect(meta?.versions.head).toBe(VERSION_ID)
    // name defaults to the folder basename
    expect(meta?.name).toMatch(/^xomda-migrate-/)
    // legacy file is removed
    expect(existsSync(join(root, XOMDA_DIR, 'versions.json'))).toBe(false)
  })

  it('prefers project.json over versions.json when both exist', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await saveProjectMeta(
      {
        name: 'kept',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: true },
      },
      root
    )
    await writeFile(
      join(root, XOMDA_DIR, 'versions.json'),
      JSON.stringify({ head: VERSION_ID, versions: [] }),
      'utf-8'
    )

    const index = await readVersionsIndex(root)
    expect(index.head).toBeNull()
  })
})
