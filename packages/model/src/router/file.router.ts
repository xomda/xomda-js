import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, resolve, sep } from 'node:path'

import { TRPCError } from '@trpc/server'
import { XOMDA_DIR } from '@xomda/core'
import { z } from 'zod'

import { publicProcedure, router } from './trpc'

/**
 * Resolve `inputPath` against the working-directory root and reject any path
 * that escapes it (`..`, absolute paths to elsewhere). Returns the absolute
 * resolved path on success; throws TRPCError(FORBIDDEN) otherwise.
 */
function resolveWithinCwd(inputPath: string): { root: string; resolved: string } {
  const root = resolve(process.cwd())
  const resolved = resolve(root, inputPath)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Path escapes working directory' })
  }
  return { root, resolved }
}

export const fileRouter = router({
  list: publicProcedure
    .input(
      z.object({
        path: z.string().default('.'),
        showHidden: z.boolean().default(false),
      })
    )
    .query(({ input }) => {
      const { resolved: dirPath } = resolveWithinCwd(input.path)

      if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Directory not found' })
      }

      const entries = readdirSync(dirPath, { withFileTypes: true })

      return entries
        .filter((entry) => input.showHidden || !entry.name.startsWith('.'))
        .map((entry) => {
          const fullPath = resolve(dirPath, entry.name)
          const stats = statSync(fullPath)
          const isDirectory = entry.isDirectory()
          const isXomdaDir = entry.name === XOMDA_DIR
          let isXomda = false

          if (isDirectory && !isXomdaDir) {
            isXomda = existsSync(resolve(fullPath, XOMDA_DIR))
          }

          return {
            name: entry.name,
            isDirectory,
            isXomda,
            isXomdaDir,
            isHidden: entry.name.startsWith('.'),
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            id: `${stats.dev}:${stats.ino}`,
          }
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
    }),

  getStats: publicProcedure.input(z.string()).query(({ input }) => {
    const { resolved: filePath } = resolveWithinCwd(input)

    if (!existsSync(filePath)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' })
    }

    const stats = statSync(filePath)
    const isDirectory = stats.isDirectory()
    const name = basename(filePath) || input
    const isXomdaDir = name === XOMDA_DIR
    let isXomda = false

    if (isDirectory && !isXomdaDir) {
      isXomda = existsSync(resolve(filePath, XOMDA_DIR))
    }

    return {
      name,
      path: input,
      isDirectory,
      isXomda,
      isXomdaDir,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      atime: stats.atime.toISOString(),
      ctime: stats.ctime.toISOString(),
      birthtime: stats.birthtime.toISOString(),
    }
  }),

  read: publicProcedure.input(z.string()).query(async ({ input }) => {
    const { resolved: filePath } = resolveWithinCwd(input)

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' })
    }

    const content = await readFile(filePath, 'utf-8')
    return { content }
  }),

  /**
   * Read raw bytes, base64-encoded, capped at `maxBytes`. Used by binary
   * (HexView) and image previews.
   */
  readBytes: publicProcedure
    .input(z.object({ path: z.string(), maxBytes: z.number().int().positive().default(65_536) }))
    .query(async ({ input }) => {
      const { resolved: filePath } = resolveWithinCwd(input.path)
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' })
      }
      const fullBuffer = await readFile(filePath)
      const truncated = fullBuffer.length > input.maxBytes
      const buffer = truncated ? fullBuffer.subarray(0, input.maxBytes) : fullBuffer
      return {
        base64: buffer.toString('base64'),
        size: fullBuffer.length,
        truncated,
      }
    }),
})
