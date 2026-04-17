#!/usr/bin/env node
/**
 * Syncs the version of all workspace packages to the version in the root package.json.
 * Also syncs Java lib versions (pom.xml and build.gradle) in the /lib folder.
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { globSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
const { version } = rootPkg
const javaVersion = `${version}-SNAPSHOT`

// Parse workspace glob patterns from pnpm-workspace.yaml
const workspaceYaml = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf-8')
const patterns = [...workspaceYaml.matchAll(/^\s+-\s+'(.+?)'/gm)].map(([, p]) => p)

const pkgPaths = patterns.flatMap((pattern) =>
  globSync(`${pattern}/package.json`, { cwd: root, absolute: true })
)

let updated = 0

// Sync JS/TS workspace packages
for (const pkgPath of pkgPaths) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  if (pkg.version === version) continue
  const prev = pkg.version
  pkg.version = version
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(`Updated ${pkg.name}: ${prev} → ${version}`)
  updated++
}

// Sync Maven pom.xml files in /lib
const parser = new DOMParser()
const serializer = new XMLSerializer()
const pomPaths = globSync('lib/**/pom.xml', { cwd: root, absolute: true })
for (const pomPath of pomPaths) {
  const content = readFileSync(pomPath, 'utf-8')
  const doc = parser.parseFromString(content, 'text/xml')
  const versionNodes = doc.documentElement.childNodes
  let changed = false
  for (let i = 0; i < versionNodes.length; i++) {
    const node = versionNodes[i]
    if (node.nodeName === 'version') {
      const current = node.textContent
      if (current !== javaVersion) {
        console.log(`Updated ${pomPath.replace(`${root}/`, '')}: ${current} → ${javaVersion}`)
        node.textContent = javaVersion
        changed = true
        updated++
      }
      break
    }
  }
  if (changed) writeFileSync(pomPath, serializer.serializeToString(doc))
}

// Sync Gradle build.gradle files in /lib
const gradlePaths = globSync('lib/**/build.gradle', { cwd: root, absolute: true })
for (const gradlePath of gradlePaths) {
  const content = readFileSync(gradlePath, 'utf-8')
  const updated_content = content.replace(
    /^(version\s*=\s*['"])([^'"]+)(['"])/m,
    (match, prefix, ver, suffix) => {
      if (ver === javaVersion) return match
      console.log(`Updated ${gradlePath.replace(`${root}/`, '')}: ${ver} → ${javaVersion}`)
      updated++
      return `${prefix}${javaVersion}${suffix}`
    }
  )
  if (updated_content !== content) writeFileSync(gradlePath, updated_content)
}

if (updated === 0) {
  console.log(`All packages already at version ${version} / ${javaVersion}.`)
} else {
  console.log(`\nSynced ${updated} package(s) to version ${version} / ${javaVersion}.`)
}
