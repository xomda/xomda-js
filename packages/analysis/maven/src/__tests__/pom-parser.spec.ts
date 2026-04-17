import { describe, expect, it } from 'vitest'

import { parsePom } from '../pom-parser'

const POM = `
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.parent</groupId>
    <artifactId>parent-app</artifactId>
    <version>1.0.0</version>
  </parent>
  <groupId>org.example</groupId>
  <artifactId>demo</artifactId>
  <version>2.5.0</version>
  <packaging>jar</packaging>
  <name>Demo</name>
  <description>A short description.</description>
  <modules>
    <module>core</module>
    <module>cli</module>
  </modules>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.unused</groupId>
        <artifactId>excluded</artifactId>
        <version>1.0</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>6.1.0</version>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>5.11.0</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <sourceDirectory>src/main/kotlin</sourceDirectory>
    <testSourceDirectory>src/test/kotlin</testSourceDirectory>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
      </plugin>
      <plugin>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.0</version>
      </plugin>
    </plugins>
  </build>
</project>
`.trim()

describe('parsePom', () => {
  const meta = parsePom(POM)

  it('extracts identity (excluding parent block)', () => {
    expect(meta.groupId).toBe('org.example')
    expect(meta.artifactId).toBe('demo')
    expect(meta.version).toBe('2.5.0')
    expect(meta.packaging).toBe('jar')
    expect(meta.name).toBe('Demo')
    expect(meta.description).toBe('A short description.')
  })

  it('extracts modules', () => {
    expect(meta.modules).toEqual(['core', 'cli'])
  })

  it('extracts direct dependencies and skips dependencyManagement', () => {
    expect(meta.dependencies).toEqual([
      { groupId: 'org.springframework', artifactId: 'spring-core', version: '6.1.0' },
      {
        groupId: 'org.junit.jupiter',
        artifactId: 'junit-jupiter',
        version: '5.11.0',
        scope: 'test',
      },
    ])
  })

  it('extracts build plugins', () => {
    expect(meta.plugins).toEqual([
      {
        groupId: 'org.apache.maven.plugins',
        artifactId: 'maven-compiler-plugin',
        version: '3.13.0',
      },
      { artifactId: 'maven-surefire-plugin', version: '3.5.0' },
    ])
  })

  it('extracts custom source roots when set', () => {
    expect(meta.sourceRoot).toBe('src/main/kotlin')
    expect(meta.testSourceRoot).toBe('src/test/kotlin')
  })

  it('falls back gracefully when only artifactId is present', () => {
    const minimal = parsePom('<project><artifactId>tiny</artifactId></project>')
    expect(minimal.artifactId).toBe('tiny')
    expect(minimal.dependencies).toEqual([])
    expect(minimal.plugins).toEqual([])
    expect(minimal.modules).toEqual([])
  })
})
