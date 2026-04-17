import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  type Model,
  MODEL_FILE,
  ModelSchema,
  type ModelStorage,
  SnapshotEnvelopeSchema,
  validateUpcomingVersion,
  type Version,
  type VersionsIndex,
  VersionsIndexSchema,
  XOMDA_DIR,
} from '@xomda/core'

const VERSIONS_FILE = 'versions.json'
const HISTORY_DIR = 'history'

export function getXomdaDir(root = process.cwd()): string {
  return join(root, XOMDA_DIR)
}

export function getModelPath(root = process.cwd()): string {
  return join(getXomdaDir(root), MODEL_FILE)
}

function getHistoryDir(root = process.cwd()): string {
  return join(getXomdaDir(root), HISTORY_DIR)
}

function getVersionsPath(root = process.cwd()): string {
  return join(getXomdaDir(root), VERSIONS_FILE)
}

function isModelUnchanged(a: Model, b: Model): boolean {
  const { updatedAt: _a, ...restA } = a
  const { updatedAt: _b, ...restB } = b
  return JSON.stringify(restA) === JSON.stringify(restB)
}

/**
 * Create a `ModelStorage` backed by a JSON file at `<root>/<XOMDA_DIR>/<MODEL_FILE>`.
 */
export function createFileStorage(root = process.cwd()): ModelStorage {
  return {
    async read() {
      const path = getModelPath(root)
      if (!existsSync(path)) {
        return ModelSchema.parse({})
      }
      const raw = await readFile(path, 'utf-8')
      return ModelSchema.parse(JSON.parse(raw))
    },
    async write(model) {
      const dir = getXomdaDir(root)
      const path = getModelPath(root)
      if (existsSync(path)) {
        const existing = ModelSchema.parse(JSON.parse(await readFile(path, 'utf-8')))
        if (isModelUnchanged(existing, model)) {
          return existing
        }
      }
      await mkdir(dir, { recursive: true })
      const updated: Model = { ...model, updatedAt: new Date().toISOString() }
      await writeFile(path, JSON.stringify(updated, null, 2), 'utf-8')
      return updated
    },
  }
}

export const readModel = (root?: string): Promise<Model> => createFileStorage(root).read()

export const writeModel = (model: Model, root?: string): Promise<Model> =>
  createFileStorage(root).write(model)

// ─── Versions ─────────────────────────────────────────────────────────────────

function newVersionId(): string {
  return crypto.randomUUID()
}

function snapshotFilenameFor(versionId: string): string {
  return `v-${versionId}.json`
}

async function readVersionsIndexRaw(root?: string): Promise<VersionsIndex | null> {
  const path = getVersionsPath(root)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return VersionsIndexSchema.parse(JSON.parse(raw))
}

async function writeVersionsIndex(index: VersionsIndex, root?: string): Promise<VersionsIndex> {
  const dir = getXomdaDir(root)
  await mkdir(dir, { recursive: true })
  await writeFile(getVersionsPath(root), JSON.stringify(index, null, 2), 'utf-8')
  return index
}

/**
 * Migrate legacy snapshot files (`<timestamp>.json` written by the old
 * `saveSnapshot` API) into a `versions.json` index. Idempotent — returns the
 * existing index untouched if `versions.json` already exists.
 */
async function migrateLegacySnapshots(root?: string): Promise<VersionsIndex> {
  const existing = await readVersionsIndexRaw(root)
  if (existing) return existing

  const historyDir = getHistoryDir(root)
  if (!existsSync(historyDir)) {
    return writeVersionsIndex(VersionsIndexSchema.parse({}), root)
  }

  // Pick up legacy timestamp-named snapshots (anything that's not v-<id>.json).
  const files = (await readdir(historyDir))
    .filter((f) => f.endsWith('.json') && !f.startsWith('v-'))
    .sort()

  const versions: Version[] = []
  let parent: string | null = null

  for (const filename of files) {
    const raw = await readFile(join(historyDir, filename), 'utf-8')
    let parsed: { timestamp?: string; label?: string; model?: unknown }
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    if (!parsed.model) continue

    const id = newVersionId()
    const newFilename = snapshotFilenameFor(id)
    const timestamp = parsed.timestamp ?? new Date().toISOString()
    const envelope = {
      versionId: id,
      timestamp,
      label: parsed.label ?? filename.replace(/\.json$/, ''),
      parent,
      model: parsed.model,
    }
    await writeFile(
      join(historyDir, newFilename),
      JSON.stringify(envelope, null, 2),
      'utf-8'
    )
    versions.push({
      id,
      label: envelope.label,
      parent,
      snapshotFilename: newFilename,
      timestamp,
    })
    parent = id
  }

  const index = VersionsIndexSchema.parse({
    head: parent,
    versions,
  })
  return writeVersionsIndex(index, root)
}

export async function readVersionsIndex(root?: string): Promise<VersionsIndex> {
  const existing = await readVersionsIndexRaw(root)
  if (existing) return existing
  return migrateLegacySnapshots(root)
}

export async function listVersions(root?: string): Promise<Version[]> {
  const index = await readVersionsIndex(root)
  return [...index.versions].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export async function getVersion(
  id: string,
  root?: string
): Promise<{ version: Version; model: Model }> {
  const index = await readVersionsIndex(root)
  const version = index.versions.find((v) => v.id === id)
  if (!version) {
    throw new Error(`Version ${id} not found`)
  }
  const path = join(getHistoryDir(root), version.snapshotFilename)
  const raw = await readFile(path, 'utf-8')
  const envelope = SnapshotEnvelopeSchema.parse(JSON.parse(raw))
  return { version, model: ModelSchema.parse(envelope.model) }
}

export async function commitVersion(
  args: { upcomingVersion: string; message?: string; author?: string },
  root?: string
): Promise<Version> {
  const index = await readVersionsIndex(root)
  const model = await readModel(root)
  const upcoming = args.upcomingVersion.trim()
  const validationError = validateUpcomingVersion(
    upcoming,
    model.version,
    index.versions.map((v) => v.label)
  )
  if (validationError) {
    throw new Error(validationError)
  }
  const id = newVersionId()
  const timestamp = new Date().toISOString()
  const filename = snapshotFilenameFor(id)
  const publishedModel: Model = { ...model, version: upcoming }
  const envelope = {
    versionId: id,
    timestamp,
    label: upcoming,
    message: args.message,
    author: args.author,
    parent: index.head,
    model: publishedModel,
  }
  await mkdir(getHistoryDir(root), { recursive: true })
  await writeFile(
    join(getHistoryDir(root), filename),
    JSON.stringify(envelope, null, 2),
    'utf-8'
  )
  await writeModel(ModelSchema.parse(publishedModel), root)
  const version: Version = {
    id,
    label: upcoming,
    message: args.message,
    author: args.author,
    parent: index.head,
    snapshotFilename: filename,
    timestamp,
  }
  const updated: VersionsIndex = {
    head: id,
    versions: [...index.versions, version],
  }
  await writeVersionsIndex(updated, root)
  return version
}
