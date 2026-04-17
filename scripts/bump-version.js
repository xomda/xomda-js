#!/usr/bin/env node
/**
 * Bumps the build (patch) version of the root package.json.
 * Usage: node scripts/bump-version.js [major|minor|patch]
 * Defaults to "patch" when no argument is provided.
 */

import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const pkgPath = resolve(root, 'package.json')

const release = process.argv[2] ?? 'patch'
if (!['major', 'minor', 'patch'].includes(release)) {
  console.error(`Invalid release type "${release}". Use major, minor, or patch.`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)

const next =
  release === 'major'
    ? `${major + 1}.0.0`
    : release === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`

const prev = pkg.version
pkg.version = next
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)  }\n`)
console.log(`Bumped version: ${prev} → ${next}`)
