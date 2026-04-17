import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type * as AnalysisCore from '@xomda/analysis-core'
import { XOMDA_DIR } from '@xomda/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the worker spawn — vitest can't propagate its TS loader into a
// real worker_thread. The router's combine logic (features + subprojects)
// is what we want to exercise here.
vi.mock('@xomda/analysis-core', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalysisCore>()
  return {
    ...actual,
    runAnalysisInWorker: vi.fn(async ({ rootPath }: { rootPath: string }) => {
      return actual.runAnalysisInline(rootPath)
    }),
  }
})

import { projectRouter } from '../project.router'

const caller = (() => projectRouter.createCaller({}))()

describe('projectRouter.context', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-context-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns in-root when the path contains a .xomda directory', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    const result = await caller.context({ path: root })
    expect(result.kind).toBe('in-root')
    expect(result.projectRoot).toBe(root)
    expect(result.cwdHasXomda).toBe(true)
  })

  it('returns in-subfolder and suggests the discovered root', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    const nested = join(root, 'a', 'b')
    await mkdir(nested, { recursive: true })
    const result = await caller.context({ path: nested })
    expect(result.kind).toBe('in-subfolder')
    expect(result.projectRoot).toBe(root)
    expect(result.suggestions.useFound).toBe(root)
    expect(result.suggestions.createHere).toBe(nested)
  })

  it('returns none when no marker is found', async () => {
    const result = await caller.context({ path: root })
    expect(result.kind).toBe('none')
    expect(result.suggestions.createHere).toBe(root)
    expect(result.ancestorProjects).toEqual([])
  })

  it('lists ancestor .xomda projects walking upward (nearest first)', async () => {
    // root/.xomda + root/inner/.xomda; query from root/inner
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    const inner = join(root, 'inner')
    await mkdir(join(inner, XOMDA_DIR), { recursive: true })

    const result = await caller.context({ path: inner })
    expect(result.kind).toBe('in-root') // inner is itself a project
    expect(result.projectRoot).toBe(inner)
    expect(result.ancestorProjects.map((a) => a.path)).toEqual([root])
  })

  it('isRoot=true on the current project hides ancestor suggestions', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    const inner = join(root, 'inner')
    await mkdir(join(inner, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root: inner,
      meta: {
        name: 'inner',
        versions: { head: null, versions: [] },
        settings: {
          restrictWritesToProjectRoot: true,
          isRoot: true,
          excludeFromScan: ['.git', 'node_modules'],
        },
      },
    })

    const result = await caller.context({ path: inner })
    expect(result.kind).toBe('in-root')
    expect(result.ancestorProjects).toEqual([])
  })

  it('ancestor walk stops at the first ancestor with isRoot=true (inclusive)', async () => {
    // grand/.xomda (isRoot) → mid/.xomda → root/.xomda; query from root
    const grand = root
    const mid = join(grand, 'mid')
    const leaf = join(mid, 'leaf')
    await mkdir(join(grand, XOMDA_DIR), { recursive: true })
    await mkdir(join(mid, XOMDA_DIR), { recursive: true })
    await mkdir(join(leaf, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root: mid,
      meta: {
        name: 'mid',
        versions: { head: null, versions: [] },
        settings: {
          restrictWritesToProjectRoot: true,
          isRoot: true,
          excludeFromScan: ['.git', 'node_modules'],
        },
      },
    })

    const result = await caller.context({ path: leaf })
    expect(result.ancestorProjects.map((a) => a.path)).toEqual([mid])
  })
})

describe('projectRouter.meta + updateMeta', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-meta-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('meta returns null when project.json is absent', async () => {
    expect(await caller.meta({ root })).toBeNull()
  })

  it('updateMeta writes project.json and meta reads it back', async () => {
    await caller.updateMeta({
      root,
      meta: {
        name: 'demo',
        description: 'a project',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: false },
      },
    })
    const read = await caller.meta({ root })
    expect(read?.name).toBe('demo')
    expect(read?.description).toBe('a project')
    expect(read?.settings.restrictWritesToProjectRoot).toBe(false)
  })
})

