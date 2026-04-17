import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ModelDiff, Template } from '@xomda/core'
import { diffModels, TemplateFolderSchema, TemplateSchema } from '@xomda/core'
import type { RenderResult } from '@xomda/template'
import {
  deleteTemplate,
  deleteTemplateFolder,
  listTemplateFolders,
  listTemplates,
  moveTemplate,
  moveTemplateFolder,
  readTemplate,
  renderTemplateByScope,
  saveTemplateFolder,
  writeRenderResults,
  writeTemplate,
} from '@xomda/template'
import { z } from 'zod'

import { getVersion, readModel } from '../storage/file-storage'
import { publicProcedure, router } from './trpc'

export const templateRouter = router({
  list: publicProcedure.query(() => listTemplates()),

  get: publicProcedure.input(z.string().uuid()).query(({ input }) => readTemplate(input)),

  save: publicProcedure
    .input(TemplateSchema)
    .mutation(({ input }) => writeTemplate(input as Template)),

  delete: publicProcedure.input(z.string().uuid()).mutation(({ input }) => deleteTemplate(input)),

  listFolders: publicProcedure.query(() => listTemplateFolders()),

  saveFolder: publicProcedure
    .input(TemplateFolderSchema)
    .mutation(({ input }) => saveTemplateFolder(input)),

  move: publicProcedure
    .input(z.object({ uuid: z.string().uuid(), folder: z.string() }))
    .mutation(({ input }) => moveTemplate(input.uuid, input.folder)),

  moveFolder: publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(({ input }) => moveTemplateFolder(input.from, input.to)),

  deleteFolder: publicProcedure
    .input(z.object({ path: z.string().min(1) }))
    .mutation(({ input }) => deleteTemplateFolder(input.path)),

  preview: publicProcedure.query(async () => {
    const model = await readModel()
    const templates = (await listTemplates()).filter((t) => !t.disabled)
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...(await renderTemplateByScope(template, model)))
    }
    return allResults
  }),

  generate: publicProcedure.mutation(async () => {
    const model = await readModel()
    const templates = (await listTemplates()).filter((t) => !t.disabled)
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...(await renderTemplateByScope(template, model)))
    }
    await writeRenderResults(allResults)
    return allResults
  }),

  /**
   * Render templates with a `ModelDiff` between two versions threaded into
   * the template execution context. `afterVersionId` defaults to the current
   * working model.
   */
  previewWithDiff: publicProcedure
    .input(
      z.object({
        beforeVersionId: z.string().uuid(),
        afterVersionId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input }) => {
      const before = await getVersion(input.beforeVersionId)
      const after = input.afterVersionId
        ? (await getVersion(input.afterVersionId)).model
        : await readModel()
      const diff: ModelDiff = diffModels(before.model, after)
      const templates = (await listTemplates()).filter((t) => !t.disabled)
      const allResults: RenderResult[] = []
      for (const template of templates) {
        allResults.push(...(await renderTemplateByScope(template, after, diff)))
      }
      return allResults
    }),

  generateWithDiff: publicProcedure
    .input(
      z.object({
        beforeVersionId: z.string().uuid(),
        afterVersionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const before = await getVersion(input.beforeVersionId)
      const after = input.afterVersionId
        ? (await getVersion(input.afterVersionId)).model
        : await readModel()
      const diff: ModelDiff = diffModels(before.model, after)
      const templates = (await listTemplates()).filter((t) => !t.disabled)
      const allResults: RenderResult[] = []
      for (const template of templates) {
        allResults.push(...(await renderTemplateByScope(template, after, diff)))
      }
      await writeRenderResults(allResults)
      return allResults
    }),

  getDiff: publicProcedure.query(async () => {
    const model = await readModel()
    const templates = (await listTemplates()).filter((t) => !t.disabled)
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...(await renderTemplateByScope(template, model)))
    }
    return Promise.all(
      allResults.map(async (result) => {
        const fullPath = join(process.cwd(), result.outputPath)
        const current = existsSync(fullPath) ? await readFile(fullPath, 'utf-8') : null
        return { outputPath: result.outputPath, generated: result.content, current }
      })
    )
  }),
})
