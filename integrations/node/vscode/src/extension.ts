import * as vscode from 'vscode'

import { runGenerate } from './commands/generate'
import { openModel } from './commands/open-model'
import { XomdaTreeProvider } from './tree'
import { XomdaWatcher } from './watcher'
import { findXomdaProjects, type XomdaProject } from './workspace'

const HAS_PROJECT_CTX = 'xomda.hasProject'
const WATCHING_CTX = 'xomda.watching'

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Xomda')
  context.subscriptions.push(output)

  const watchers = new Map<string, XomdaWatcher>()
  let projects = scanWorkspace()

  void setProjectContext(projects.length > 0)

  const tree = new XomdaTreeProvider(projects)
  context.subscriptions.push(vscode.window.registerTreeDataProvider('xomda.tree', tree))

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      projects = scanWorkspace()
      tree.setProjects(projects)
      void setProjectContext(projects.length > 0)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('xomda.refresh', () => {
      projects = scanWorkspace()
      tree.setProjects(projects)
      void setProjectContext(projects.length > 0)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('xomda.generate', async () => {
      const project = await pickProject(projects)
      if (project) await runGenerate(project, output)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('xomda.openModel', async () => {
      const project = await pickProject(projects)
      if (project) await openModel(project)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('xomda.watch.start', async () => {
      const project = await pickProject(projects)
      if (!project) return
      const existing = watchers.get(project.root)
      if (existing?.isRunning()) {
        void vscode.window.showInformationMessage(`Xomda: already watching ${project.root}`)
        return
      }
      const watcher = existing ?? new XomdaWatcher(project, output)
      watcher.start()
      watchers.set(project.root, watcher)
      context.subscriptions.push(watcher)
      void setWatchingContext(true)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('xomda.watch.stop', async () => {
      const project = await pickProject(projects)
      if (!project) return
      watchers.get(project.root)?.stop()
      void setWatchingContext(anyWatcherRunning(watchers))
    })
  )
}

export function deactivate(): void {
  // Disposables are owned by the extension context.
}

function scanWorkspace(): XomdaProject[] {
  const folders = vscode.workspace.workspaceFolders ?? []
  return findXomdaProjects(folders.map((f) => f.uri.fsPath))
}

async function pickProject(projects: readonly XomdaProject[]): Promise<XomdaProject | undefined> {
  if (projects.length === 0) {
    void vscode.window.showWarningMessage('Xomda: no .xomda/model.json found in any workspace folder.')
    return undefined
  }
  if (projects.length === 1) return projects[0]
  const picked = await vscode.window.showQuickPick(
    projects.map((p) => ({ label: p.root, project: p })),
    { placeHolder: 'Select Xomda project' }
  )
  return picked?.project
}

function setProjectContext(value: boolean): Thenable<unknown> {
  return vscode.commands.executeCommand('setContext', HAS_PROJECT_CTX, value)
}

function setWatchingContext(value: boolean): Thenable<unknown> {
  return vscode.commands.executeCommand('setContext', WATCHING_CTX, value)
}

function anyWatcherRunning(watchers: Map<string, XomdaWatcher>): boolean {
  for (const watcher of watchers.values()) {
    if (watcher.isRunning()) return true
  }
  return false
}
