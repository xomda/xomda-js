import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { HandlebarsTemplate, HandlebarsTemplateFolder, RenderResult } from '@xomda/template'
import {
  deleteHandlebarsTemplate,
  HandlebarsTemplateFolderSchema,
  HandlebarsTemplateSchema,
  listHandlebarsTemplateFolders,
  listHandlebarsTemplates,
  moveHandlebarsTemplate,
  moveHandlebarsTemplateFolder,
  readHandlebarsTemplate,
  renderHandlebarsTemplateByScope,
  saveHandlebarsTemplateFolder,
  writeHandlebarsTemplate,
  writeRenderResults,
} from '@xomda/template'
import { z } from 'zod'

import { readModel } from '../storage/file-storage'
import { publicProcedure, router } from './trpc'

export const handlebarsTemplateRouter = router({
  list: publicProcedure.query(() => listHandlebarsTemplates()),

  get: publicProcedure.input(z.string()).query(({ input }) => readHandlebarsTemplate(input)),

  save: publicProcedure
    .input(HandlebarsTemplateSchema)
    .mutation(({ input }) => writeHandlebarsTemplate(input as HandlebarsTemplate)),

  delete: publicProcedure
    .input(z.string())
    .mutation(({ input }) => deleteHandlebarsTemplate(input)),

  move: publicProcedure
    .input(z.object({ oldPath: z.string(), newPath: z.string() }))
    .mutation(({ input }) => moveHandlebarsTemplate(input.oldPath, input.newPath)),

  moveFolder: publicProcedure
    .input(z.object({ oldPath: z.string(), newPath: z.string() }))
    .mutation(({ input }) => moveHandlebarsTemplateFolder(input.oldPath, input.newPath)),

  listFolders: publicProcedure.query(() => listHandlebarsTemplateFolders()),

  saveFolder: publicProcedure
    .input(HandlebarsTemplateFolderSchema)
    .mutation(({ input }) => saveHandlebarsTemplateFolder(input as HandlebarsTemplateFolder)),

  generate: publicProcedure.mutation(async () => {
    const model = await readModel()
    const templates = await listHandlebarsTemplates()
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...renderHandlebarsTemplateByScope(template, model))
    }
    await writeRenderResults(allResults)
    return allResults
  }),

  preview: publicProcedure.query(async () => {
    const model = await readModel()
    const templates = await listHandlebarsTemplates()
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...renderHandlebarsTemplateByScope(template, model))
    }
    return allResults
  }),

  getDiff: publicProcedure.query(async () => {
    const model = await readModel()
    const templates = await listHandlebarsTemplates()
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...renderHandlebarsTemplateByScope(template, model))
    }
    return Promise.all(
      allResults.map(async (result) => {
        const fullPath = join(process.cwd(), result.outputPath)
        const current = existsSync(fullPath) ? await readFile(fullPath, 'utf-8') : null
        return { outputPath: result.outputPath, generated: result.content, current }
      })
    )
  }),

  promote: publicProcedure
    .input(z.array(z.string()).optional())
    .mutation(async ({ input: paths }) => {
      const model = await readModel()
      const templates = await listHandlebarsTemplates()
      const allResults: RenderResult[] = []
      for (const template of templates) {
        allResults.push(...renderHandlebarsTemplateByScope(template, model))
      }
      const toWrite = paths?.length
        ? allResults.filter((r) => paths.includes(r.outputPath))
        : allResults
      await writeRenderResults(toWrite)
      return toWrite.map((r) => r.outputPath)
    }),
})
