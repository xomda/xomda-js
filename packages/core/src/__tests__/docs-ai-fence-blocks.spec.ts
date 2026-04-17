import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ModelSchema } from '../schemas/model'

/**
 * AGENTS.md §22 — files under `docs/.ai/` ship inside the published xomda
 * tarball as the AI contract for downstream agents. Drift between the real
 * Zod schemas and the example shapes in these docs causes silently-wrong
 * generations months later (the audit's C2 finding). This spec extracts
 * every JSON fence block from `model-format.md` and asserts it parses as
 * a Model — a build-time gate against the same drift recurring.
 *
 * The fence-block extractor is intentionally narrow: only ```json ... ```
 * blocks are validated. TypeScript signature blocks (```ts) are docs-only.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const MODEL_FORMAT_MD = resolve(REPO_ROOT, 'docs/.ai/model-format.md')

function extractJsonFences(markdown: string): string[] {
  const blocks: string[] = []
  const re = /```json\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

describe('docs/.ai/model-format.md JSON fence blocks', () => {
  const md = readFileSync(MODEL_FORMAT_MD, 'utf8')
  const blocks = extractJsonFences(md)

  it('contains at least one JSON example (sanity)', () => {
    expect(blocks.length).toBeGreaterThan(0)
  })

  it.each(blocks.map((b, i) => [i, b]))(
    'fence block #%i parses against ModelSchema',
    (_i, json) => {
      const parsed: unknown = JSON.parse(json)
      // ModelSchema.parse throws ZodError on mismatch — the error names the
      // offending path so the failing fence block can be located precisely.
      expect(() => ModelSchema.parse(parsed)).not.toThrow()
    }
  )

  it('does not document removed fields in any fence block (drift guard)', () => {
    // These names were in the historically-wrong version and caused silent
    // breakage downstream. Prose may mention them in passing ("there is no
    // elementsOrder field anymore"); the contract is that no fence block —
    // JSON or TS — names them as if they existed.
    const fences: string[] = []
    const re = /```(?:json|ts|typescript)\n([\s\S]*?)```/g
    let m: RegExpExecArray | null
    while ((m = re.exec(md)) !== null) {
      fences.push(m[1])
    }
    for (const f of fences) {
      expect(f).not.toMatch(/\belementsOrder\b/)
      expect(f).not.toMatch(/"dataType"\s*:/)
      expect(f).not.toMatch(/\battribute\.dataType\b/)
    }
  })

  it('does not reintroduce legacy PascalCase primitive names in JSON examples', () => {
    for (const block of blocks) {
      expect(block).not.toMatch(/"type"\s*:\s*"Date"/)
      expect(block).not.toMatch(/"type"\s*:\s*"UUID"/)
    }
  })
})
