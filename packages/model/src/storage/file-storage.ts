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
const MODELS_DIR = 'models'
const SECONDARY_MODEL_EXT = '.json'

export function getXomdaDir(root = process.cwd()): string {
  return join(root, XOMDA_DIR)
}

export function getModelPath(root = process.cwd()): string {
  return join(getXomdaDir(root), MODEL_FILE)
}

/** Directory holding secondary models (`.xomda/models/<id>.json`). Created lazily. */
export function getModelsDir(root = process.cwd()): string {
  return join(getXomdaDir(root), MODELS_DIR)
}

function getSecondaryModelPath(root: string, modelId: string): string {
  return join(getModelsDir(root), `${modelId}${SECONDARY_MODEL_EXT}`)
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
 * Best-effort read of the primary model's `id` (the UUID stored inside
 * `.xomda/model.json`). Returns null when the file is missing or malformed —
 * callers fall back to "no primary id known" semantics.
 *
 * Cheap enough to call per resolve (small file, parsed once); not worth a
 * cache layer at workspace scale.
 */
async function readPrimaryModelId(root: string): Promise<string | null> {
  const path = getModelPath(root)
  if (!existsSync(path)) return null
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as { id?: unknown }
    return typeof parsed.id === 'string' ? parsed.id : null
  } catch {
    return null
  }
}

/**
 * Resolve which file on disk backs the given `modelId`:
 *   - `modelId` undefined → the primary at `.xomda/model.json`.
 *   - `modelId` matches the primary's id → the primary file.
 *   - Otherwise → a secondary at `.xomda/models/<modelId>.json`.
 *
 * `exists` is true iff the resolved file is present on disk; callers use it
 * to decide between read-fallback (defaults) and write-allowed.
 */
async function resolveModelPath(
  root: string,
  modelId?: string
): Promise<{ path: string; isPrimary: boolean; exists: boolean }> {
  if (modelId === undefined) {
    const path = getModelPath(root)
    return { path, isPrimary: true, exists: existsSync(path) }
  }
  const primaryId = await readPrimaryModelId(root)
  if (primaryId !== null && primaryId === modelId) {
    return { path: getModelPath(root), isPrimary: true, exists: true }
  }
  const secondaryPath = getSecondaryModelPath(root, modelId)
  return { path: secondaryPath, isPrimary: false, exists: existsSync(secondaryPath) }
}

/**
 * Create a `ModelStorage` backed by a JSON file under `.xomda/`.
 *
 * - When `modelId` is omitted, reads/writes the **primary** model at
 *   `.xomda/model.json`.
 * - When `modelId` is supplied, resolves through the primary-vs-secondary
 *   lookup (`resolveModelPath`) so callers don't have to know which file
 *   backs which UUID.
 */
export function createFileStorage(root = process.cwd(), modelId?: string): ModelStorage {
  return {
    async read() {
      const { path, exists } = await resolveModelPath(root, modelId)
      if (!exists) {
        return ModelSchema.parse({})
      }
      const raw = await readFile(path, 'utf-8')
      return ModelSchema.parse(JSON.parse(raw))
    },
    async write(model) {
      const resolved = await resolveModelPath(root, modelId)
      // Reject writes that would create a stray secondary file out of
      // thin air. `createSecondaryModel` is the only sanctioned entry
      // for introducing a new id; this prevents stale tabs racing a
      // delete from re-materialising the model.
      if (!resolved.exists && modelId !== undefined && !resolved.isPrimary) {
        throw new ModelNotFoundError(modelId, root)
      }
      // Reject writes that would mint a secondary file whose id collides
      // with the primary's id. The id is the model's identity; collisions
      // make listModels nondeterministic.
      if (modelId !== undefined && !resolved.isPrimary && modelId === model.id) {
        const primaryId = await readPrimaryModelId(root)
        if (primaryId !== null && primaryId === modelId) {
          throw new ModelIdCollisionError(modelId, root)
        }
      }
      const targetDir = resolved.isPrimary ? getXomdaDir(root) : getModelsDir(root)
      if (resolved.exists) {
        const existing = ModelSchema.parse(JSON.parse(await readFile(resolved.path, 'utf-8')))
        if (isModelUnchanged(existing, model)) {
          return existing
        }
      }
      await mkdir(targetDir, { recursive: true })
      const updated: Model = { ...model, updatedAt: new Date().toISOString() }
      await writeFile(resolved.path, JSON.stringify(updated, null, 2), 'utf-8')
      return updated
    },
  }
}

export const readModel = (root?: string, modelId?: string): Promise<Model> =>
  createFileStorage(root, modelId).read()

export const writeModel = (model: Model, root?: string, modelId?: string): Promise<Model> =>
  createFileStorage(root, modelId).write(model)

// ─── Multi-model API ──────────────────────────────────────────────────────────

/**
 * Typed errors thrown by the multi-model layer. The model router rewraps
 * these as `BAD_REQUEST` / `NOT_FOUND` so the client gets a discriminable
 * message rather than a generic server crash.
 */
export class ModelNotFoundError extends Error {
  constructor(
    public readonly modelId: string,
    public readonly root: string
  ) {
    super(`Model ${modelId} not found under ${root}`)
    this.name = 'ModelNotFoundError'
  }
}

export class ModelIdCollisionError extends Error {
  constructor(
    public readonly modelId: string,
    public readonly root: string
  ) {
    super(
      `Secondary model id ${modelId} collides with primary at ${root}/${XOMDA_DIR}/${MODEL_FILE}`
    )
    this.name = 'ModelIdCollisionError'
  }
}

