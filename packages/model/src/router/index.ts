import { analysisRouter } from './analysis.router'
import { fileRouter } from './file.router'
import { handlebarsTemplateRouter } from './handlebarsTemplate.router'
import { modelRouter } from './model.router'
import { templatePPRouter } from './templatePP.router'
import { router } from './trpc'

export const appRouter = router({
  analysis: analysisRouter,
  model: modelRouter,
  template: templatePPRouter,
  handlebarsTemplate: handlebarsTemplateRouter,
  file: fileRouter,
})

export type AppRouter = typeof appRouter
