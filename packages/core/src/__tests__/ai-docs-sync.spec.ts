import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import {
  AttributeSchema,
  EntitySchema,
  EnumSchema,
  EnumValueSchema,
  ModelSchema,
  PackageSchema,
} from '../schemas/index'

const REPO_ROOT = resolve(import.meta.dirname, '../../../..')
const DOC_PATH = resolve(REPO_ROOT, 'docs/.ai/model-format.md')

/**
 * Extract the field names declared inside the `\`\`\`ts { … } \`\`\`` code
 * block of a `## \`Name\`` (or `## Root: \`Name\``) section. Strips
 * `?`, defaults, and trailing comments so what comes out is the bare
 * field name (`id`, `name`, …).
 */
function fieldsInSection(md: string, sectionName: string): Set<string> {
  // Section header can be `## \`Entity\`` or `## Root: \`Model\``.
  const escName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^##\\s+(?:Root:\\s+)?\`${escName}\`\\s*$`, 'm')
  const headerMatch = re.exec(md)
  if (!headerMatch) throw new Error(`section "${sectionName}" not found in model-format.md`)
  const after = md.slice(headerMatch.index + headerMatch[0].length)
  const codeBlock = /```ts\s*\n([\s\S]*?)\n```/.exec(after)
  if (!codeBlock) throw new Error(`no ts code block under "${sectionName}"`)
  return parseFieldNames(codeBlock[1])
}

function parseFieldNames(code: string): Set<string> {
  const out = new Set<string>()
  for (const rawLine of code.split('\n')) {
    // Strip line comments and trailing whitespace.
    const line = rawLine.replace(/\/\/.*$/, '').trim()
    // We only care about lines of shape `name: ...` or `name?: ...`.
    // The doc uses block comments (`/** … */`) and braces — skip those.
    const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\??\s*:/.exec(line)
    if (m) out.add(m[1])
  }
  return out
}

/**
 * Drill through Zod 4 wrappers (\`preprocess\` → \`pipe\`, \`lazy\`) to
 * the underlying \`z.object\` so we can read its \`.shape\`. Loose-typed
 * because we are intentionally touching internals only this spec is
 * allowed to know about.
 */
function schemaKeys(schema: z.ZodTypeAny): Set<string> {
  type WithShape = { shape?: Record<string, unknown> }
  type WithDef = {
    _def?: { type?: string; in?: unknown; out?: unknown; getter?: () => unknown }
    def?: { type?: string; in?: unknown; out?: unknown; getter?: () => unknown }
  }
  let s: WithShape & WithDef = schema as unknown as WithShape & WithDef
  for (let i = 0; i < 8; i++) {
    if (s.shape && typeof s.shape === 'object') return new Set(Object.keys(s.shape))
    const def = s._def ?? s.def
    if (!def) break
    if (def.type === 'pipe' && def.out) {
      // \`z.preprocess(fn, inner)\` lands as { type: 'pipe', in, out };
      // the typed shape we care about is on \`out\`.
      s = def.out as typeof s
      continue
    }
    if (def.type === 'lazy' && typeof def.getter === 'function') {
      s = def.getter() as typeof s
      continue
    }
    break
  }
  throw new Error('could not find .shape on schema')
}

describe('docs/.ai/model-format.md ↔ @xomda/core schemas', () => {
  const md = readFileSync(DOC_PATH, 'utf8')

  const cases: ReadonlyArray<{
    name: string
    schema: z.ZodTypeAny
    // Doc may legitimately mention fewer fields (deliberate omissions
    // for AI-readability) — track those here. Any *extra* field in the
    // doc that the schema doesn't declare is always a bug.
    docOmissions?: ReadonlySet<string>
  }> = [
    // Doc deliberately omits `versions` (workspace-time, not persisted
    // in the on-disk Model surface that downstream agents see).
    { name: 'Model', schema: ModelSchema, docOmissions: new Set(['versions']) },
    { name: 'Package', schema: PackageSchema, docOmissions: new Set(['visibility']) },
    {
      name: 'Entity',
      schema: EntitySchema,
      // Doc defers `kind`, `implements`, and `visibility` to the
      // inheritance + visibility doc pages.
      docOmissions: new Set(['kind', 'implements', 'visibility']),
    },
    { name: 'Attribute', schema: AttributeSchema },
    { name: 'Enum', schema: EnumSchema },
    { name: 'EnumValue', schema: EnumValueSchema, docOmissions: new Set(['description']) },
  ]

  for (const { name, schema, docOmissions = new Set() } of cases) {
    describe(`${name}`, () => {
      const docFields = fieldsInSection(md, name)
      const schemaFields = schemaKeys(schema)

      it('mentions every schema field that is not on the deliberate-omission list', () => {
        const missing = [...schemaFields]
          .filter((f) => !docFields.has(f))
          .filter((f) => !docOmissions.has(f))
        expect(missing).toEqual([])
      })

      it('does not invent a field the schema does not declare', () => {
        const phantom = [...docFields].filter((f) => !schemaFields.has(f))
        expect(phantom).toEqual([])
      })
    })
  }
})
