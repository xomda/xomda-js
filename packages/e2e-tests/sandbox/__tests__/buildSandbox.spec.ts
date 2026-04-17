import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  addMarkdown,
  addMavenProject,
  addSamplePackage,
  addTemplate,
  buildSandbox,
  WORKSPACE_ROOT,
} from '../buildSandbox'

describe('buildSandbox', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-sandbox-spec-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  describe('default seed', () => {
    beforeEach(async () => {
      await buildSandbox(root)
    })

    it('copies the worktree .xomda (model + project + templates)', () => {
      expect(existsSync(join(root, '.xomda', 'model.json'))).toBe(true)
      expect(existsSync(join(root, '.xomda', 'project.json'))).toBe(true)
      expect(existsSync(join(root, '.xomda', 'templates'))).toBe(true)
    })

    it('copies the worktree .devcontainer/devcontainer.json', () => {
      expect(existsSync(join(root, '.devcontainer', 'devcontainer.json'))).toBe(true)
    })

    it('copies .npmrc and README.md', () => {
      expect(existsSync(join(root, '.npmrc'))).toBe(true)
      expect(existsSync(join(root, 'README.md'))).toBe(true)
    })

    it('copies the worktree root package.json so dependency-driven specs match', () => {
      const sandboxPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
      const worktreePkg = JSON.parse(readFileSync(join(WORKSPACE_ROOT, 'package.json'), 'utf-8'))
      expect(sandboxPkg.name).toBe(worktreePkg.name)
      expect(sandboxPkg.devDependencies).toEqual(worktreePkg.devDependencies)
    })

    it('writes a .git/HEAD marker so the file browser shows a git checkout', () => {
      expect(existsSync(join(root, '.git', 'HEAD'))).toBe(true)
      expect(readFileSync(join(root, '.git', 'HEAD'), 'utf-8')).toMatch(/^ref: refs\/heads\//)
    })

    it('seeds a packages/sample workspace stub', () => {
      const pkg = JSON.parse(
        readFileSync(join(root, 'packages', 'sample', 'package.json'), 'utf-8')
      )
      expect(pkg.name).toBe('@sandbox/sample')
      expect(existsSync(join(root, 'packages', 'sample', 'src', 'index.ts'))).toBe(true)
    })

    it('seeds a demo-maven project (pom.xml present, generated dir absent)', () => {
      expect(existsSync(join(root, 'demo-maven', 'pom.xml'))).toBe(true)
      expect(existsSync(join(root, 'demo-maven', 'src', 'main', 'generated'))).toBe(false)
    })

    it('does not copy demo/maven-plain/node_modules', () => {
      expect(existsSync(join(root, 'demo-maven', 'node_modules'))).toBe(false)
    })
  })

  describe('clean option', () => {
    it('wipes pre-existing content when clean: true', async () => {
      await buildSandbox(root)
      await addMarkdown(root, { path: 'stale.md', content: 'old' })
      expect(existsSync(join(root, 'stale.md'))).toBe(true)

      await buildSandbox(root, { clean: true })
      expect(existsSync(join(root, 'stale.md'))).toBe(false)
      // Default seed is back.
      expect(existsSync(join(root, '.xomda', 'model.json'))).toBe(true)
    })

    it('leaves pre-existing content alone by default', async () => {
      await buildSandbox(root)
      await addMarkdown(root, { path: 'kept.md', content: 'still here' })
      await buildSandbox(root)
      expect(existsSync(join(root, 'kept.md'))).toBe(true)
    })
  })
})

describe('addSamplePackage', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-sandbox-pkg-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes package.json with the namespaced name and the entrypoint', async () => {
    await addSamplePackage(root, { name: 'probe' })
    const pkg = JSON.parse(readFileSync(join(root, 'packages', 'probe', 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('@sandbox/probe')
    expect(pkg.main).toBe('src/index.ts')
    expect(readFileSync(join(root, 'packages', 'probe', 'src', 'index.ts'), 'utf-8')).toContain(
      "export const name = 'probe'"
    )
  })

  it('includes the declared dependency when supplied', async () => {
    await addSamplePackage(root, {
      name: 'with-dep',
      dependency: { name: 'lodash', version: '^4' },
    })
    const pkg = JSON.parse(
      readFileSync(join(root, 'packages', 'with-dep', 'package.json'), 'utf-8')
    )
    expect(pkg.dependencies).toEqual({ lodash: '^4' })
  })

  it('is idempotent — re-running overwrites in place', async () => {
    await addSamplePackage(root, { name: 'probe' })
    await addSamplePackage(root, {
      name: 'probe',
      dependency: { name: 'react', version: '19.0.0' },
    })
    const pkg = JSON.parse(readFileSync(join(root, 'packages', 'probe', 'package.json'), 'utf-8'))
    expect(pkg.dependencies).toEqual({ react: '19.0.0' })
  })
})

describe('addMavenProject', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-sandbox-maven-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lands the Maven seed at the named folder, without generated/ or node_modules/', async () => {
    await addMavenProject(root, { name: 'extra-maven' })
    expect(existsSync(join(root, 'extra-maven', 'pom.xml'))).toBe(true)
    expect(existsSync(join(root, 'extra-maven', 'src', 'main', 'generated'))).toBe(false)
    expect(existsSync(join(root, 'extra-maven', 'node_modules'))).toBe(false)
  })
})

describe('addMarkdown', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-sandbox-md-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes the given content', async () => {
    await addMarkdown(root, { path: 'docs/a.md', content: '# A\n\nbody' })
    expect(readFileSync(join(root, 'docs', 'a.md'), 'utf-8')).toBe('# A\n\nbody')
  })

  it('defaults to a small preview-friendly snippet', async () => {
    await addMarkdown(root, { path: 'b.md' })
    const body = readFileSync(join(root, 'b.md'), 'utf-8')
    expect(body).toContain('# b.md')
    expect(body).toMatch(/bullet one/)
  })

  it('creates intermediate directories', async () => {
    await addMarkdown(root, { path: 'a/b/c/deep.md', content: 'deep' })
    expect(existsSync(join(root, 'a', 'b', 'c', 'deep.md'))).toBe(true)
  })
})

describe('addTemplate', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'xomda-sandbox-tpl-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const stubTemplate = { uuid: 'tpl-1', name: 'Stub', version: '1.0.0', cells: [] }

  it('writes under .xomda/templates and appends .template.json when missing', async () => {
    await addTemplate(root, { path: 'Custom/my', template: stubTemplate })
    const expected = join(root, '.xomda', 'templates', 'Custom', 'my.template.json')
    expect(existsSync(expected)).toBe(true)
    expect(JSON.parse(readFileSync(expected, 'utf-8'))).toEqual(stubTemplate)
  })

  it('respects an explicit .template.json suffix without doubling it', async () => {
    await addTemplate(root, { path: 'flat.template.json', template: stubTemplate })
    expect(existsSync(join(root, '.xomda', 'templates', 'flat.template.json'))).toBe(true)
    expect(existsSync(join(root, '.xomda', 'templates', 'flat.template.json.template.json'))).toBe(
      false
    )
  })
})
