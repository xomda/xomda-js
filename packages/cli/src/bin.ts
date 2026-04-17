#!/usr/bin/env node
import { c } from '@xomda/util'
import { program } from 'commander'

import { diff, generate, preview, wrapper } from './commands'

const printError = (err: unknown) => {
  console.error(c.red('Error:'), err instanceof Error ? err.message : String(err))
}

program.name('xomda').description('xomda code generation CLI').version('0.0.1')

program
  .command('generate')
  .description('Run all TEMPLATE++ templates and write generated files to disk')
  .option('-r, --root <path>', 'project root directory', process.cwd())
  .action(async (opts: { root: string }) => {
    try {
      const results = await generate(opts.root)
      console.log(c.green(`Generated ${results.length} file(s):`))
      for (const r of results) {
        console.log(`  ${c.dim(r.outputPath)}`)
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
  .option('--json', 'output results as JSON')
  .action(async (opts: { root: string; json?: boolean }) => {
    try {
      const results = await preview(opts.root)
      if (opts.json) {
        console.log(JSON.stringify(results, null, 2))
      } else {
        for (const r of results) {
          console.log(`\n${c.cyan(c.bold(`=== ${r.outputPath} ===`))}`)
          console.log(r.content)
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
      console.log(`${c.dim(`${unchanged.length} file(s) unchanged`)}, ${c.yellow(`${changed.length} file(s) changed`)}:`)
      for (const e of changed) {
        const label = e.current === null ? c.green('[NEW]') : c.yellow('[CHANGED]')
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
      console.log(`${c.green('xomdaw pinned to')} ${c.bold(`xomda@${result.version}`)}`)
      const suffix = result.wroteScripts ? '' : c.dim(' (unchanged)')
      console.log(`  ${result.posixScriptPath}${suffix}`)
      console.log(`  ${result.windowsScriptPath}${suffix}`)
      console.log(`  ${result.configPath}`)
      console.log('')
      console.log(c.dim('Add this to your .gitignore: .xomda/wrapper/node_modules/'))
    } catch (err) {
      printError(err)
      process.exit(1)
    }
  })

program.parse()
