import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  commitVersion,
  getVersion,
  listVersions,
  readVersionsIndex,
  writeModel,
} from '../file-storage'

const minimalModel = (name = 'M') => ({
  id: crypto.randomUUID(),
  name,
  version: '1.0.0',
  packages: [],
})

describe('versions storage', () => {
  let root: string
  const cwd = process.cwd()

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-versions-'))
    process.chdir(root)
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
  })

  afterEach(async () => {
    process.chdir(cwd)
    await rm(root, { recursive: true, force: true })
  })

  it('commits a version with parent=null when no prior versions exist', async () => {
    await writeModel(minimalModel())
    const v = await commitVersion({ label: 'v1' })
    expect(v.label).toBe('v1')
    expect(v.parent).toBeNull()
    expect(v.snapshotFilename).toMatch(/^v-.+\.json$/)

    const index = await readVersionsIndex()
    expect(index.head).toBe(v.id)
    expect(index.versions).toHaveLength(1)
  })

  it('chains parent ids on subsequent commits', async () => {
    await writeModel(minimalModel())
    const v1 = await commitVersion({ label: 'v1' })
    const v2 = await commitVersion({ label: 'v2', message: 'second' })
    expect(v2.parent).toBe(v1.id)
    expect(v2.message).toBe('second')

    const index = await readVersionsIndex()
    expect(index.head).toBe(v2.id)
    expect(index.versions).toHaveLength(2)
  })

  it('listVersions returns versions sorted newest first', async () => {
    await writeModel(minimalModel())
    await commitVersion({ label: 'v1' })
    await new Promise((r) => setTimeout(r, 5))
    await commitVersion({ label: 'v2' })

    const list = await listVersions()
    expect(list[0].label).toBe('v2')
    expect(list[1].label).toBe('v1')
  })

  it('getVersion returns the snapshot model', async () => {
    await writeModel(minimalModel('Snapshotty'))
    const v = await commitVersion({ label: 'v1' })
    const fetched = await getVersion(v.id)
    expect(fetched.version.id).toBe(v.id)
    expect(fetched.model.name).toBe('Snapshotty')
  })

  it('migrates legacy timestamp-named snapshots into versions.json', async () => {
    const histDir = join(root, XOMDA_DIR, 'history')
    await mkdir(histDir, { recursive: true })
    await writeFile(
      join(histDir, '2024-01-01T00-00-00-000Z.json'),
      JSON.stringify({
        timestamp: '2024-01-01T00:00:00.000Z',
        label: 'old-1',
        model: minimalModel('A'),
      }),
      'utf-8'
    )
    await writeFile(
      join(histDir, '2024-02-01T00-00-00-000Z.json'),
      JSON.stringify({
        timestamp: '2024-02-01T00:00:00.000Z',
        label: 'old-2',
        model: minimalModel('B'),
      }),
      'utf-8'
    )

    const index = await readVersionsIndex()
    expect(index.versions).toHaveLength(2)
    expect(index.versions[0].label).toBe('old-1')
    expect(index.versions[1].label).toBe('old-2')
    expect(index.versions[0].parent).toBeNull()
    expect(index.versions[1].parent).toBe(index.versions[0].id)
    expect(index.head).toBe(index.versions[1].id)

    // Idempotent — second read returns the same index without re-migrating.
    const again = await readVersionsIndex()
    expect(again.versions).toEqual(index.versions)

    expect(existsSync(join(root, XOMDA_DIR, 'versions.json'))).toBe(true)
  })

  it('returns an empty index when there is no history at all', async () => {
    const index = await readVersionsIndex()
    expect(index.head).toBeNull()
    expect(index.versions).toEqual([])
  })

  it('persists author metadata in versions.json', async () => {
    await writeModel(minimalModel())
    const v = await commitVersion({ label: 'v1', author: 'alice' })
    const raw = await readFile(join(root, XOMDA_DIR, 'versions.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.head).toBe(v.id)
    expect(parsed.versions[0].author).toBe('alice')
  })
})
