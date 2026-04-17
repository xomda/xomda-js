import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')
const BIN_PATH = resolve(REPO_ROOT, 'packages/xomda/src/bin.ts')
const DOC_PATH = resolve(REPO_ROOT, 'docs/.ai/cli-reference.md')

/**
 * Extract every \`.command('name', …)\` declaration from bin.ts as a
 * raw command name. Text-based on purpose — importing bin.ts would
 * execute \`program.parse()\` at module load and interfere with the
 * test process.
 */
function extractBinCommands(): string[] {
  const src = readFileSync(BIN_PATH, 'utf8')
  const out: string[] = []
  const re = /\.command\(\s*'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

/**
 * Extract every \`### \\\`xomda <name>\\\`\` heading from the AI doc
 * as a command name. The doc also has a heading for the implicit
 * default invocation (no subcommand) — we ignore those because
 * commander does not register a name for that.
 */
function extractDocCommands(): string[] {
  const md = readFileSync(DOC_PATH, 'utf8')
  const out: string[] = []
  const re = /^###\s+`xomda\s+([a-z][a-z0-9-]*)`/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) out.push(m[1])
  return out
}

describe('docs/.ai/cli-reference.md ↔ packages/xomda/src/bin.ts', () => {
  it('documents every command registered in bin.ts', () => {
    const bin = new Set(extractBinCommands())
    const doc = new Set(extractDocCommands())
    const undocumented = [...bin].filter((c) => !doc.has(c))
    expect(undocumented).toEqual([])
  })

  it('does not invent commands the CLI does not register', () => {
    const bin = new Set(extractBinCommands())
    const doc = new Set(extractDocCommands())
    const phantom = [...doc].filter((c) => !bin.has(c))
    expect(phantom).toEqual([])
  })
})
