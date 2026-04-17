import { parentPort, Worker, workerData } from 'node:worker_threads'

import { ProjectAnalyzer } from './analyzer'
import { getRegisteredAnalysisPlugins } from './registry'
import type { AnalysisResult } from './types'

interface WorkerInput {
  rootPath: string
  /**
   * Module specifier(s) the worker should import for side effects before
   * running the analyzer (typically '@xomda/analysis-plugins'). Allows
   * the caller to control which plugins are present without
   * @xomda/analysis-core taking a hard dep on the aggregator (cycle).
   */
  pluginModules: string[]
}

/**
 * Run an analysis end-to-end in-process using whatever plugins are
 * currently registered. Used by both the worker entry point below and
 * tests that want the same behavior without spawning a thread.
 */
export async function runAnalysisInline(rootPath: string): Promise<AnalysisResult> {
  const analyzer = new ProjectAnalyzer().registerAll(getRegisteredAnalysisPlugins())
  return analyzer.analyze(rootPath)
}

export interface RunAnalysisInWorkerOptions {
  rootPath: string
  /**
   * Side-effect imports the worker should perform before running. Pass
   * '@xomda/analysis-plugins' (or any subset of plugin packages) so the
   * registry is populated inside the worker.
   */
  pluginModules: string[]
}

/**
 * Spawn a node:worker_threads Worker that runs this file's worker
 * entry, performs analysis, and resolves with the result.
 */
export function runAnalysisInWorker(opts: RunAnalysisInWorkerOptions): Promise<AnalysisResult> {
  return new Promise<AnalysisResult>((resolve, reject) => {
    // Inherit the parent process's execArgv (and thus its TS loader, if
    // any — tsx, vitest, etc.). This is what `new Worker()` does by
    // default; we make the behavior explicit for documentation.
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      workerData: opts satisfies WorkerInput,
      execArgv: process.execArgv,
    })
    worker.once('message', (msg: AnalysisResult) => resolve(msg))
    worker.once('error', (err) => reject(err))
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`analysis worker exited with code ${code}`))
    })
  })
}

// Worker entry — runs when this file is loaded inside a Worker thread.
if (parentPort && workerData) {
  const { rootPath, pluginModules } = workerData as WorkerInput
  void Promise.all(pluginModules.map((m) => import(m)))
    .then(() => runAnalysisInline(rootPath))
    .then((result) => {
      parentPort?.postMessage(result)
    })
    .catch((err) => {
      throw err instanceof Error ? err : new Error(String(err))
    })
}
