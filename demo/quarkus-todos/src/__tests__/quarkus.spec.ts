import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'
import type { RenderResult } from 'xomda'
import { preview } from 'xomda'

// Fast inner loop: render the demo's templates against the committed
// .xomda/model.json via the public `xomda` API and assert on the resulting
// source text. No FS writes. The outer loop
// (`mvn test` via `pnpm -F @xomda/demo-quarkus-todos test:jvm`) is what
// actually compiles the generated code and runs @QuarkusTest against it.
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

describe('demo/quarkus-todos — Panache entities', () => {
  it('Todo extends PanacheEntityBase with explicit UUID @Id and Panache-public fields', () => {
    const todo = findByPath('src/main/generated/com/example/todos/entity/Todo.java')
    expect(todo.content).toMatch(/package com\.example\.todos\.entity;/)
    expect(todo.content).toMatch(/import io\.quarkus\.hibernate\.orm\.panache\.PanacheEntityBase;/)
    expect(todo.content).toMatch(/@Entity\b/)
    expect(todo.content).toMatch(/@Table\(name = "todo"\)/)
    expect(todo.content).toMatch(/public class Todo extends PanacheEntityBase/)
    expect(todo.content).toMatch(/@Id\s+@Column\(name = "id"\)\s+public UUID id;/)
    expect(todo.content).toMatch(/public String title;/)
    expect(todo.content).toMatch(/public Boolean done;/)
    expect(todo.content).toMatch(/public Priority priority;/)
    expect(todo.content).toMatch(
      /@ManyToOne\(fetch = FetchType\.LAZY, optional = false\)\s*\n\s*@JoinColumn\(name = "list_id", nullable = false\)\s*\n\s*public TodoList list;/
    )
    expect(todo.content).toMatch(/import com\.example\.todos\.enums\.Priority;/)
  })

  it('TodoList has required name column', () => {
    const list = findByPath('src/main/generated/com/example/todos/entity/TodoList.java')
    expect(list.content).toMatch(
      /@Column\(name = "name", nullable = false\)\s*\n\s*public String name;/
    )
    expect(list.content).toMatch(/public LocalDateTime createdAt;/)
  })
})

describe('demo/quarkus-todos — JAX-RS resources', () => {
  it.each([
    ['Todo', 'todo'],
    ['TodoList', 'todo-list'],
  ])('%sResource is a CRUD JAX-RS resource at /api/%s', (entity, path) => {
    const r = findByPath(`src/main/generated/com/example/todos/resource/${entity}Resource.java`)
    expect(r.content).toMatch(new RegExp(`@Path\\("/api/${path}"\\)`))
    expect(r.content).toMatch(new RegExp(`public class ${entity}Resource`))
    expect(r.content).toMatch(new RegExp(`public List<${entity}> list\\(\\)`))
    expect(r.content).toMatch(/@GET\s+@Path\("\/\{id\}"\)/)
    expect(r.content).toMatch(/@POST\s+@Transactional/)
    expect(r.content).toMatch(/@DELETE\s+@Path\("\/\{id\}"\)\s+@Transactional/)
    expect(r.content).toMatch(/UUID\.randomUUID\(\)/)
  })
})

describe('demo/quarkus-todos — Java enum', () => {
  it('Priority is generated with model values', () => {
    const en = findByPath('src/main/generated/com/example/todos/enums/Priority.java')
    expect(en.content).toMatch(/public enum Priority/)
    for (const v of ['LOW', 'MEDIUM', 'HIGH']) {
      expect(en.content).toMatch(new RegExp(`\\b${v}\\b`))
    }
  })
})

describe('demo/quarkus-todos — Postgres SQL migration', () => {
  function readSql() {
    return findByPath('src/main/generated-resources/db/migration/V1__init.sql').content
  }

  it('creates todo_list and todo tables', () => {
    const sql = readSql()
    for (const tbl of ['todo_list', 'todo']) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${tbl} \\(`))
    }
  })

  it('declares FK constraint from todo.list_id → todo_list.id', () => {
    expect(readSql()).toMatch(/FOREIGN KEY \(list_id\) REFERENCES todo_list\(id\)/)
  })

  it('emits CHECK constraint for the Priority enum column', () => {
    expect(readSql()).toMatch(/CHECK \(priority IN \('LOW', 'MEDIUM', 'HIGH'\)\)/)
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
