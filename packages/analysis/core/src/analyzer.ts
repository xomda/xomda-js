import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { AnalysisContext, AnalysisPlugin, AnalysisResult, DetectedFeature } from './types'

export class ProjectAnalyzer {
  private readonly plugins: AnalysisPlugin[] = []

  register(plugin: AnalysisPlugin): this {
    this.plugins.push(plugin)
    return this
  }

  listPlugins(): Array<{ id: string; name: string }> {
    return this.plugins.map(({ id, name }) => ({ id, name }))
  }

  async analyze(rootPath: string): Promise<AnalysisResult> {
    const fileExistsCache = new Map<string, boolean>()
    const context: AnalysisContext = {
      rootPath,
      fileExists: (relativePath) => {
        const cached = fileExistsCache.get(relativePath)
        if (cached !== undefined) return cached
        const result = existsSync(join(rootPath, relativePath))
        fileExistsCache.set(relativePath, result)
        return result
      },
      listFiles: (relativePath = '.') => {
        try {
          return readdirSync(join(rootPath, relativePath))
        } catch {
          return []
        }
      },
      readFile: async (relativePath) => {
        try {
          return await readFile(join(rootPath, relativePath), 'utf-8')
        } catch {
          return null
        }
      },
    }

    const contentPaths = new Set<string>()
    for (const plugin of this.plugins) {
      for (const pattern of plugin.patterns ?? []) {
        if (pattern.type === 'file-content') contentPaths.add(pattern.path)
      }
    }

    const contentCache = new Map<string, string | null>()
    await Promise.all(
      [...contentPaths].map(async (path) => {
        contentCache.set(path, await context.readFile(path))
      })
    )

    const detectionResults = await Promise.all(
      this.plugins.map(async (plugin): Promise<DetectedFeature | null> => {
        let detected = false

        if (plugin.detect) {
          detected = await plugin.detect(context)
        } else {
          for (const pattern of plugin.patterns ?? []) {
            if (detected) break

            if (pattern.type === 'file-exists') {
              detected = pattern.paths.some((p) => context.fileExists(p))
            } else if (pattern.type === 'file-content') {
              const content = contentCache.get(pattern.path)
              if (content != null) {
                detected =
                  typeof pattern.match === 'string'
                    ? content.includes(pattern.match)
                    : pattern.match.test(content)
              }
            }
          }
        }

        return detected ? { pluginId: plugin.id, name: plugin.name } : null
      })
    )

    return {
      rootPath,
      features: detectionResults.filter((f): f is DetectedFeature => f !== null),
      analyzedAt: new Date().toISOString(),
    }
  }
}