export class PrimaryModelDeletionError extends Error {
  constructor(
    public readonly root: string,
    public readonly secondaryCount: number
  ) {
    super(
      `Refusing to delete the primary model at ${root}: ${secondaryCount} secondary model(s) would be orphaned`
    )
    this.name = 'PrimaryModelDeletionError'
  }
}

/**
 * Read every model under `root`: the primary at `.xomda/model.json` (if
 * present) plus every `.xomda/models/<id>.json`. The result is ordered
 * primary-first, secondaries sorted by `name` then `id`. Duplicate ids
 * (e.g. a secondary file whose id matches the primary's) are deduped —
 * the primary wins.
 *
 * The list is empty when no `model.json` exists and the `models/` folder
 * is absent — i.e. a fresh project that has never been touched.
 */
export async function listModels(root = process.cwd()): Promise<Model[]> {
  const collected: Model[] = []
  const seenIds = new Set<string>()

  const primaryPath = getModelPath(root)
  if (existsSync(primaryPath)) {
    try {
      const raw = await readFile(primaryPath, 'utf-8')
      const primary = ModelSchema.parse(JSON.parse(raw))
      collected.push(primary)
      seenIds.add(primary.id)
    } catch (e) {
      // A malformed primary is a workspace-level problem; surface it
      // rather than silently swallow.
      throw new Error(
        `Failed to parse primary model at ${primaryPath}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e }
      )
    }
  }

  const modelsDir = getModelsDir(root)
  if (existsSync(modelsDir)) {
    const entries = await readdir(modelsDir, { withFileTypes: true })
    const secondaries: Model[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(SECONDARY_MODEL_EXT)) continue
      const filePath = join(modelsDir, entry.name)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const parsed = ModelSchema.parse(JSON.parse(raw))
        if (seenIds.has(parsed.id)) continue // primary wins on collision
        secondaries.push(parsed)
        seenIds.add(parsed.id)
      } catch {
        // Skip unparseable secondaries silently — one bad file should
        // not blank the whole selector.
      }
    }
    secondaries.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    collected.push(...secondaries)
  }

  return collected
}

/**
 * Lightweight descriptor of a Model: the fields the selector menu needs,
 * without paying to load entire model trees. `isPrimary` is true for the
 * single model backed by `.xomda/model.json`.
 */
export interface ModelDescriptor {
  id: string
  name: string
  version: string
  updatedAt?: string
  isPrimary: boolean
}

/** Project models as lightweight descriptors. Calls `listModels` under the hood. */
export async function listModelDescriptors(root = process.cwd()): Promise<ModelDescriptor[]> {
  const models = await listModels(root)
  return models.map((m, i) => ({
    id: m.id,
    name: m.name,
    version: m.version,
    ...(m.updatedAt !== undefined ? { updatedAt: m.updatedAt } : {}),
    isPrimary: i === 0 && existsSync(getModelPath(root)),
  }))
}

/**
 * Create a new secondary model under `.xomda/models/<id>.json`. The model
 * gets a fresh UUID and is timestamped by the underlying storage write.
 *
 * Throws `ModelIdCollisionError` if (vanishingly unlikely) `crypto.randomUUID`
 * generates an id already in use by the primary.
 */
export async function createSecondaryModel(
  root: string,
  draft: { name: string; version?: string } = { name: 'Untitled Model' }
): Promise<Model> {
  const id = crypto.randomUUID()
  const primaryId = await readPrimaryModelId(root)
  if (primaryId === id) {
    throw new ModelIdCollisionError(id, root)
  }
  const initial = ModelSchema.parse({
    id,
    name: draft.name,
    version: draft.version ?? '1.0.0',
    packages: [],
  })
  const path = getSecondaryModelPath(root, id)
  await mkdir(getModelsDir(root), { recursive: true })
  const stamped: Model = { ...initial, updatedAt: new Date().toISOString() }
  await writeFile(path, JSON.stringify(stamped, null, 2), 'utf-8')
  return stamped
}

/**
 * Rename a model in place. Re-writes the file with the new name (and a
 * fresh `updatedAt`). Idempotent: if the name is unchanged, no write
 * happens — preserves mtime + bytes.
 */
export async function renameModel(root: string, modelId: string, newName: string): Promise<Model> {
  const resolved = await resolveModelPath(root, modelId)
  if (!resolved.exists) {
    throw new ModelNotFoundError(modelId, root)
  }
  const existing = ModelSchema.parse(JSON.parse(await readFile(resolved.path, 'utf-8')))
  if (existing.name === newName) {
    return existing
  }
  return writeModel({ ...existing, name: newName }, root, modelId)
}

/**
 * Delete a model. Refuses to delete the primary if any secondary models
 * exist (they would be orphaned — the project's identity lives in the
 * primary's id). Deleting the only remaining model is allowed.
 */
export async function deleteModel(root: string, modelId: string): Promise<void> {
  const resolved = await resolveModelPath(root, modelId)
  if (!resolved.exists) {
    throw new ModelNotFoundError(modelId, root)
  }
  if (resolved.isPrimary) {
    const all = await listModels(root)
    const secondaryCount = all.length - 1 // primary itself counted once
    if (secondaryCount > 0) {
      throw new PrimaryModelDeletionError(root, secondaryCount)
    }
  }
  await rm(resolved.path, { force: true })
}

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