describe('projectRouter.fileTypesFor', () => {
  // Use a fresh tmpdir as `root` so the host's .xomda/project.json
  // (which may carry an unrelated `plugins` filter) can't strip our
  // assertions. Without this, running these tests from the xomda
  // monorepo root with its own gradle/maven plugin filter wipes out
  // typescript / vite matches.
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-filetypes-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns multi-match for a .ts file (TypeScript + Vite)', async () => {
    const result = await caller.fileTypesFor({ path: 'src/index.ts', root })
    const pluginIds = result.matches.map((m) => m.pluginId)
    expect(pluginIds).toContain('typescript')
    expect(pluginIds).toContain('vite')
  })

  it('returns the TypeScript preview hint (higher priority than overlay)', async () => {
    const result = await caller.fileTypesFor({ path: 'src/index.ts', root })
    expect(result.preview).toEqual({ kind: 'text', language: 'typescript' })
  })

  it('returns empty matches for an unclaimed file', async () => {
    // `.qqq` is intentionally unmapped by every plugin; using something
    // like `README.md` here would be claimed by the baseline markdown
    // plugin (icon + text/markdown preview).
    const result = await caller.fileTypesFor({ path: 'unknown.qqq', root })
    expect(result.matches).toEqual([])
  })
})

describe('projectRouter.scan', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-scan-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns features and discovered subprojects', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await mkdir(join(root, 'packages', 'a', XOMDA_DIR), { recursive: true })

    const result = await caller.scan({ root })
    expect(result.features.map((f) => f.pluginId)).toContain('xomda')
    expect(result.subprojects.map((s) => s.path)).toEqual(['packages/a'])
  }, 30_000)

  it('detectedIds carries the unfiltered detection result', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    const result = await caller.scan({ root })
    expect(result.detectedIds).toContain('xomda')
  })

  it('honors the project.plugins filter when set', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root,
      meta: {
        name: 'p',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: true },
        plugins: ['typescript'], // xomda is detected but not enabled
      },
    })

    const result = await caller.scan({ root })
    expect(result.detectedIds).toContain('xomda')
    expect(result.features.map((f) => f.pluginId)).not.toContain('xomda')
  })

  it('returns the generic projects list with multi-kind nested folders', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'host' }))
    await mkdir(join(root, 'packages', 'a'), { recursive: true })
    await writeFile(join(root, 'packages', 'a', 'package.json'), JSON.stringify({ name: 'a' }))
    await mkdir(join(root, 'integrations', 'jvm'), { recursive: true })
    await writeFile(join(root, 'integrations', 'jvm', 'pom.xml'), '<project/>')
    await mkdir(join(root, 'demo', 'g'), { recursive: true })
    await writeFile(join(root, 'demo', 'g', 'build.gradle'), '')

    const result = await caller.scan({ root })
    const byPath = Object.fromEntries(result.projects.map((p) => [p.path, p.kinds.sort()]))
    expect(byPath['.']?.sort()).toEqual(['node', 'xomda'])
    expect(byPath['packages/a']).toEqual(['node'])
    expect(byPath['integrations/jvm']).toEqual(['maven'])
    expect(byPath['demo/g']).toEqual(['gradle'])
    expect(result.projectKinds).toEqual({ node: 1, maven: 1, gradle: 1 })
  }, 30_000)
})

describe('projectRouter.kindsFor', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-kindsfor-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns the plugin ids that claim the given folder', async () => {
    await writeFile(join(root, 'package.json'), '{}')
    const { kinds } = await caller.kindsFor({ path: '.', root })
    expect(kinds.map((k) => k.pluginId)).toContain('node')
  })

  it('returns multiple kinds when a folder carries several markers', async () => {
    await mkdir(join(root, 'hybrid'), { recursive: true })
    await writeFile(join(root, 'hybrid', 'package.json'), '{}')
    await writeFile(join(root, 'hybrid', 'pom.xml'), '<project/>')
    const { kinds } = await caller.kindsFor({ path: 'hybrid', root })
    const ids = kinds.map((k) => k.pluginId).sort()
    expect(ids).toEqual(['maven', 'node'])
  })

  it('returns empty kinds for an unclaimed folder', async () => {
    await mkdir(join(root, 'empty'), { recursive: true })
    const { kinds } = await caller.kindsFor({ path: 'empty', root })
    expect(kinds).toEqual([])
  })
})

