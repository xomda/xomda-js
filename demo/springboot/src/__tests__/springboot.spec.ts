import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { generate, outputRoot } from '../generate'

beforeAll(async () => {
  await generate()
}, 30_000)

const javaRoot = join(outputRoot, 'src', 'main', 'java', 'com', 'example', 'blog')
const resourcesRoot = join(outputRoot, 'src', 'main', 'resources')

const read = (p: string) => readFile(p, 'utf-8')

describe('springboot demo — JPA entities', () => {
  it('Post entity has @Entity, @Table, @Id, @ManyToOne(Author)', async () => {
    const src = await read(join(javaRoot, 'entity', 'Post.java'))
    expect(src).toMatch(/package com\.example\.blog\.entity;/)
    expect(src).toMatch(/@Entity\b/)
    expect(src).toMatch(/@Table\(name = "post"\)/)
    expect(src).toMatch(/public class Post\b/)
    expect(src).toMatch(/@Id\s+@Column\(name = "id"/)
    expect(src).toMatch(
      /@ManyToOne\(fetch = FetchType\.LAZY, optional = false\)\s*\n\s*@JoinColumn\(name = "author_id", nullable = false\)\s*\n\s*private Author author;/
    )
    expect(src).toMatch(
      /@Enumerated\(EnumType\.STRING\)\s*\n\s*@Column\(name = "status", nullable = false\)\s*\n\s*private PostStatus status;/
    )
    expect(src).toMatch(/import com\.example\.blog\.enums\.PostStatus;/)
    expect(src).toMatch(/public LocalDateTime getPublishedAt\(\)/)
  })

  it('Author entity has unique email column', async () => {
    const src = await read(join(javaRoot, 'entity', 'Author.java'))
    expect(src).toMatch(
      /@Column\(name = "email", nullable = false, unique = true\)\s*\n\s*private String email;/
    )
  })

  it('Comment entity references Post and Author', async () => {
    const src = await read(join(javaRoot, 'entity', 'Comment.java'))
    expect(src).toMatch(/private Post post;/)
    expect(src).toMatch(/private Author author;/)
    expect(src).toMatch(/@JoinColumn\(name = "post_id", nullable = false\)/)
  })
})

describe('springboot demo — DTOs', () => {
  it('PostDto is a record with FK ids flattened', async () => {
    const src = await read(join(javaRoot, 'dto', 'PostDto.java'))
    expect(src).toMatch(/public record PostDto\(/)
    expect(src).toMatch(/UUID authorId/)
    expect(src).toMatch(/PostStatus status/)
    expect(src).toMatch(/LocalDateTime publishedAt/)
  })
})

describe('springboot demo — repositories & services', () => {
  it.each(['Author', 'Post', 'Comment'])('%sRepository extends JpaRepository', async (entity) => {
    const src = await read(join(javaRoot, 'repository', `${entity}Repository.java`))
    expect(src).toMatch(
      new RegExp(
        `@Repository\\s+public interface ${entity}Repository extends JpaRepository<${entity}, UUID>`
      )
    )
  })

  it.each(['Author', 'Post', 'Comment'])(
    '%sService delegates CRUD to repository',
    async (entity) => {
      const src = await read(join(javaRoot, 'service', `${entity}Service.java`))
      expect(src).toMatch(/@Service\b/)
      expect(src).toMatch(/@Transactional\b/)
      expect(src).toMatch(new RegExp(`public List<${entity}> findAll`))
      expect(src).toMatch(new RegExp(`public ${entity} save`))
    }
  )
})

describe('springboot demo — Java enum', () => {
  it('PostStatus is generated with model values', async () => {
    const src = await read(join(javaRoot, 'enums', 'PostStatus.java'))
    expect(src).toMatch(/public enum PostStatus/)
    for (const v of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      expect(src).toMatch(new RegExp(`\\b${v}\\b`))
    }
  })
})

describe('springboot demo — Postgres SQL migration', () => {
  let sql: string

  beforeAll(async () => {
    sql = await read(join(resourcesRoot, 'db', 'migration', 'V1__init.sql'))
  })

  it('creates a table per entity', () => {
    for (const tbl of ['author', 'post', 'comment']) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${tbl} \\(`))
    }
  })

  it('uses Postgres-native UUID and TIMESTAMP types', () => {
    expect(sql).toMatch(/\bid UUID PRIMARY KEY/)
    expect(sql).toMatch(/\bpublished_at TIMESTAMP/)
    expect(sql).toMatch(/\bcreated_at TIMESTAMP NOT NULL/)
  })

  it('declares FK constraints for entity references', () => {
    expect(sql).toMatch(/FOREIGN KEY \(author_id\) REFERENCES author\(id\)/)
    expect(sql).toMatch(/FOREIGN KEY \(post_id\) REFERENCES post\(id\)/)
  })

  it('emits CHECK constraint for enum-typed columns', () => {
    expect(sql).toMatch(/CHECK \(status IN \('DRAFT', 'PUBLISHED', 'ARCHIVED'\)\)/)
  })

  it('respects required and unique attribute flags', () => {
    expect(sql).toMatch(/email TEXT NOT NULL UNIQUE/)
    expect(sql).toMatch(/bio TEXT(?!\s+NOT NULL)/)
  })

  it('parenthesised CREATE TABLE blocks are well-balanced', () => {
    let depth = 0
    for (const ch of sql) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      expect(depth).toBeGreaterThanOrEqual(0)
    }
    expect(depth).toBe(0)
  })
})

describe('springboot demo — infrastructure files', () => {
  it('generates a docker-compose.yml with a Postgres service', async () => {
    const src = await read(join(outputRoot, 'docker-compose.yml'))
    expect(src).toMatch(/image: postgres:16-alpine/)
    expect(src).toMatch(/POSTGRES_DB: blog_service/)
    expect(src).toMatch(/5432:5432/)
    expect(src).toMatch(/healthcheck:/)
  })

  it('generates application.yml pointing at the docker-compose Postgres', async () => {
    const src = await read(join(resourcesRoot, 'application.yml'))
    expect(src).toMatch(/jdbc:postgresql:\/\/localhost:5432\/blog_service/)
    expect(src).toMatch(/dialect: org\.hibernate\.dialect\.PostgreSQLDialect/)
    expect(src).toMatch(/flyway:\s+enabled: true/)
  })

  it('generates a pom.xml targeting Spring Boot 4', async () => {
    const src = await read(join(outputRoot, 'pom.xml'))
    expect(src).toMatch(
      /<artifactId>spring-boot-starter-parent<\/artifactId>\s*<version>4\.0\.0<\/version>/
    )
    expect(src).toMatch(/spring-boot-starter-data-jpa/)
    expect(src).toMatch(/<artifactId>flyway-core<\/artifactId>/)
    expect(src).toMatch(/<artifactId>postgresql<\/artifactId>/)
  })

  it('generates the BlogServiceApplication entry point', async () => {
    const src = await read(join(javaRoot, 'BlogServiceApplication.java'))
    expect(src).toMatch(/@SpringBootApplication/)
    expect(src).toMatch(/public class BlogServiceApplication/)
    expect(src).toMatch(/SpringApplication\.run\(BlogServiceApplication\.class, args\)/)
  })
})

describe('springboot demo — output completeness', () => {
  it('emits an entity file for every entity in the model', async () => {
    const { model } = await generate({ write: false })
    for (const pkg of model.packages ?? []) {
      for (const e of pkg.entities ?? []) {
        expect(existsSync(join(javaRoot, 'entity', `${e.name}.java`))).toBe(true)
        expect(existsSync(join(javaRoot, 'repository', `${e.name}Repository.java`))).toBe(true)
        expect(existsSync(join(javaRoot, 'service', `${e.name}Service.java`))).toBe(true)
        expect(existsSync(join(javaRoot, 'dto', `${e.name}Dto.java`))).toBe(true)
      }
    }
  })
})
