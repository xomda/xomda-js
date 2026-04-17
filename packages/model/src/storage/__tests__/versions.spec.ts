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
    const v = await commitVersion({ upcomingVersion: '1.0.1' })
    expect(v.label).toBe('1.0.1')
    expect(v.parent).toBeNull()
    expect(v.snapshotFilename).toMatch(/^v-.+\.json$/)

    const index = await readVersionsIndex()
    expect(index.head).toBe(v.id)
    expect(index.versions).toHaveLength(1)
  })

  it('bumps the model version to the upcoming version after commit', async () => {
    await writeModel(minimalModel())
    await commitVersion({ upcomingVersion: '1.1.0' })
    const reread = await readVersionsIndex()
    expect(reread.versions[0].label).toBe('1.1.0')
    const { model } = await getVersion(reread.versions[0].id)
    expect(model.version).toBe('1.1.0')
  })

  it('chains parent ids on subsequent commits', async () => {
    await writeModel(minimalModel())
    const v1 = await commitVersion({ upcomingVersion: '1.0.1' })
    const v2 = await commitVersion({ upcomingVersion: '1.0.2', message: 'second' })
    expect(v2.parent).toBe(v1.id)
    expect(v2.message).toBe('second')

    const index = await readVersionsIndex()
    expect(index.head).toBe(v2.id)
    expect(index.versions).toHaveLength(2)
  })

  it('listVersions returns versions sorted newest first', async () => {
    await writeModel(minimalModel())
    await commitVersion({ upcomingVersion: '1.0.1' })
    await new Promise((r) => setTimeout(r, 5))
    await commitVersion({ upcomingVersion: '1.0.2' })

    const list = await listVersions()
    expect(list[0].label).toBe('1.0.2')
    expect(list[1].label).toBe('1.0.1')
  })

  it('getVersion returns the snapshot model', async () => {
    await writeModel(minimalModel('Snapshotty'))
    const v = await commitVersion({ upcomingVersion: '1.0.1' })
    const fetched = await getVersion(v.id)
    expect(fetched.version.id).toBe(v.id)
    expect(fetched.model.name).toBe('Snapshotty')
  })

  it('rejects a non-semver upcoming version', async () => {
    await writeModel(minimalModel())
    await expect(commitVersion({ upcomingVersion: 'abc' })).rejects.toThrow(/valid version/)
  })

  it('rejects an upcoming version not greater than current', async () => {
    await writeModel(minimalModel())
    await expect(commitVersion({ upcomingVersion: '1.0.0' })).rejects.toThrow(
      /greater than 1\.0\.0/
    )
    await expect(commitVersion({ upcomingVersion: '0.9.9' })).rejects.toThrow(
      /greater than 1\.0\.0/
    )
  })

  it('rejects an upcoming version not greater than max historical', async () => {
    await writeModel(minimalModel())
    await commitVersion({ upcomingVersion: '2.0.0' })
    // After commit, model.version is now 2.0.0, so further test against historical:
    // manually rewind the model to a lower version to isolate the historical check.
    await writeModel({ ...minimalModel(), version: '1.0.0' })
    await expect(commitVersion({ upcomingVersion: '1.5.0' })).rejects.toThrow(
      /previous version 2\.0\.0/
    )
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

    // Versions are now persisted inside project.json; the legacy versions.json
    // is deleted on migration.
    expect(existsSync(join(root, XOMDA_DIR, 'project.json'))).toBe(true)
    expect(existsSync(join(root, XOMDA_DIR, 'versions.json'))).toBe(false)
  })

  it('returns an empty index when there is no history at all', async () => {
    const index = await readVersionsIndex()
    expect(index.head).toBeNull()
    expect(index.versions).toEqual([])
  })

  it('persists author metadata in project.json', async () => {
    await writeModel(minimalModel())
    const v = await commitVersion({ upcomingVersion: '1.0.1', author: 'alice' })
    const raw = await readFile(join(root, XOMDA_DIR, 'project.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.versions.head).toBe(v.id)
    expect(parsed.versions.versions[0].author).toBe('alice')
  })
})
