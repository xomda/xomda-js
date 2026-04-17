import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { type Model, MODEL_FILE, ModelSchema, type ModelStorage, XOMDA_DIR } from '@xomda/core'

export function getXomdaDir(root = process.cwd()): string {
  return join(root, XOMDA_DIR)
}

export function getModelPath(root = process.cwd()): string {
  return join(getXomdaDir(root), MODEL_FILE)
}

/**
 * Create a `ModelStorage` backed by a JSON file at `<root>/<XOMDA_DIR>/<MODEL_FILE>`.
 * The model is parsed through `ModelSchema` on every read and write so defaults
 * and invariants are always applied.
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
      await mkdir(dir, { recursive: true })
      const updated: Model = { ...model, updatedAt: new Date().toISOString() }
      await writeFile(getModelPath(root), JSON.stringify(updated, null, 2), 'utf-8')
      return updated
    },
  }
}

// `root` defaults to `process.cwd()` evaluated at call time — important when
// the host process changes its working directory after module load (e.g. the
// node server's `process.chdir('../../')` in packages/node/src/index.ts).
export const readModel = (root?: string): Promise<Model> => createFileStorage(root).read()

export const writeModel = (model: Model, root?: string): Promise<Model> =>
  createFileStorage(root).write(model)

function getHistoryDir(root = process.cwd()): string {
  return join(getXomdaDir(root), 'history')
}

export async function saveSnapshot(label: string, root?: string): Promise<string> {
  const model = await readModel(root)
  const historyDir = getHistoryDir(root)
  await mkdir(historyDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${timestamp}.json`
  const snapshot = { timestamp: new Date().toISOString(), label, model }
  await writeFile(join(historyDir, filename), JSON.stringify(snapshot, null, 2), 'utf-8')
  return filename
}

export async function listSnapshots(
  root?: string
): Promise<Array<{ filename: string; timestamp: string; label: string }>> {
  const historyDir = getHistoryDir(root)
  if (!existsSync(historyDir)) return []
  const files = (await readdir(historyDir))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
  return Promise.all(
    files.map(async (filename) => {
      const raw = await readFile(join(historyDir, filename), 'utf-8')
      const { timestamp, label } = JSON.parse(raw)
      return { filename, timestamp, label }
    })
  )
}

export async function readSnapshot(filename: string, root?: string): Promise<Model> {
  const historyDir = getHistoryDir(root)
  const raw = await readFile(join(historyDir, filename), 'utf-8')
  const { model } = JSON.parse(raw)
  return ModelSchema.parse(model)
}
