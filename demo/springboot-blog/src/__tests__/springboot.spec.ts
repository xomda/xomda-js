import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'
import type { RenderResult } from 'xomda'
import { preview } from 'xomda'

// Fast inner loop: render the demo's templates against the committed
// .xomda/model.json via the public `xomda` API and assert on the resulting
// source text. No FS writes. The outer loop
// (`mvn test` via `pnpm -F @xomda/demo-springboot-blog test:jvm`) is what
// actually compiles the generated code and runs @SpringBootTest against it.
const demoRoot = fileURLToPath(new URL('../..', import.meta.url))

let results: RenderResult[]

function findByPath(suffix: string) {
  const hit = results.find((r) => r.outputPath.endsWith(suffix))
  expect(hit, `expected a render result for ${suffix}`).toBeDefined()
  return hit!
}

beforeAll(async () => {
  results = await preview(demoRoot)
})

describe('demo/springboot-blog — JPA entities', () => {
  it('Post entity has @Entity, @Table, @Id, @ManyToOne(Author), @Enumerated', () => {
    const post = findByPath('src/main/generated/com/example/blog/entity/Post.java')
    expect(post.content).toMatch(/package com\.example\.blog\.entity;/)
    expect(post.content).toMatch(/@Entity\b/)
    expect(post.content).toMatch(/@Table\(name = "post"\)/)
    expect(post.content).toMatch(/public class Post\b/)
    expect(post.content).toMatch(/@Id\s+@Column\(name = "id"/)
    expect(post.content).toMatch(
      /@ManyToOne\(fetch = FetchType\.LAZY, optional = false\)\s*\n\s*@JoinColumn\(name = "author_id", nullable = false\)\s*\n\s*private Author author;/
    )
    expect(post.content).toMatch(
      /@Enumerated\(EnumType\.STRING\)\s*\n\s*@Column\(name = "status", nullable = false\)\s*\n\s*private PostStatus status;/
    )
    expect(post.content).toMatch(/import com\.example\.blog\.enums\.PostStatus;/)
    expect(post.content).toMatch(/public LocalDateTime getPublishedAt\(\)/)
  })

  it('Author entity has unique email column', () => {
    const author = findByPath('src/main/generated/com/example/blog/entity/Author.java')
    expect(author.content).toMatch(
      /@Column\(name = "email", nullable = false, unique = true\)\s*\n\s*private String email;/
    )
  })

  it('Comment entity references Post and Author', () => {
    const comment = findByPath('src/main/generated/com/example/blog/entity/Comment.java')
    expect(comment.content).toMatch(/private Post post;/)
    expect(comment.content).toMatch(/private Author author;/)
    expect(comment.content).toMatch(/@JoinColumn\(name = "post_id", nullable = false\)/)
  })
})

describe('demo/springboot-blog — DTOs', () => {
  it('PostDto is a record with FK ids flattened', () => {
    const dto = findByPath('src/main/generated/com/example/blog/dto/PostDto.java')
    expect(dto.content).toMatch(/public record PostDto\(/)
    expect(dto.content).toMatch(/UUID authorId/)
    expect(dto.content).toMatch(/PostStatus status/)
    expect(dto.content).toMatch(/LocalDateTime publishedAt/)
  })
})

describe('demo/springboot-blog — repositories & services', () => {
  it.each(['Author', 'Post', 'Comment'])(
    '%sRepository extends JpaRepository<%s, UUID>',
    (entity) => {
      const repo = findByPath(
        `src/main/generated/com/example/blog/repository/${entity}Repository.java`
      )
      expect(repo.content).toMatch(
        new RegExp(
          `@Repository\\s+public interface ${entity}Repository extends JpaRepository<${entity}, UUID>`
        )
      )
    }
  )

  it.each(['Author', 'Post', 'Comment'])('%sService delegates CRUD to the repository', (entity) => {
    const svc = findByPath(`src/main/generated/com/example/blog/service/${entity}Service.java`)
    expect(svc.content).toMatch(/@Service\b/)
    expect(svc.content).toMatch(/@Transactional\b/)
    expect(svc.content).toMatch(new RegExp(`public List<${entity}> findAll`))
    expect(svc.content).toMatch(new RegExp(`public ${entity} save`))
  })
})

describe('demo/springboot-blog — Java enum', () => {
  it('PostStatus is generated with model values', () => {
    const en = findByPath('src/main/generated/com/example/blog/enums/PostStatus.java')
    expect(en.content).toMatch(/public enum PostStatus/)
    for (const v of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      expect(en.content).toMatch(new RegExp(`\\b${v}\\b`))
    }
  })
})

describe('demo/springboot-blog — Elasticsearch documents', () => {
  it.each(['Author', 'Post', 'Comment'])(
    '%sDocument is a @Document(indexName=...) POJO with @Field-annotated mirrors',
    (entity) => {
      const doc = findByPath(`src/main/generated/com/example/blog/search/${entity}Document.java`)
      expect(doc.content).toMatch(/package com\.example\.blog\.search;/)
      expect(doc.content).toMatch(
        /import org\.springframework\.data\.elasticsearch\.annotations\.Document;/
      )
      expect(doc.content).toMatch(
        new RegExp(`@Document\\(indexName = "${entity.toLowerCase()}"\\)`)
      )
      expect(doc.content).toMatch(new RegExp(`public class ${entity}Document\\b`))
      // Entity references denormalise to UUID + Keyword in the search projection.
      if (entity === 'Post' || entity === 'Comment') {
        expect(doc.content).toMatch(/@Field\(type = FieldType\.Keyword\)\s+private UUID author/)
      }
    }
  )

  it('PostDocument projects the enum as a Keyword field, not as the JPA enum type', () => {
    const doc = findByPath('src/main/generated/com/example/blog/search/PostDocument.java')
    // Enums denormalise to a String stored as keyword — no enum-class navigation
    // from the search projection.
    expect(doc.content).toMatch(/@Field\(type = FieldType\.Keyword\)\s+private String status/)
    expect(doc.content).not.toMatch(/PostStatus status/)
  })
})

describe('demo/springboot-blog — Postgres SQL migration', () => {
  function readSql() {
    return findByPath('src/main/generated-resources/db/migration/V1__init.sql').content
  }

  it('creates a table per entity', () => {
    const sql = readSql()
    for (const tbl of ['author', 'post', 'comment']) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${tbl} \\(`))
    }
  })

  it('uses Postgres-native UUID and TIMESTAMP types', () => {
    const sql = readSql()
    expect(sql).toMatch(/\bid UUID PRIMARY KEY/)
    expect(sql).toMatch(/\bpublished_at TIMESTAMP/)
    expect(sql).toMatch(/\bcreated_at TIMESTAMP NOT NULL/)
  })

  it('declares FK constraints for entity references', () => {
    const sql = readSql()
    expect(sql).toMatch(/FOREIGN KEY \(author_id\) REFERENCES author\(id\)/)
    expect(sql).toMatch(/FOREIGN KEY \(post_id\) REFERENCES post\(id\)/)
  })

  it('emits CHECK constraint for enum-typed columns', () => {
    const sql = readSql()
    expect(sql).toMatch(/CHECK \(status IN \('DRAFT', 'PUBLISHED', 'ARCHIVED'\)\)/)
  })

  it('respects required and unique attribute flags', () => {
    const sql = readSql()
    expect(sql).toMatch(/email TEXT NOT NULL UNIQUE/)
    expect(sql).toMatch(/bio TEXT(?!\s+NOT NULL)/)
  })

  it('parenthesised CREATE TABLE blocks are well-balanced', () => {
    const sql = readSql()
    let depth = 0
    for (const ch of sql) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      expect(depth).toBeGreaterThanOrEqual(0)
    }
    expect(depth).toBe(0)
  })
})

describe('demo/springboot-blog — output completeness', () => {
  it('emits a Java artefact per entity (entity + repository + service + DTO)', () => {
    const outputs = new Set(results.map((r) => r.outputPath))
    for (const entity of ['Author', 'Post', 'Comment']) {
      for (const suffix of [
        `src/main/generated/com/example/blog/entity/${entity}.java`,
        `src/main/generated/com/example/blog/repository/${entity}Repository.java`,
        `src/main/generated/com/example/blog/service/${entity}Service.java`,
        `src/main/generated/com/example/blog/dto/${entity}Dto.java`,
      ]) {
        expect(
          [...outputs].some((p) => p.endsWith(suffix)),
          `missing output ${suffix}`
        ).toBe(true)
      }
    }
  })
})
