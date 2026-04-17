import { analysisRouter } from './analysis.router'
import { fileRouter } from './file.router'
import { modelRouter } from './model.router'
import { projectRouter } from './project.router'
import { templateRouter } from './template.router'
import { router } from './trpc'

export const appRouter = router({
  analysis: analysisRouter,
  model: modelRouter,
  project: projectRouter,
  template: templateRouter,
  file: fileRouter,
})

export type AppRouter = typeof appRouter
