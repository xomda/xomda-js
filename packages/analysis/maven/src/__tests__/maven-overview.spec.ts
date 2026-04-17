import type { AnalysisContext } from '@xomda/analysis-core'
import { describe, expect, it } from 'vitest'

import { mavenPlugin } from '../index'

const SIMPLE_POM = `
<project>
  <groupId>org.example</groupId>
  <artifactId>demo</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.1.0</version>
    </dependency>
  </dependencies>
</project>
`.trim()

function ctxWith(pom: string | null): AnalysisContext {
  return {
    rootPath: '/r',
    fileExists: () => pom !== null,
    listFiles: () => [],
    readFile: async (path) => (path === 'pom.xml' ? pom : null),
  }
}

describe('mavenPlugin.loadOverview', () => {
  it('returns null when pom.xml is missing', async () => {
    expect(await mavenPlugin.loadOverview!(ctxWith(null))).toBeNull()
  })

  it('builds the identity section + dependency table + source roots', async () => {
    const contribution = await mavenPlugin.loadOverview!(ctxWith(SIMPLE_POM))
    expect(contribution).not.toBeNull()
    expect(contribution!.pluginId).toBe('maven')

    const identity = contribution!.sections.find((s) => s.id === 'identity')
    expect(identity).toBeDefined()
    if (identity?.kind !== 'key-value') throw new Error('expected key-value section')
    const groupRow = identity.rows.find((r) => r.key === 'Group')
    expect(groupRow?.value).toBe('org.example')

    const deps = contribution!.sections.find((s) => s.id === 'deps')
    if (deps?.kind !== 'table') throw new Error('expected table section')
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toEqual(['org.springframework', 'spring-core', '6.1.0', 'compile'])

    const roots = contribution!.sections.find((s) => s.id === 'roots')
    if (roots?.kind !== 'key-value') throw new Error('expected key-value section')
    expect(roots.rows.find((r) => r.key === 'Main')?.value).toBe('src/main/java')
  })
})

describe('mavenPlugin pom.xml multi-view', () => {
  it('declares Source and Info views for pom.xml', () => {
    const pomFileType = mavenPlugin.fileTypes?.find((f) => f.id === 'pom')
    expect(pomFileType?.views).toHaveLength(2)
    expect(pomFileType?.views?.map((v) => v.id)).toEqual(['source', 'info'])
  })

  it('Info view declares a custom componentId and a server-side loader', () => {
    const pomFileType = mavenPlugin.fileTypes?.find((f) => f.id === 'pom')
    const info = pomFileType?.views?.find((v) => v.id === 'info')
    expect(info?.preview).toEqual({ kind: 'custom', componentId: 'maven-pom-info' })
    expect(typeof info?.loadViewData).toBe('function')
  })

  it('Info view loader parses pom.xml into PomMeta', async () => {
    const pomFileType = mavenPlugin.fileTypes?.find((f) => f.id === 'pom')
    const info = pomFileType?.views?.find((v) => v.id === 'info')
    const data = (await info!.loadViewData!(ctxWith(SIMPLE_POM), 'pom.xml')) as {
      artifactId: string
      dependencies: Array<{ artifactId: string }>
    }
    expect(data.artifactId).toBe('demo')
    expect(data.dependencies[0].artifactId).toBe('spring-core')
  })
})
