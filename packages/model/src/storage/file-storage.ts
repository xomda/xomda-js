import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import {
  type Model,
  MODEL_FILE,
  ModelSchema,
  type ModelStorage,
  type ProjectFile,
  ProjectFileSchema,
  SnapshotEnvelopeSchema,
  validateUpcomingVersion,
  type Version,
  type VersionsIndex,
  VersionsIndexSchema,
  XOMDA_DIR,
} from '@xomda/core'

const VERSIONS_FILE = 'versions.json'
const PROJECT_FILE = 'project.json'
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

export function getProjectPath(root = process.cwd()): string {
  return join(getXomdaDir(root), PROJECT_FILE)
}

/**
 * Read .xomda/project.json. Returns null if the file does not exist —
 * callers decide whether to fall back to legacy versions.json or synthesize.
 */
export async function readProjectMeta(root?: string): Promise<ProjectFile | null> {
  const path = getProjectPath(root)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return ProjectFileSchema.parse(JSON.parse(raw))
}

/**
 * Write .xomda/project.json. Re-parses through the schema so defaults are
 * materialized and unknown keys are preserved.
 */
export async function saveProjectMeta(meta: ProjectFile, root?: string): Promise<ProjectFile> {
  const dir = getXomdaDir(root)
  await mkdir(dir, { recursive: true })
  const validated = ProjectFileSchema.parse(meta)
  await writeFile(getProjectPath(root), JSON.stringify(validated, null, 2), 'utf-8')
  return validated
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function isModelUnchanged(a: Model, b: Model): boolean {
  const { updatedAt: _a, ...restA } = a
  const { updatedAt: _b, ...restB } = b
  return stableStringify(restA) === stableStringify(restB)
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

/**
 * One-time migration: if .xomda/project.json is missing but versions.json
 * exists, synthesize project.json (name = folder basename), then remove
 * the old versions.json. Returns the resulting project metadata, or null
 * when there is nothing to migrate.
 */
async function migrateVersionsIntoProjectFile(
  root: string | undefined,
  versions: VersionsIndex
): Promise<ProjectFile> {
  const projectName = basename(root ?? process.cwd()) || 'project'
  const meta = await saveProjectMeta(ProjectFileSchema.parse({ name: projectName, versions }), root)
  const legacy = getVersionsPath(root)
  if (existsSync(legacy)) {
    await rm(legacy, { force: true })
  }
  return meta
}

async function writeVersionsIndex(index: VersionsIndex, root?: string): Promise<VersionsIndex> {
  const existing = await readProjectMeta(root)
  if (existing) {
    await saveProjectMeta({ ...existing, versions: index }, root)
    return index
  }
  await migrateVersionsIntoProjectFile(root, index)
  return index
}

/**
 * Migrate legacy snapshot files (`<timestamp>.json` written by the old
 * `saveSnapshot` API) into the project.json versions index. Only called
 * when no versions index exists yet (project.json + legacy versions.json
 * both absent).
 */
async function migrateLegacySnapshots(root?: string): Promise<VersionsIndex> {
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
    await writeFile(join(historyDir, newFilename), JSON.stringify(envelope, null, 2), 'utf-8')
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
  // project.json (current source of truth) wins
  const project = await readProjectMeta(root)
  if (project) return project.versions

  // legacy versions.json → migrate into project.json, then delete it
  const legacyVersions = await readLegacyVersionsFile(root)
  if (legacyVersions) {
    const meta = await migrateVersionsIntoProjectFile(root, legacyVersions)
    return meta.versions
  }

  // no versions anywhere: scan the history dir for legacy snapshots
  return migrateLegacySnapshots(root)
}

async function readLegacyVersionsFile(root?: string): Promise<VersionsIndex | null> {
  const path = getVersionsPath(root)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf-8')
  return VersionsIndexSchema.parse(JSON.parse(raw))
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
  await writeFile(join(getHistoryDir(root), filename), JSON.stringify(envelope, null, 2), 'utf-8')
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
