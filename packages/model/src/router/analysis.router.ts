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
      // process.cwd() lazily — the dev/start scripts `cd ../..` to the
      // workspace root before launching tsx, so a module-level capture
      // would freeze cwd at whatever it was during import resolution.
      const rootPath = resolve(process.cwd(), input.path)
      return analyzer.analyze(rootPath)
    }),

  listPlugins: publicProcedure.query(() => analyzer.listPlugins()),
})
