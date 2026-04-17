import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { TRPCError } from '@trpc/server'
import { XOMDA_DIR } from '@xomda/core'
import { z } from 'zod'

import { publicProcedure, router } from './trpc'

export const fileRouter = router({
  list: publicProcedure
    .input(
      z.object({
        path: z.string().default('.'),
        showHidden: z.boolean().default(false),
      })
    )
    .query(({ input }) => {
      const root = process.cwd()
      const dirPath = join(root, input.path)

      if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
        throw new Error('Directory not found')
      }

      const entries = readdirSync(dirPath, { withFileTypes: true })

      return entries
        .filter((entry) => input.showHidden || !entry.name.startsWith('.'))
        .map((entry) => {
          const fullPath = join(dirPath, entry.name)
          const stats = statSync(fullPath)
          const isDirectory = entry.isDirectory()
          const isXomdaDir = entry.name === XOMDA_DIR
          let isXomda = false

          if (isDirectory && !isXomdaDir) {
            isXomda = existsSync(join(fullPath, XOMDA_DIR))
          }

          return {
            name: entry.name,
            isDirectory,
            isXomda,
            isXomdaDir,
            isHidden: entry.name.startsWith('.'),
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            id: `${stats.gid}:${stats.ino}`,
          }
        })
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
    }),

  getStats: publicProcedure.input(z.string()).query(({ input }) => {
    const root = process.cwd()
    const filePath = join(root, input)

    if (!existsSync(filePath)) {
      throw new Error('File not found')
    }

    const stats = statSync(filePath)
    const isDirectory = stats.isDirectory()
    const name = input.split('/').pop() || input
    const isXomdaDir = name === XOMDA_DIR
    let isXomda = false

    if (isDirectory && !isXomdaDir) {
      isXomda = existsSync(join(filePath, XOMDA_DIR))
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
    const root = resolve(process.cwd())
    const filePath = resolve(root, input)

    if (!filePath.startsWith(`${root}/`) && filePath !== root) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Path escapes working directory' })
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'File not found' })
    }

    const content = await readFile(filePath, 'utf-8')
    return { content }
  }),
})
