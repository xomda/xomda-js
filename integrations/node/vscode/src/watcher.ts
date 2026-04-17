import * as vscode from 'vscode'

import { runGenerate } from './commands/generate'
import type { XomdaProject } from './workspace'

const DEBOUNCE_MS = 250

export class XomdaWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly project: XomdaProject,
    private readonly output: vscode.OutputChannel
  ) {}

  start(): void {
    if (this.watcher) return
    const pattern = new vscode.RelativePattern(this.project.root, '.xomda/**/*')
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern)
    const trigger = () => this.scheduleGenerate()
    this.watcher.onDidChange(trigger)
    this.watcher.onDidCreate(trigger)
    this.watcher.onDidDelete(trigger)
    this.output.appendLine(`[watch] started for ${this.project.root}`)
  }

  stop(): void {
    this.watcher?.dispose()
    this.watcher = undefined
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.output.appendLine(`[watch] stopped`)
  }

  isRunning(): boolean {
    return this.watcher !== undefined
  }

  dispose(): void {
    this.stop()
  }

  private scheduleGenerate(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      void runGenerate(this.project, this.output)
    }, DEBOUNCE_MS)
  }
}
