/**
 * Emits two icon catalogues, both tree-shakeable:
 *
 *   - **Material Symbols** (from `@iconify-json/material-symbols-light`)
 *     ~15.4k icons. Each becomes its own `.ts` module under
 *     `src/icons/material/`: `export const <Name>Icon = "M…"`. Vuetify's
 *     `mdi-svg` iconset wraps the path string at render time.
 *
 *   - **Devicons** (from the `devicon` npm package). ~578 brand glyphs.
 *     **Single** `src/icons/devicons.ts` file containing one
 *     `?raw` import per icon plus named re-exports. Each `?raw`
 *     specifier is its own module in the build graph, so Rollup drops
 *     unused imports as long as the consuming package has
 *     `sideEffects: false` (which `@xomda/icons` does). One file is
 *     enough — no need for 578 per-icon `.ts` shims.
 *
 * The auto-names are `pascalCase(name) + 'Icon'` (Material) and
 * `pascalCase(name) + 'BrandIcon'` (devicon). The `Brand` suffix on
 * devicons disambiguates from Material icons that happen to share a
 * root name.
 *
 * Semantic renames (`SaveIcon` → `SaveOutlineIcon`, `PluginMavenIcon`
 * → `MavenBrandIcon`, …) live in `src/aliases.ts`. The generator
 * validates each target exists, emits the alias as a re-export, and
 * shadows any auto-named export with the same identifier so there's
 * never a duplicate.
 *
 * Runs as `@xomda/icons`' own `postinstall`. All output is gitignored
 * — `pnpm install` is the only setup step a fresh checkout needs.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import materialJson from '@iconify-json/material-symbols-light/icons.json' with { type: 'json' }
import deviconJson from 'devicon/devicon.json' with { type: 'json' }

import { DEVICON_ALIASES, MATERIAL_ALIASES } from '../src/aliases.ts'

interface IconifyIconSet {
  readonly icons: Record<string, { readonly body: string }>
}

interface DeviconEntry {
  readonly name: string
  readonly versions: { readonly svg: readonly string[] }
}

const material = materialJson as IconifyIconSet
const devicons = deviconJson as readonly DeviconEntry[]

const thisDir = dirname(fileURLToPath(import.meta.url))
const srcDir = join(thisDir, '..', 'src')
const materialDir = join(srcDir, 'icons', 'material')
const deviconsFile = join(srcDir, 'icons', 'devicons.ts')

// Devicon variant priority — first one that exists for an icon wins.
// `original` keeps the brand colour palette; `plain` and `line` are
// single-colour fallbacks for the ~19 icons that ship no original.
const DEVICON_VARIANT_PRIORITY = ['original', 'plain', 'line'] as const

function pascalCase(name: string): string {
  return name
    .split('-')
    .map((seg) => (seg.length > 0 ? seg[0]!.toUpperCase() + seg.slice(1) : ''))
    .join('')
}

function isValidIdentifierStart(name: string): boolean {
  // JS identifiers must start with a letter, `_`, or `$`. Iconify
  // includes names like `123`, `10k` — skip them. Add to aliases.ts
  // to expose any digit-leading icon under a friendly name.
  return /^[A-Za-z_$]/.test(name)
}

function materialAutoName(iconifyName: string): string {
  return `${pascalCase(iconifyName)}Icon`
}

function deviconAutoName(deviconName: string): string {
  return `${pascalCase(deviconName)}BrandIcon`
}

function extractPath(iconName: string, body: string): string {
  // Iconify ships material-symbols-light bodies as a single `<path d="…"/>`.
  const match = body.match(/d="([^"]+)"/)
  if (!match) {
    throw new Error(`generate: no \`d=""\` found in iconify body for "${iconName}"`)
  }
  return match[1]
}

function pickDeviconVariant(entry: DeviconEntry): string {
  const available = entry.versions?.svg ?? []
  for (const v of DEVICON_VARIANT_PRIORITY) {
    if (available.includes(v)) return v
  }
  if (available.length === 0) {
    throw new Error(`generate: devicon "${entry.name}" has no SVG variants in devicon.json`)
  }
  return available[0]!
}

function generateMaterial(): string[] {
  rmSync(materialDir, { recursive: true, force: true })
  mkdirSync(materialDir, { recursive: true })

  const iconifyNames = Object.keys(material.icons).filter(isValidIdentifierStart).sort()
  for (const iconifyName of iconifyNames) {
    const exportName = materialAutoName(iconifyName)
    const d = extractPath(iconifyName, material.icons[iconifyName]!.body)
    writeFileSync(
      join(materialDir, `${exportName}.ts`),
      `export const ${exportName} = ${JSON.stringify(d)}\n`
    )
  }

  // No `.ts` extension on emitted import paths — tsc rejects them under
  // the workspace default (`allowImportingTsExtensions: false`).
  const indexBody = iconifyNames
    .map((n) => `export { ${materialAutoName(n)} } from './${materialAutoName(n)}'`)
    .join('\n')
  writeFileSync(join(materialDir, 'index.ts'), `${indexBody}\n`)

  return iconifyNames
}

function generateDevicons(): { autoName: string; deviconName: string }[] {
  const entries = [...devicons]
    .filter((e) => isValidIdentifierStart(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Local binding names for each `?raw` import — must be unique JS
  // identifiers. We use the devicon name itself, lowercased with
  // non-`[A-Za-z0-9_$]` chars stripped, plus a `_svg` suffix.
  const emitted = entries.map((entry) => {
    const variant = pickDeviconVariant(entry)
    const autoName = deviconAutoName(entry.name)
    const localBinding = `${entry.name.replace(/[^A-Za-z0-9_$]/g, '_')}_svg`
    const importPath = `devicon/icons/${entry.name}/${entry.name}-${variant}.svg?raw`
    return { autoName, deviconName: entry.name, localBinding, importPath }
  })

  const importLines = emitted.map(
    (e) => `import ${e.localBinding} from ${JSON.stringify(e.importPath)}`
  )

  // One single `export { … }` clause holding every rename — Rollup
  // analyses each `as Name` independently and tree-shakes the unused
  // ones along with their corresponding `?raw` imports.
  const exportLines = emitted.map((e) => `  ${e.localBinding} as ${e.autoName},`)

  const body = [
    `/**`,
    ` * AUTO-GENERATED by scripts/generate.ts — do not edit.`,
    ` * Edit src/aliases.ts (for renames) and re-run`,
    ` * \`pnpm -F @xomda/icons generate\`.`,
    ` *`,
    ` * One \`?raw\` import per devicon (${emitted.length} total). Each import`,
    ` * is its own module in the build graph; with \`sideEffects: false\` in`,
    ` * \`package.json\`, Rollup drops every import the consumer doesn't`,
    ` * reach via the named re-export — so dev only pays for what it imports.`,
    ` */`,
    ...importLines,
    ``,
    `export {`,
    ...exportLines,
    `}`,
    ``,
  ].join('\n')
  writeFileSync(deviconsFile, body)

  return emitted.map((e) => ({ autoName: e.autoName, deviconName: e.deviconName }))
}

function generateTopIndex(
  materialNames: readonly string[],
  deviconEmitted: readonly { autoName: string; deviconName: string }[]
): void {
  const aliasNames = new Set<string>()
  const aliasLines: string[] = []

  for (const [aliasName, iconifyName] of Object.entries(MATERIAL_ALIASES)) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(aliasName)) {
      throw new Error(`generate: material alias "${aliasName}" is not a valid identifier`)
    }
    if (!material.icons[iconifyName]) {
      throw new Error(
        `generate: material alias "${aliasName}" → "${iconifyName}" not in material-symbols-light`
      )
    }
    aliasNames.add(aliasName)
    const target = materialAutoName(iconifyName)
    aliasLines.push(`export { ${target} as ${aliasName} } from './icons/material/${target}'`)
  }

  const deviconNameSet = new Set(deviconEmitted.map((e) => e.deviconName))
  for (const [aliasName, deviconName] of Object.entries(DEVICON_ALIASES)) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(aliasName)) {
      throw new Error(`generate: devicon alias "${aliasName}" is not a valid identifier`)
    }
    if (!deviconNameSet.has(deviconName)) {
      throw new Error(
        `generate: devicon alias "${aliasName}" → "${deviconName}" not in devicon manifest`
      )
    }
    aliasNames.add(aliasName)
    const target = deviconAutoName(deviconName)
    aliasLines.push(`export { ${target} as ${aliasName} } from './icons/devicons'`)
  }

  const materialAutos = materialNames
    .map(materialAutoName)
    .filter((n) => !aliasNames.has(n))
    .map((n) => `export { ${n} } from './icons/material/${n}'`)

  const deviconAutos = deviconEmitted
    .map((e) => e.autoName)
    .filter((n) => !aliasNames.has(n))
    .map((n) => `export { ${n} } from './icons/devicons'`)

  const indexBody = [
    `// AUTO-GENERATED by scripts/generate.ts — do not edit.`,
    `// Edit src/aliases.ts for renames, then run \`pnpm -F @xomda/icons generate\`.`,
    ``,
    // Surface the `*.svg?raw` ambient declaration to every consumer that
    // follows our types — analysis plugins typecheck through this entry
    // point without bringing in `vite/client`.
    `/// <reference path="./env.d.ts" />`,
    ``,
    `// Material Symbols (auto-named from iconify)`,
    ...materialAutos,
    ``,
    `// Devicon brand glyphs (auto-named from the devicon manifest)`,
    ...deviconAutos,
    ``,
    `// Semantic aliases (src/aliases.ts)`,
    ...aliasLines,
    ``,
  ].join('\n')
  writeFileSync(join(srcDir, 'index.ts'), indexBody)
}

function generate(): void {
  const materialNames = generateMaterial()
  const deviconEmitted = generateDevicons()
  generateTopIndex(materialNames, deviconEmitted)
  console.log(
    `@xomda/icons: generated ${materialNames.length} material + ${deviconEmitted.length} devicons` +
      ` (+${Object.keys(MATERIAL_ALIASES).length + Object.keys(DEVICON_ALIASES).length} aliases)`
  )
}

generate()
