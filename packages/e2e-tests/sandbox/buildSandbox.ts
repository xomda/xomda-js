import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Workspace root — `packages/e2e-tests/sandbox/buildSandbox.ts` is three
 * levels deep from the repo root.
 */
export const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..')

export interface BuildSandboxOptions {
  /**
   * When true, wipes the target directory before copying. When false, missing
   * pieces are filled in but existing content is left alone (useful for
   * per-spec seeding on top of a previously-built sandbox).
   */
  clean?: boolean
}

/**
 * Build the default Cypress project root.
 *
 * The contents mirror what the suite already assumes about the worktree:
 * the seeded `.xomda/` (model + templates), `.devcontainer/`, `.npmrc`,
 * `README.md`, a `.git/` marker so the file browser shows the entry, a
 * stub `package.json`, one sample workspace package, and a copy of the
 * `demo/maven-plain/` Maven project for analysis-plugin coverage.
 *
 * Everything is copied from real artifacts under WORKSPACE_ROOT so a spec
 * never sees synthetic fixture content that drifts from production paths.
 */
export async function buildSandbox(
  targetDir: string,
  opts: BuildSandboxOptions = {}
): Promise<void> {
  const root = resolve(targetDir)
  if (opts.clean) {
    await rm(root, { recursive: true, force: true })
  }
  await mkdir(root, { recursive: true })

  await copyWorktreeXomda(root)
  await copyDevcontainer(root)
  await copyNpmrc(root)
  await copyReadme(root)
  await writeRootPackageJson(root)
  await writeGitMarker(root)
  await addSamplePackage(root, { name: 'sample' })
  await addMavenProject(root, { name: 'demo-maven' })
}

// ─── Primitives ───────────────────────────────────────────────────────────────

export async function copyWorktreeXomda(targetDir: string): Promise<void> {
  await cp(resolve(WORKSPACE_ROOT, '.xomda'), resolve(targetDir, '.xomda'), {
    recursive: true,
    force: true,
  })
}

export async function copyDevcontainer(targetDir: string): Promise<void> {
  await cp(resolve(WORKSPACE_ROOT, '.devcontainer'), resolve(targetDir, '.devcontainer'), {
    recursive: true,
    force: true,
  })
}

export async function copyNpmrc(targetDir: string): Promise<void> {
  await cp(resolve(WORKSPACE_ROOT, '.npmrc'), resolve(targetDir, '.npmrc'), { force: true })
}

export async function copyReadme(targetDir: string): Promise<void> {
  await cp(resolve(WORKSPACE_ROOT, 'README.md'), resolve(targetDir, 'README.md'), { force: true })
}

/**
 * Sandbox `package.json` — copy the worktree-root one so the Node.js analysis
 * plugin shows the same dependency list specs assert on (e.g. the dashboard
 * spec checks for `@eslint/js` at a pinned version). pnpm workspaces live in
 * pnpm-workspace.yaml, so the root package.json is safe to copy in isolation.
 */
export async function writeRootPackageJson(targetDir: string): Promise<void> {
  await cp(resolve(WORKSPACE_ROOT, 'package.json'), resolve(targetDir, 'package.json'), {
    force: true,
  })
}

/**
 * The file-browser spec asserts that `.git` appears as a hidden entry.
 * The real `.git` is a gitlink file (this is a worktree); the sandbox just
 * needs an entry to enumerate, so a marker directory with a HEAD file is
 * enough to convince the analyzer it's a git checkout.
 */
export async function writeGitMarker(targetDir: string): Promise<void> {
  const gitDir = resolve(targetDir, '.git')
  await mkdir(gitDir, { recursive: true })
  await writeFile(resolve(gitDir, 'HEAD'), 'ref: refs/heads/main\n', 'utf-8')
}

export interface AddSamplePackageOptions {
  name: string
  dependency?: { name: string; version: string }
}

/**
 * Drop a `packages/<name>/` workspace stub: a tiny package.json plus a
 * one-liner src/index.ts. Idempotent — re-running overwrites in place.
 */
export async function addSamplePackage(
  targetDir: string,
  opts: AddSamplePackageOptions
): Promise<void> {
  const pkgRoot = resolve(targetDir, 'packages', opts.name)
  await mkdir(resolve(pkgRoot, 'src'), { recursive: true })

  const manifest: Record<string, unknown> = {
    name: `@sandbox/${opts.name}`,
    private: true,
    version: '0.0.1',
    type: 'module',
    main: 'src/index.ts',
  }
  if (opts.dependency) {
    manifest.dependencies = { [opts.dependency.name]: opts.dependency.version }
  }
  await writeFile(resolve(pkgRoot, 'package.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  await writeFile(
    resolve(pkgRoot, 'src', 'index.ts'),
    `export const name = '${opts.name}'\n`,
    'utf-8'
  )
}

export interface AddMavenProjectOptions {
  /** Folder name inside the sandbox where the Maven project lands. */
  name: string
}

/**
 * Copy `demo/maven-plain/` into the sandbox as a usable Maven project the
 * analysis plugins can detect. Strips ephemeral state (`node_modules/`, the
 * generated `src/main/generated/` tree) so the seed stays reproducible.
 */
export async function addMavenProject(
  targetDir: string,
  opts: AddMavenProjectOptions
): Promise<void> {
  const source = resolve(WORKSPACE_ROOT, 'demo', 'maven-plain')
  const dest = resolve(targetDir, opts.name)
  await cp(source, dest, {
    recursive: true,
    force: true,
    filter: (src) => {
      if (src.includes(`${dest}/node_modules`)) return false
      if (src.includes(`${source}/node_modules`)) return false
      if (src.includes(`${source}/src/main/generated`)) return false
      return true
    },
  })
}

export interface AddMarkdownOptions {
  /** Path inside the sandbox, e.g. `docs/intro.md`. */
  path: string
  /** Markdown body. Defaults to a tiny preview-friendly snippet. */
  content?: string
}

/**
 * Drop a markdown file into the sandbox for preview-rendering tests.
 */
export async function addMarkdown(targetDir: string, opts: AddMarkdownOptions): Promise<void> {
  const filePath = resolve(targetDir, opts.path)
  await mkdir(dirname(filePath), { recursive: true })
  const body =
    opts.content ?? `# ${opts.path}\n\nSandbox markdown fixture.\n\n- bullet one\n- bullet two\n`
  await writeFile(filePath, body, 'utf-8')
}

export interface AddTemplateOptions {
  /**
   * Path inside `.xomda/templates/`, e.g. `Custom/my.template.json`.
   * Trailing `.template.json` is added if missing.
   */
  path: string
  /** Already-shaped Template JSON. */
  template: unknown
}

/**
 * Drop a template under the sandbox's `.xomda/templates/`. Lets specs
 * exercise the template browser/runner with content they control.
 */
export async function addTemplate(targetDir: string, opts: AddTemplateOptions): Promise<void> {
  const fileName = opts.path.endsWith('.template.json') ? opts.path : `${opts.path}.template.json`
  const dest = resolve(targetDir, '.xomda', 'templates', fileName)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, JSON.stringify(opts.template, null, 2), 'utf-8')
}
