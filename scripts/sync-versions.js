#!/usr/bin/env node
/**
 * Syncs the version of every package and plugin in the workspace to the
 * version in the root package.json.
 *
 * Covers:
 *  - JS/TS workspace packages (package.json `.version` for each entry
 *    matched by pnpm-workspace.yaml globs).
 *  - Maven poms under integrations/jvm/ — both the module's own
 *    <version> and inherited <parent>/<dependency> <version> references
 *    where groupId is `org.xomda`.
 *  - Gradle / Kotlin-Gradle files — the top-level `version = '…'`
 *    declaration plus inline workspace deps `'org.xomda:xomda-…:V'`.
 *  - Eclipse Tycho artefacts under integrations/jvm/eclipse/ — the
 *    target-platform Maven location, feature.xml `version=` on
 *    <feature>, and Bundle-Version in META-INF/MANIFEST.MF.
 *
 * Version conventions:
 *  - JS/TS: rootPkg.version (e.g. "0.0.1")
 *  - Maven/Gradle JVM artefacts: "<version>-SNAPSHOT"
 *  - Eclipse Tycho bundles/features: "<version>.qualifier"
 *
 * The Maven/.target work is done with targeted regex replacements rather
 * than parse+reserialize so the original file formatting (indentation,
 * attribute layout, trailing newline) is preserved.
 */

import { globSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
const { version } = rootPkg
const javaVersion = `${version}-SNAPSHOT`
const eclipseVersion = `${version}.qualifier`

// Treat any artefact under this groupId as a workspace module whose
// <version> stays in sync with the root.
const INTERNAL_GROUP_ID = 'org.xomda'
const INTERNAL_GROUP_ID_RE = INTERNAL_GROUP_ID.replace(/\./g, '\\.')

const workspaceYaml = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf-8')
const patterns = [...workspaceYaml.matchAll(/^\s+-\s+'(.+?)'/gm)].map(([, p]) => p)
const pkgPaths = patterns.flatMap((pattern) =>
  globSync(`${pattern}/package.json`, { cwd: root, absolute: true })
)

// Filter generated/output directories out of any glob.
const isGenerated = (p) =>
  /[/\\](target|\.m2-repo|node_modules|build|\.gradle|output|dist)[/\\]/.test(p)

let updated = 0
const rel = (p) => p.replace(`${root}/`, '')

const fileLogger = (label) => {
  let printed = false
  return (msg) => {
    if (!printed) {
      console.log(label)
      printed = true
    }
    console.log(`  ${msg}`)
  }
}

// ─── JS/TS workspace packages ─────────────────────────────────────────
for (const pkgPath of pkgPaths) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  if (pkg.version === version) continue
  const prev = pkg.version
  pkg.version = version
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`Updated ${pkg.name}: ${prev} → ${version}`)
  updated++
}

// ─── Maven pom.xml ────────────────────────────────────────────────────
//
// Matches <groupId>org.xomda</groupId> <artifactId>…</artifactId>
// <version>…</version> (whitespace permitted between siblings). One
// regex covers all three cases that need updating: the project's own
// version, <parent><version>, and inter-module <dependency><version>.
const pomVersionRe = new RegExp(
  `(<groupId>${INTERNAL_GROUP_ID_RE}</groupId>\\s*` +
    `<artifactId>)([^<]+)(</artifactId>\\s*<version>)([^<]+)(</version>)`,
  'g'
)

const pomPaths = globSync('integrations/jvm/**/pom.xml', {
  cwd: root,
  absolute: true,
}).filter((p) => !isGenerated(p))

for (const pomPath of pomPaths) {
  const before = readFileSync(pomPath, 'utf-8')
  const log = fileLogger(rel(pomPath))
  const after = before.replace(pomVersionRe, (m, p1, artifactId, p2, ver, p3) => {
    if (ver === javaVersion) return m
    log(`${artifactId}: ${ver} → ${javaVersion}`)
    updated++
    return `${p1}${artifactId}${p2}${javaVersion}${p3}`
  })
  if (after !== before) writeFileSync(pomPath, after)
}

