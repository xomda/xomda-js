#!/usr/bin/env node
import { program } from 'commander'

import { diff, generate, preview } from './commands'

program.name('xomda').description('xomda code generation CLI').version('0.0.1')

program
  .command('generate')
  .description('Run all TEMPLATE++ templates and write generated files to disk')
  .option('-r, --root <path>', 'project root directory', process.cwd())
  .action(async (opts: { root: string }) => {
    try {
      const results = await generate(opts.root)
      console.log(`Generated ${results.length} file(s):`)
      for (const r of results) {
        console.log(`  ${r.outputPath}`)
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err))
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
          console.log(`\n=== ${r.outputPath} ===`)
          console.log(r.content)
        }
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err))
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
      console.log(`${unchanged.length} file(s) unchanged, ${changed.length} file(s) changed:`)
      for (const e of changed) {
        const label = e.current === null ? '[NEW]' : '[CHANGED]'
        console.log(`  ${label} ${e.outputPath}`)
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program.parse()