describe('projectRouter.refreshPlugins', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-refresh-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('persists the detected plugins (sorted) and returns them', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })

    const result = await caller.refreshPlugins({ root })
    expect(result.detectedIds).toContain('xomda')
    expect(result.plugins).toEqual([...result.plugins].sort())
    expect(result.plugins).toContain('xomda')

    const meta = await caller.meta({ root })
    expect(meta?.plugins).toEqual(result.plugins)
  })

  it('creates project.json on first refresh when none exists', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    expect(await caller.meta({ root })).toBeNull()

    await caller.refreshPlugins({ root })
    const meta = await caller.meta({ root })
    expect(meta).not.toBeNull()
    expect(meta?.plugins.length).toBeGreaterThan(0)
  })

  it('overwrites a previously-set plugins list with the fresh detection', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root,
      meta: {
        name: 'p',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: true },
        plugins: ['some-old-id', 'another'],
      },
    })

    const result = await caller.refreshPlugins({ root })
    expect(result.plugins).not.toContain('some-old-id')
    expect(result.plugins).not.toContain('another')
    expect(result.plugins).toContain('xomda')
  })
})

describe('projectRouter.fileTypesFor with plugin filter', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-filetypes-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('drops matches from disabled plugins', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root,
      meta: {
        name: 'p',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: true },
        plugins: ['typescript'], // vite disabled
      },
    })

    const result = await caller.fileTypesFor({ path: 'src/index.ts', root })
    const pluginIds = result.matches.map((m) => m.pluginId)
    expect(pluginIds).toContain('typescript')
    expect(pluginIds).not.toContain('vite')
  })

  it('returns all matches when the filter is empty (no preference set)', async () => {
    const result = await caller.fileTypesFor({ path: 'src/index.ts', root })
    const pluginIds = result.matches.map((m) => m.pluginId)
    expect(pluginIds).toContain('typescript')
    expect(pluginIds).toContain('vite')
  })

  it('keeps baseline binary previews even when filter is restrictive', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root,
      meta: {
        name: 'p',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: true },
        plugins: ['typescript'], // binary plugin not listed
      },
    })

    const png = await caller.fileTypesFor({ path: 'logo.png', root })
    expect(png.preview).toEqual({ kind: 'image' })

    const zip = await caller.fileTypesFor({ path: 'release.zip', root })
    expect(zip.preview).toEqual({ kind: 'binary' })
  })
})

describe('projectRouter.viewsFor', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-views-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns a default-wrapped view for plugins using the `preview` shorthand', async () => {
    const result = await caller.viewsFor({ path: 'README.md', root })
    const markdown = result.views.find((v) => v.pluginId === 'markdown')
    expect(markdown).toBeDefined()
    expect(markdown?.views).toHaveLength(1)
    expect(markdown?.views[0]).toMatchObject({
      id: 'default',
      label: 'Preview',
      preview: { kind: 'text', language: 'markdown' },
      hasLoadViewData: false,
    })
  })

  it('drops views from disabled plugins but keeps baseline plugins like markdown', async () => {
    await mkdir(join(root, XOMDA_DIR), { recursive: true })
    await caller.updateMeta({
      root,
      meta: {
        name: 'p',
        versions: { head: null, versions: [] },
        settings: { restrictWritesToProjectRoot: true },
        plugins: ['typescript'], // markdown not listed; should still come through as baseline
      },
    })

    const result = await caller.viewsFor({ path: 'README.md', root })
    expect(result.views.map((v) => v.pluginId)).toContain('markdown')
  })
})

describe('projectRouter.overview', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-overview-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns an empty contributions list when no plugin has loadOverview for this root', async () => {
    const result = await caller.overview({ root, xomdaRoot: root })
    // None of the existing plugins implement loadOverview yet.
    expect(result.contributions).toEqual([])
  })
})

describe('projectRouter.viewData', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-viewdata-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns { data: undefined } when the view has no loader', async () => {
    // Markdown plugin's default view has no loadViewData.
    const r = await caller.viewData({
      pluginId: 'markdown',
      fileTypeId: 'markdown-file',
      viewId: 'default',
      path: 'README.md',
      root,
    })
    expect(r.data).toBeUndefined()
  })
})
