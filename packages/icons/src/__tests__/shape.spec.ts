import { describe, expect, it } from 'vitest'

// Named imports only — `import * as icons` materialises ~15k modules
// per spec file (one per Material Symbol) and adds seconds to the
// suite. Sample a representative spread of each format instead.
import {
  AddIcon,
  ChevronDownIcon,
  CloudDoneIcon,
  FolderIcon,
  PluginAntIcon,
  PluginBinaryIcon,
  PluginJavaIcon,
  PluginMavenIcon,
  PluginPrettierIcon,
  PluginRustIcon,
  PluginStylelintIcon,
  PluginTypeScriptIcon,
  PluginXomdaIcon,
  SaveIcon,
} from '..'

describe('@xomda/icons export shapes', () => {
  it('exports Material Symbols icons as SVG path strings', () => {
    // Material icons are bare `d=""` data — start with the standard SVG
    // path command set (`M`, `m`, `L`, `l`, …), never with `<`. Vuetify's
    // `mdi-svg` iconset wraps them in `<svg><path d="…"/></svg>` at render
    // time. The mix here covers: auto-generated name (`AddIcon`), alias
    // re-export (`SaveIcon` → `SaveOutlineIcon`), and an icon never
    // mentioned in `aliases.ts` so we know the auto pipeline reaches the
    // long tail (`CloudUploadIcon`).
    for (const [name, value] of [
      ['AddIcon', AddIcon],
      ['SaveIcon', SaveIcon],
      ['ChevronDownIcon', ChevronDownIcon],
      ['FolderIcon', FolderIcon],
      ['CloudDoneIcon', CloudDoneIcon],
    ] as const) {
      expect(typeof value, name).toBe('string')
      expect(value, name).not.toBe('')
      expect(value.startsWith('<'), `${name} should be a path, not full SVG`).toBe(false)
      expect(/^[Mm]/.test(value), `${name} should start with a moveto command`).toBe(true)
    }
  })

  it('exports devicon plugin icons as full SVG markup', () => {
    // Devicons are multi-path, multi-colour brand glyphs — must arrive as
    // a complete `<svg>…</svg>` string so `<SvgIcon>` can `innerHTML` them
    // verbatim and preserve baked-in `fill="#…"` attributes.
    for (const [name, value] of [
      ['PluginTypeScriptIcon', PluginTypeScriptIcon],
      ['PluginMavenIcon', PluginMavenIcon],
      ['PluginJavaIcon', PluginJavaIcon],
      ['PluginRustIcon', PluginRustIcon],
    ] as const) {
      expect(typeof value, name).toBe('string')
      expect(value, name).not.toBe('')
      expect(value.startsWith('<svg'), `${name} should start with <svg`).toBe(true)
      expect(value.includes('</svg>'), `${name} should be a closed SVG`).toBe(true)
    }
  })

  it('exports material-fallback plugin icons as SVG path strings', () => {
    // Plugins without a devicon match (Prettier, Stylelint, Ant, Binary,
    // Xomda) ship as monochrome Material Symbols paths — same shape as
    // the regular material icons, not full SVGs.
    for (const [name, value] of [
      ['PluginPrettierIcon', PluginPrettierIcon],
      ['PluginStylelintIcon', PluginStylelintIcon],
      ['PluginAntIcon', PluginAntIcon],
      ['PluginBinaryIcon', PluginBinaryIcon],
      ['PluginXomdaIcon', PluginXomdaIcon],
    ] as const) {
      expect(typeof value, name).toBe('string')
      expect(value, name).not.toBe('')
      expect(value.startsWith('<'), `${name} should be a path, not full SVG`).toBe(false)
    }
  })
})
