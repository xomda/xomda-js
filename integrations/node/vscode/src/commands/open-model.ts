import * as vscode from 'vscode'

import type { XomdaProject } from '../workspace'

export async function openModel(project: XomdaProject): Promise<void> {
  const uri = vscode.Uri.file(project.modelPath)
  const doc = await vscode.workspace.openTextDocument(uri)
  await vscode.window.showTextDocument(doc, { preview: false })
}
