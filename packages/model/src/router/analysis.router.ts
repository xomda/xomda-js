// Side-effect import: plugins self-subscribe into the registry.
import '@xomda/analysis-plugins'

import { resolve } from 'node:path'

import { getRegisteredAnalysisPlugins, ProjectAnalyzer } from '@xomda/analysis-core'
import { z } from 'zod'

import { publicProcedure, router } from './trpc'

const analyzer = new ProjectAnalyzer().registerAll(getRegisteredAnalysisPlugins())

export const analysisRouter = router({
  detect: publicProcedure
    .input(z.object({ path: z.string().default('.') }))
    .query(async ({ input }) => {
      // process.cwd() lazily — the node server chdirs to the repo root
      // after imports load, so a module-level capture would be wrong.
      const rootPath = resolve(process.cwd(), input.path)
      return analyzer.analyze(rootPath)
    }),

  listPlugins: publicProcedure.query(() => analyzer.listPlugins()),
})
