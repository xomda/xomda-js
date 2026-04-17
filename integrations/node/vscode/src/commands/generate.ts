import { generate } from '@xomda/cli'
import * as vscode from 'vscode'

import type { XomdaProject } from '../workspace'

export async function runGenerate(project: XomdaProject, output: vscode.OutputChannel): Promise<void> {
  output.appendLine(`[generate] root = ${project.root}`)
  const start = Date.now()
  try {
    const results = await generate(project.root)
    const ms = Date.now() - start
    output.appendLine(`[generate] wrote ${results.length} file(s) in ${ms}ms`)
    void vscode.window.showInformationMessage(
      `Xomda: generated ${results.length} file${results.length === 1 ? '' : 's'} (${ms}ms)`
    )
  } catch (err) {
    output.appendLine(`[generate] FAILED: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
    void vscode.window.showErrorMessage(
      `Xomda generate failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
