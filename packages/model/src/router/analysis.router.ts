import { resolve } from 'node:path'

import { ProjectAnalyzer } from '@xomda/analysis-core'
import { antPlugin } from '@xomda/plugin-analysis-ant'
import { eslintPlugin } from '@xomda/plugin-analysis-eslint'
import { gradlePlugin } from '@xomda/plugin-analysis-gradle'
import { intellijPlugin } from '@xomda/plugin-analysis-intellij'
import { mavenPlugin } from '@xomda/plugin-analysis-maven'
import { prettierPlugin } from '@xomda/plugin-analysis-prettier'
import { rustPlugin } from '@xomda/plugin-analysis-rust'
import { stylelintPlugin } from '@xomda/plugin-analysis-stylelint'
import { typescriptPlugin } from '@xomda/plugin-analysis-typescript'
import { visualStudioPlugin } from '@xomda/plugin-analysis-visualstudio'
import { vitePlugin } from '@xomda/plugin-analysis-vite'
import { vscodePlugin } from '@xomda/plugin-analysis-vscode'
import { webpackPlugin } from '@xomda/plugin-analysis-webpack'
import { xomdaPlugin } from '@xomda/plugin-analysis-xomda'
import { z } from 'zod'

import { publicProcedure, router } from './trpc'

const cwd = process.cwd()

const analyzer = new ProjectAnalyzer()
  .register(xomdaPlugin)
  .register(typescriptPlugin)
  .register(eslintPlugin)
  .register(prettierPlugin)
  .register(stylelintPlugin)
  .register(vscodePlugin)
  .register(intellijPlugin)
  .register(vitePlugin)
  .register(webpackPlugin)
  .register(mavenPlugin)
  .register(gradlePlugin)
  .register(antPlugin)
  .register(rustPlugin)
  .register(visualStudioPlugin)

export const analysisRouter = router({
  detect: publicProcedure
    .input(z.object({ path: z.string().default('.') }))
    .query(async ({ input }) => {
      const rootPath = resolve(cwd, input.path)
      return analyzer.analyze(rootPath)
    }),

  listPlugins: publicProcedure.query(() => analyzer.listPlugins()),
})
