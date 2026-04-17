import { basename } from 'node:path'

import type { Package } from '@xomda/core'
import { readModel } from '@xomda/model/storage'
import * as vscode from 'vscode'

import { listTemplatesWithPaths } from './templates'
import type { XomdaProject } from './workspace'

type NodeKind = 'project' | 'section' | 'package' | 'entity' | 'enum' | 'template'

export interface XomdaNode {
  kind: NodeKind
  label: string
  description?: string
  resource?: vscode.Uri
  children?: () => Promise<XomdaNode[]>
}

export class XomdaTreeProvider implements vscode.TreeDataProvider<XomdaNode> {
  private readonly emitter = new vscode.EventEmitter<XomdaNode | undefined | void>()
  readonly onDidChangeTreeData = this.emitter.event

  constructor(private projects: readonly XomdaProject[]) {}

  setProjects(projects: readonly XomdaProject[]): void {
    this.projects = projects
    this.emitter.fire()
  }

  refresh(): void {
    this.emitter.fire()
  }

  getTreeItem(node: XomdaNode): vscode.TreeItem {
    const collapsible = node.children
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
    const item = new vscode.TreeItem(node.label, collapsible)
    item.description = node.description
    item.resourceUri = node.resource
    item.contextValue = node.kind
    item.iconPath = iconFor(node.kind)
    if (node.kind === 'template' && node.resource) {
      item.command = {
        command: 'vscode.open',
        title: 'Open Template',
        arguments: [node.resource],
      }
    }
    return item
  }

  async getChildren(node?: XomdaNode): Promise<XomdaNode[]> {
    if (!node) {
      if (this.projects.length === 1) {
        return childrenOfProject(this.projects[0])
      }
      return this.projects.map((project) => ({
        kind: 'project' as const,
        label: basename(project.root),
        description: project.root,
        children: () => childrenOfProject(project),
      }))
    }
    return node.children ? node.children() : []
  }
}

async function childrenOfProject(project: XomdaProject): Promise<XomdaNode[]> {
  return [
    {
      kind: 'section',
      label: 'Model',
      children: () => modelChildren(project),
    },
    {
      kind: 'section',
      label: 'Templates',
      children: () => templateChildren(project),
    },
  ]
}

async function modelChildren(project: XomdaProject): Promise<XomdaNode[]> {
  const model = await readModel(project.root)
  return (model.packages ?? []).map(packageNode)
}

function packageNode(pkg: Package): XomdaNode {
  return {
    kind: 'package',
    label: pkg.name,
    description: summary(pkg),
    children: async () => [
      ...pkg.packages.map(packageNode),
      ...pkg.entities.map((e) => ({ kind: 'entity' as const, label: e.name })),
      ...pkg.enums.map((e) => ({ kind: 'enum' as const, label: e.name })),
    ],
  }
}

function summary(pkg: Package): string {
  const parts: string[] = []
  if (pkg.packages.length) parts.push(`${pkg.packages.length} pkg`)
  if (pkg.entities.length) parts.push(`${pkg.entities.length} entities`)
  if (pkg.enums.length) parts.push(`${pkg.enums.length} enums`)
  return parts.join(', ')
}

async function templateChildren(project: XomdaProject): Promise<XomdaNode[]> {
  const templates = await listTemplatesWithPaths(project.root)
  return templates.map(({ template, path }) => ({
    kind: 'template' as const,
    label: template.name,
    description: template.scope,
    resource: vscode.Uri.file(path),
  }))
}

function iconFor(kind: NodeKind): vscode.ThemeIcon {
  switch (kind) {
    case 'project':
      return new vscode.ThemeIcon('root-folder')
    case 'section':
      return new vscode.ThemeIcon('folder')
    case 'package':
      return new vscode.ThemeIcon('package')
    case 'entity':
      return new vscode.ThemeIcon('symbol-class')
    case 'enum':
      return new vscode.ThemeIcon('symbol-enum')
    case 'template':
      return new vscode.ThemeIcon('file-code')
  }
}
