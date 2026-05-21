#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { diff, generate, generateRecursive, preview, previewRecursive, wrapper } from '@xomda/cli'
import { PortUnavailableError, startServer } from '@xomda/node'
import { colors } from '@xomda/util'
import { program } from 'commander'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The published tarball stages files like:
//   xomda/
//     dist/cli.js           ← this file at runtime
//     package.json          ← read for version
//     client/index.html     ← pre-built SPA
//     client/vendor.manifest.json
//
// In dev (running un-bundled from packages/xomda/src/bin.ts), the same relative
// layout doesn't apply, but the build script tests do; smoke runs hit the
// published tree.
const PKG_JSON = resolve(__dirname, '..', 'package.json')
const STATIC_DIR = resolve(__dirname, '..', 'client')
const VENDOR_MANIFEST = resolve(STATIC_DIR, 'vendor.manifest.json')

const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { version: string }

const printError = (err: unknown) => {
  process.stderr.write(
    `${colors.red('error')}: ${err instanceof Error ? err.message : String(err)}\n`
  )
}

program.name('xomda').description('xomda — model-driven code generation').version(pkg.version)

program
  .command('serve', { isDefault: true })
  .description('Start the tRPC server and serve the SPA (default)')
  .option('-p, --port <port>', 'port to listen on', (v) => Number(v))
  .option('--open', 'open the browser when the server starts', false)
  .action(async (opts: { port?: number; open?: boolean }) => {
    const portWasExplicit = opts.port !== undefined || process.env.XOMDA_PORT !== undefined
    try {
      await startServer({
        port: opts.port,
        portWasExplicit,
        open: opts.open,
        staticDir: existsSync(STATIC_DIR) ? STATIC_DIR : undefined,
        vendorManifestPath: existsSync(VENDOR_MANIFEST) ? VENDOR_MANIFEST : undefined,
      })
    } catch (err) {
      const e = err as Error & { code?: string }
      if (e instanceof PortUnavailableError) {
        const hint = portWasExplicit
          ? 'Pass a different --port or free up the requested one.'
          : 'Pass --port <number> to choose a specific port.'
        process.stderr.write(`\n  ${colors.red('error')}: ${e.message}\n  ${colors.dim(hint)}\n\n`)
      } else {
        const code = e.code ? ` (${e.code})` : ''
        process.stderr.write(
          `\n  ${colors.red('error')}: failed to start server${code}: ${e.message}\n\n`
        )
      }
      process.exit(1)
    }
  })

program
  .command('generate')
  .description('Run all templates and write generated files to disk')
  .option('-r, --root <path>', 'project root directory', process.cwd())
  .option(
    '-R, --recursive',
    'walk every .xomda/ subproject under <root>; stop at settings.isRoot boundaries',
    false
  )
  .action(async (opts: { root: string; recursive: boolean }) => {
    try {
      if (opts.recursive) {
        const projects = await generateRecursive(opts.root, { recursive: true })
        let total = 0
        for (const project of projects) {
          total += project.results.length
          console.log(colors.cyan(colors.bold(`=== ${project.root} ===`)))
          console.log(colors.green(`Generated ${project.results.length} file(s):`))
          for (const r of project.results) {
            console.log(`  ${colors.dim(r.outputPath)}`)
          }
          if (project.skippedRoots && project.skippedRoots.length > 0) {
            console.log(colors.dim('Skipped (independent workspaces — settings.isRoot=true):'))
            for (const s of project.skippedRoots) {
              console.log(`  ${colors.dim(`${s.path} (${s.name})`)}`)
            }
          }
        }
        console.log(colors.green(`\n${total} file(s) total across ${projects.length} project(s).`))
      } else {
        const results = await generate(opts.root)
        console.log(colors.green(`Generated ${results.length} file(s):`))
        for (const r of results) {
          console.log(`  ${colors.dim(r.outputPath)}`)
        }
      }
    } catch (err) {
      printError(err)
      process.exit(1)
    }
  })

program
  .command('preview')
  .description('Preview generated output without writing to disk')
  .option('-r, --root <path>', 'project root directory', process.cwd())
  .option(
    '-R, --recursive',
    'walk every .xomda/ subproject under <root>; stop at settings.isRoot boundaries',
    false
  )
  .option('--json', 'output results as JSON')
  .action(async (opts: { root: string; recursive: boolean; json?: boolean }) => {
    try {
      if (opts.recursive) {
        const projects = await previewRecursive(opts.root)
        if (opts.json) {
          console.log(JSON.stringify(projects, null, 2))
          return
        }
        for (const project of projects) {
          console.log(colors.cyan(colors.bold(`\n=== project: ${project.root} ===`)))
          for (const r of project.results) {
            console.log(`\n${colors.cyan(colors.bold(`--- ${r.outputPath} ---`))}`)
            console.log(r.content)
          }
          if (project.skippedRoots && project.skippedRoots.length > 0) {
            console.log(colors.dim('\nSkipped (independent workspaces — settings.isRoot=true):'))
            for (const s of project.skippedRoots) {
              console.log(`  ${colors.dim(`${s.path} (${s.name})`)}`)
            }
          }
        }
      } else {
        const results = await preview(opts.root)
        if (opts.json) {
          console.log(JSON.stringify(results, null, 2))
        } else {
          for (const r of results) {
            console.log(`\n${colors.cyan(colors.bold(`=== ${r.outputPath} ===`))}`)
            console.log(r.content)
          }
        }
      }
    } catch (err) {
      printError(err)
      process.exit(1)
    }
  })

program
  .command('diff')
  .description('Show which generated files differ from what is currently on disk')
  .option('-r, --root <path>', 'project root directory', process.cwd())
  .option('--json', 'output results as JSON')
  .action(async (opts: { root: string; json?: boolean }) => {
    try {
      const entries = await diff(opts.root)
      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2))
        return
      }
      const changed = entries.filter((e) => e.changed)
      const unchanged = entries.filter((e) => !e.changed)
      console.log(
        `${colors.dim(`${unchanged.length} file(s) unchanged`)}, ${colors.yellow(
          `${changed.length} file(s) changed`
        )}:`
      )
      for (const e of changed) {
        const label = e.current === null ? colors.green('[NEW]') : colors.yellow('[CHANGED]')
        console.log(`  ${label} ${e.outputPath}`)
      }
    } catch (err) {
      printError(err)
      process.exit(1)
    }
  })

program
  .command('wrapper')
  .description('Generate xomdaw / xomdaw.cmd wrapper scripts that pin a xomda version per project')
  .option('-r, --root <path>', 'project root directory', process.cwd())
  .option('--pin <version>', 'xomda version to pin (defaults to this CLI version)')
  .option('-f, --force', 'rewrite wrapper scripts even if they already exist', false)
  .action(async (opts: { root: string; pin?: string; force?: boolean }) => {
    try {
      const result = await wrapper(opts.root, { version: opts.pin, force: opts.force })
      console.log(`${colors.green('xomdaw pinned to')} ${colors.bold(`xomda@${result.version}`)}`)
      const suffix = result.wroteScripts ? '' : colors.dim(' (unchanged)')
      console.log(`  ${result.posixScriptPath}${suffix}`)
      console.log(`  ${result.windowsScriptPath}${suffix}`)
      console.log(`  ${result.configPath}`)
      console.log('')
      console.log(colors.dim('Add this to your .gitignore: .xomda/wrapper/node_modules/'))
    } catch (err) {
      printError(err)
      process.exit(1)
    }
  })

program.parse()
