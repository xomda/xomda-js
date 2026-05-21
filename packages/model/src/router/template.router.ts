import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ModelDiff, Template } from '@xomda/core'
import {
  defaultProjectSettings,
  diffModels,
  SelectorSchema,
  TemplateFolderSchema,
  TemplateSchema,
} from '@xomda/core'
import type { ProjectInfo, RenderResult, RenderWorkspace } from '@xomda/template'
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

import { resolveWriteTarget } from '../sandbox'
import { getVersion, listModels, readModel, readProjectMeta } from '../storage/file-storage'
import { publicProcedure, router } from './trpc'

const RecursiveFlag = z.object({ recursive: z.boolean().optional() })

/**
 * Build a writeRenderResults options object that routes writes through
 * the project's sandbox setting. Defaults to restrict-on when no
 * project.json exists yet.
 */
async function sandboxedWriteOptions(root: string) {
  const meta = await readProjectMeta(root)
  const settings = meta?.settings ?? defaultProjectSettings()
  return {
    root,
    resolveTarget: (candidate: string) => resolveWriteTarget(candidate, root, settings).path,
  }
}

function resolveRoot(input: { root?: string } | undefined): string {
  return input?.root ?? process.cwd()
}

/**
 * Build the workspace lens for a render. `allModels` is the active
 * project's models (used by the `models` loop source). `allProjects`
 * stays a singleton wrapping the active project unless the future
 * `recursive` flag bundles siblings — for now templates author across a
 * single project at a time.
 */
async function buildWorkspaceLens(root: string): Promise<RenderWorkspace> {
  const allModels = await listModels(root)
  const meta = await readProjectMeta(root).catch(() => null)
  const singleton: ProjectInfo = {
    root,
    name: meta?.name ?? 'project',
    isRoot: meta?.settings.isRoot ?? false,
    models: allModels,
  }
  return { allModels, allProjects: [singleton] }
}

export const templateRouter = router({
  list: publicProcedure
    .input(SelectorSchema.optional())
    .query(({ input }) => listTemplates(input?.root)),

  get: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, uuid: z.string().uuid() }))
    .query(({ input }) => readTemplate(input.uuid, input.root)),

  save: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, template: TemplateSchema }))
    .mutation(({ input }) => writeTemplate(input.template as Template, input.root)),

  delete: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, uuid: z.string().uuid() }))
    .mutation(({ input }) => deleteTemplate(input.uuid, input.root)),

  listFolders: publicProcedure
    .input(SelectorSchema.optional())
    .query(({ input }) => listTemplateFolders(input?.root)),

  saveFolder: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, folder: TemplateFolderSchema }))
    .mutation(({ input }) => saveTemplateFolder(input.folder, input.root)),

  move: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, uuid: z.string().uuid(), folder: z.string() }))
    .mutation(({ input }) => moveTemplate(input.uuid, input.folder, input.root)),

  moveFolder: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, from: z.string(), to: z.string() }))
    .mutation(({ input }) => moveTemplateFolder(input.from, input.to, input.root)),

  deleteFolder: publicProcedure
    .input(z.object({ ...SelectorSchema.shape, path: z.string().min(1) }))
    .mutation(({ input }) => deleteTemplateFolder(input.path, input.root)),

  preview: publicProcedure.input(SelectorSchema.optional()).query(async ({ input }) => {
    const root = resolveRoot(input)
    const model = await readModel(root, input?.modelId)
    const templates = (await listTemplates(root)).filter((t) => !t.disabled)
    const workspace = await buildWorkspaceLens(root)
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...(await renderTemplateByScope(template, model, undefined, workspace)))
    }
    return allResults
  }),

  generate: publicProcedure
    .input(SelectorSchema.merge(RecursiveFlag).optional())
    .mutation(async ({ input }) => {
      const root = resolveRoot(input)
      const model = await readModel(root, input?.modelId)
      const templates = (await listTemplates(root)).filter((t) => !t.disabled)
      const workspace = await buildWorkspaceLens(root)
      const allResults: RenderResult[] = []
      for (const template of templates) {
        allResults.push(...(await renderTemplateByScope(template, model, undefined, workspace)))
      }
      await writeRenderResults(allResults, await sandboxedWriteOptions(root))
      // `recursive` input is reserved for Phase 7 — when implemented, the
      // router fans out across discovered subprojects. Today it's a
      // no-op so the wire format settles ahead of the implementation.
      void input?.recursive
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
        ...SelectorSchema.shape,
        beforeVersionId: z.string().uuid(),
        afterVersionId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input }) => {
      const root = resolveRoot(input)
      const before = await getVersion(input.beforeVersionId)
      const after = input.afterVersionId
        ? (await getVersion(input.afterVersionId)).model
        : await readModel(root, input.modelId)
      const diff: ModelDiff = diffModels(before.model, after)
      const templates = (await listTemplates(root)).filter((t) => !t.disabled)
      const workspace = await buildWorkspaceLens(root)
      const allResults: RenderResult[] = []
      for (const template of templates) {
        allResults.push(...(await renderTemplateByScope(template, after, diff, workspace)))
      }
      return allResults
    }),

  generateWithDiff: publicProcedure
    .input(
      z.object({
        ...SelectorSchema.shape,
        ...RecursiveFlag.shape,
        beforeVersionId: z.string().uuid(),
        afterVersionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const root = resolveRoot(input)
      const before = await getVersion(input.beforeVersionId)
      const after = input.afterVersionId
        ? (await getVersion(input.afterVersionId)).model
        : await readModel(root, input.modelId)
      const diff: ModelDiff = diffModels(before.model, after)
      const templates = (await listTemplates(root)).filter((t) => !t.disabled)
      const workspace = await buildWorkspaceLens(root)
      const allResults: RenderResult[] = []
      for (const template of templates) {
        allResults.push(...(await renderTemplateByScope(template, after, diff, workspace)))
      }
      await writeRenderResults(allResults, await sandboxedWriteOptions(root))
      void input.recursive
      return allResults
    }),

  getDiff: publicProcedure.input(SelectorSchema.optional()).query(async ({ input }) => {
    const root = resolveRoot(input)
    const model = await readModel(root, input?.modelId)
    const templates = (await listTemplates(root)).filter((t) => !t.disabled)
    const workspace = await buildWorkspaceLens(root)
    const allResults: RenderResult[] = []
    for (const template of templates) {
      allResults.push(...(await renderTemplateByScope(template, model, undefined, workspace)))
    }
    return Promise.all(
      allResults.map(async (result) => {
        const fullPath = join(root, result.outputPath)
        const current = existsSync(fullPath) ? await readFile(fullPath, 'utf-8') : null
        return { outputPath: result.outputPath, generated: result.content, current }
      })
    )
  }),
})