// ─── Gradle / Kotlin-Gradle ───────────────────────────────────────────
const gradlePaths = globSync('integrations/jvm/**/build.gradle{,.kts}', {
  cwd: root,
  absolute: true,
}).filter((p) => !isGenerated(p))
for (const gradlePath of gradlePaths) {
  const before = readFileSync(gradlePath, 'utf-8')
  const log = fileLogger(rel(gradlePath))
  let content = before

  // Top-level `version = '…'` / `version = "…"`
  content = content.replace(/^(version\s*=\s*['"])([^'"]+)(['"])/m, (m, p, ver, s) => {
    if (ver === javaVersion) return m
    log(`version: ${ver} → ${javaVersion}`)
    updated++
    return `${p}${javaVersion}${s}`
  })

  // Inline workspace deps: 'org.xomda:xomda-…:V' / "org.xomda:xomda-…:V"
  content = content.replace(
    new RegExp(`(['"])(${INTERNAL_GROUP_ID_RE}:[^:'"]+:)([^'"]+)(['"])`, 'g'),
    (m, q1, coord, ver, q2) => {
      if (ver === javaVersion) return m
      log(`${coord}${ver} → ${javaVersion}`)
      updated++
      return `${q1}${coord}${javaVersion}${q2}`
    }
  )

  if (content !== before) writeFileSync(gradlePath, content)
}

// ─── Eclipse Tycho target file ────────────────────────────────────────
const targetPaths = globSync('integrations/jvm/eclipse/**/*.target', {
  cwd: root,
  absolute: true,
}).filter((p) => !isGenerated(p))
for (const targetPath of targetPaths) {
  const before = readFileSync(targetPath, 'utf-8')
  const log = fileLogger(rel(targetPath))
  const after = before.replace(pomVersionRe, (m, p1, artifactId, p2, ver, p3) => {
    if (ver === javaVersion) return m
    log(`dependency ${artifactId}: ${ver} → ${javaVersion}`)
    updated++
    return `${p1}${artifactId}${p2}${javaVersion}${p3}`
  })
  if (after !== before) writeFileSync(targetPath, after)
}

// ─── Eclipse feature.xml ──────────────────────────────────────────────
const featureXmlPaths = globSync('integrations/jvm/eclipse/**/feature.xml', {
  cwd: root,
  absolute: true,
}).filter((p) => !isGenerated(p))
for (const featureXmlPath of featureXmlPaths) {
  const before = readFileSync(featureXmlPath, 'utf-8')
  const log = fileLogger(rel(featureXmlPath))
  // <feature ... version="X.Y.Z.qualifier" ...>
  const after = before.replace(/(<feature\b[^>]*\bversion=")([^"]+)(")/, (m, p, ver, s) => {
    if (ver === eclipseVersion) return m
    log(`feature.version: ${ver} → ${eclipseVersion}`)
    updated++
    return `${p}${eclipseVersion}${s}`
  })
  if (after !== before) writeFileSync(featureXmlPath, after)
}

// ─── Eclipse MANIFEST.MF (Bundle-Version) ─────────────────────────────
const manifestPaths = globSync('integrations/jvm/eclipse/**/META-INF/MANIFEST.MF', {
  cwd: root,
  absolute: true,
}).filter((p) => !isGenerated(p))
for (const manifestPath of manifestPaths) {
  const before = readFileSync(manifestPath, 'utf-8')
  const log = fileLogger(rel(manifestPath))
  const after = before.replace(/^(Bundle-Version:\s*)(\S+)/m, (m, p, ver) => {
    if (ver === eclipseVersion) return m
    log(`Bundle-Version: ${ver} → ${eclipseVersion}`)
    updated++
    return `${p}${eclipseVersion}`
  })
  if (after !== before) writeFileSync(manifestPath, after)
}

if (updated === 0) {
  console.log(`All packages already at version ${version} / ${javaVersion} / ${eclipseVersion}.`)
} else {
  console.log(
    `\nSynced ${updated} entr${updated === 1 ? 'y' : 'ies'} to ` +
      `${version} (js) / ${javaVersion} (jvm) / ${eclipseVersion} (eclipse).`
  )
}
