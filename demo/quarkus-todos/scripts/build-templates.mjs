// Authoring helper — builds the .xomda/templates/Quarkus/*.template.json files.
// Run with: node scripts/build-templates.mjs
//
// Only model-driven artefacts (Panache entities, JAX-RS resources, enums,
// Flyway V1 migration) are templated. The app skeleton (pom.xml,
// application.properties) is hand-written so the demo is a real
// runnable Quarkus 3 project.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const outDir = join(__dirname, '..', '.xomda', 'templates', 'Quarkus')

function migrateCell(cell) {
  const out = { ...cell }
  if (out.type === 'provider') out.type = 'loop'
  else if (out.type === 'provider-logic') out.type = 'loop-logic'
  if (out.providerSource !== undefined && out.loopSource === undefined) {
    out.loopSource = out.providerSource
  }
  delete out.providerSource
  if (Array.isArray(out.children)) out.children = out.children.map(migrateCell)
  return out
}

function nestFlatChildren(cells) {
  const result = []
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const isLoop = cell.type === 'loop' || cell.type === 'loop-logic'
    if (isLoop && (!cell.children || cell.children.length === 0)) {
      result.push({ ...cell, children: nestFlatChildren(cells.slice(i + 1)) })
      return result
    }
    result.push({
      ...cell,
      ...(cell.children ? { children: nestFlatChildren(cell.children) } : {}),
    })
  }
  return result
}

function migrateTemplate(tpl) {
  if (!Array.isArray(tpl.cells)) return tpl
  return { ...tpl, cells: nestFlatChildren(tpl.cells.map(migrateCell)) }
}

const TYPE_MAPS_AND_CLASSIFY = `
const javaPrim = { string:'String', number:'Long', boolean:'Boolean', decimal:'java.math.BigDecimal', date:'java.time.LocalDateTime', uuid:'java.util.UUID' };
const sqlPrim = { string:'TEXT', number:'BIGINT', boolean:'BOOLEAN', decimal:'NUMERIC(19,4)', date:'TIMESTAMP', uuid:'UUID' };
enumNames = new Set();
entityNames = new Set();
for (const pkg of (model.packages || [])) {
  for (const e of (pkg.enums || [])) enumNames.add(e.name);
  for (const e of (pkg.entities || [])) entityNames.add(e.name);
}
javaTypeOf = function (t) {
  if (Object.prototype.hasOwnProperty.call(javaPrim, t)) {
    const fq = javaPrim[t]; const dot = fq.lastIndexOf('.');
    return dot >= 0 ? fq.slice(dot + 1) : fq;
  }
  return pascalCase(t);
};
sqlTypeOf = function (t) { return sqlPrim[t] || 'TEXT'; };
isPrim = function (t) { return Object.prototype.hasOwnProperty.call(javaPrim, t); };
isEnumType = function (t) { return enumNames.has(t); };
isEntityType = function (t) { return entityNames.has(t); };
`

// ──────────────────────────────────────────────────────────────────────────
// 1. Panache entity — Active-record style, extends PanacheEntityBase
//    with explicit UUID @Id. Public fields per Panache idiom.

const entityTemplate = {
  uuid: 'a1b1c1d1-1111-4001-8001-aaaaaaaaaaaa',
  name: 'Quarkus Panache Entity',
  description:
    'Generates a Panache entity per model entity (extends PanacheEntityBase, public fields, UUID @Id).',
  version: '1.0.0',
  folder: 'Quarkus',
  cells: [
    {
      uuid: 'a1b1c1d1-1111-4101-8101-aaaaaaaaaaaa',
      type: 'provider',
      content: '',
      variableName: '$entity',
      providerSource: 'entities',
    },
    {
      uuid: 'a1b1c1d1-1111-4201-8201-aaaaaaaaaaaa',
      type: 'logic',
      content: TYPE_MAPS_AND_CLASSIFY,
    },
    {
      uuid: 'a1b1c1d1-1111-4301-8301-aaaaaaaaaaaa',
      type: 'logic',
      content: `
fields = (attributes || []).filter(function (a) { return !a.primaryKey; }).map(function (a) {
  return {
    name: a.name,
    camel: camelCase(a.name),
    column: snakeCase(a.name),
    rawType: a.type,
    javaType: javaTypeOf(a.type),
    required: !!a.required,
    unique: !!a.unique,
    isPrim: isPrim(a.type),
    isEnum: isEnumType(a.type),
    isEntity: isEntityType(a.type),
  };
});

const importSet = new Set([
  'io.quarkus.hibernate.orm.panache.PanacheEntityBase',
  'jakarta.persistence.*',
  'java.util.UUID',
]);
for (const f of fields) {
  if (f.rawType === 'decimal') importSet.add('java.math.BigDecimal');
  if (f.rawType === 'date') importSet.add('java.time.LocalDateTime');
  if (f.isEnum) importSet.add('com.example.todos.enums.' + pascalCase(f.rawType));
}
importLines = Array.from(importSet).sort().map(function (i) { return 'import ' + i + ';'; }).join('\\n');

fieldDecls = fields.map(function (f) {
  const lines = [];
  if (f.isEntity) {
    lines.push('  @ManyToOne(fetch = FetchType.LAZY' + (f.required ? ', optional = false' : '') + ')');
    lines.push('  @JoinColumn(name = "' + f.column + '_id"' + (f.required ? ', nullable = false' : '') + ')');
  } else if (f.isEnum) {
    lines.push('  @Enumerated(EnumType.STRING)');
    const parts = ['name = "' + f.column + '"'];
    if (f.required) parts.push('nullable = false');
    if (f.unique) parts.push('unique = true');
    lines.push('  @Column(' + parts.join(', ') + ')');
  } else {
    const parts = ['name = "' + f.column + '"'];
    if (f.required) parts.push('nullable = false');
    if (f.unique) parts.push('unique = true');
    lines.push('  @Column(' + parts.join(', ') + ')');
  }
  lines.push('  public ' + f.javaType + ' ' + f.camel + ';');
  return lines.join('\\n');
}).join('\\n\\n');

tableName = snakeCase(name);
`,
    },
    {
      uuid: 'a1b1c1d1-1111-4401-8401-aaaaaaaaaaaa',
      type: 'handlebars',
      content: `package com.example.todos.entity;

{{{importLines}}}

@Entity
@Table(name = "{{tableName}}")
public class {{pascalCase name}} extends PanacheEntityBase {

  @Id
  @Column(name = "id")
  public UUID id;

{{{fieldDecls}}}

  public {{pascalCase name}}() {}
}
`,
    },
    {
      uuid: 'a1b1c1d1-1111-4501-8501-aaaaaaaaaaaa',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated/com/example/todos/entity/{{pascalCase name}}.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 2. JAX-RS resource — one CRUD resource per entity, mounted at /api/<kebab>.

const resourceTemplate = {
  uuid: 'b2c2d2e2-2222-4002-8002-bbbbbbbbbbbb',
  name: 'Quarkus JAX-RS Resource',
  description:
    'Generates a JAX-RS resource per entity with list / get / create / delete operations against the Panache entity.',
  version: '1.0.0',
  folder: 'Quarkus',
  cells: [
    {
      uuid: 'b2c2d2e2-2222-4102-8102-bbbbbbbbbbbb',
      type: 'provider',
      content: '',
      variableName: '$entity',
      providerSource: 'entities',
    },
    {
      uuid: 'b2c2d2e2-2222-4202-8202-bbbbbbbbbbbb',
      type: 'logic',
      content: `
pathSegment = kebabCase(name);
`,
    },
    {
      uuid: 'b2c2d2e2-2222-4302-8302-bbbbbbbbbbbb',
      type: 'handlebars',
      content: `package com.example.todos.resource;

import com.example.todos.entity.{{pascalCase name}};
import io.quarkus.panache.common.Sort;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;

@Path("/api/{{pathSegment}}")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class {{pascalCase name}}Resource {

  @GET
  public List<{{pascalCase name}}> list() {
    return {{pascalCase name}}.listAll(Sort.by("id"));
  }

  @GET
  @Path("/{id}")
  public {{pascalCase name}} get(@PathParam("id") UUID id) {
    {{pascalCase name}} entity = {{pascalCase name}}.findById(id);
    if (entity == null) throw new NotFoundException();
    return entity;
  }

  @POST
  @Transactional
  public Response create({{pascalCase name}} entity) {
    if (entity.id == null) entity.id = UUID.randomUUID();
    entity.persist();
    return Response.status(Response.Status.CREATED).entity(entity).build();
  }

  @DELETE
  @Path("/{id}")
  @Transactional
  public Response delete(@PathParam("id") UUID id) {
    boolean removed = {{pascalCase name}}.deleteById(id);
    return removed ? Response.noContent().build() : Response.status(Response.Status.NOT_FOUND).build();
  }
}
`,
    },
    {
      uuid: 'b2c2d2e2-2222-4402-8402-bbbbbbbbbbbb',
      type: 'output',
      content: '',
      outputFilename:
        'src/main/generated/com/example/todos/resource/{{pascalCase name}}Resource.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Java enum — same shape as the springboot demo.

const enumTemplate = {
  uuid: 'c3d3e3f3-3333-4003-8003-cccccccccccc',
  name: 'Quarkus Java Enum',
  description: 'Generates a Java enum per model enum.',
  version: '1.0.0',
  folder: 'Quarkus',
  cells: [
    {
      uuid: 'c3d3e3f3-3333-4103-8103-cccccccccccc',
      type: 'provider',
      content: '',
      variableName: '$enum',
      providerSource: 'enums',
    },
    {
      uuid: 'c3d3e3f3-3333-4203-8203-cccccccccccc',
      type: 'logic',
      content: `
valueList = (values || []).map(function (v) { return '  ' + constantCase(v.name); }).join(',\\n') + ';';
`,
    },
    {
      uuid: 'c3d3e3f3-3333-4303-8303-cccccccccccc',
      type: 'handlebars',
      content: `package com.example.todos.enums;

public enum {{pascalCase name}} {
{{{valueList}}}
}
`,
    },
    {
      uuid: 'c3d3e3f3-3333-4403-8403-cccccccccccc',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated/com/example/todos/enums/{{pascalCase name}}.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Flyway V1 migration — Postgres-targeted CREATE TABLE per entity.

const sqlTemplate = {
  uuid: 'd4e4f4a4-4444-4004-8004-dddddddddddd',
  name: 'Quarkus Postgres Schema (Flyway V1)',
  description:
    'Generates a Flyway V1__init.sql migration: CREATE TABLE per entity with Postgres-native types and CHECK constraints for enums.',
  version: '1.0.0',
  folder: 'Quarkus',
  cells: [
    {
      uuid: 'd4e4f4a4-4444-4104-8104-dddddddddddd',
      type: 'logic',
      content: TYPE_MAPS_AND_CLASSIFY,
    },
    {
      uuid: 'd4e4f4a4-4444-4204-8204-dddddddddddd',
      type: 'logic',
      content: `
const allEntities = [];
const allEnums = [];
for (const pkg of (model.packages || [])) {
  for (const e of (pkg.entities || [])) allEntities.push(e);
  for (const e of (pkg.enums || [])) allEnums.push(e);
}

function colSqlType(a) {
  if (isEntityType(a.type)) return 'UUID';
  if (isEnumType(a.type)) return 'TEXT';
  return sqlTypeOf(a.type);
}

const blocks = [];
for (const ent of allEntities) {
  const tbl = snakeCase(ent.name);
  const lines = [];
  const fkLines = [];
  const enumChecks = [];
  for (const a of (ent.attributes || [])) {
    const col = snakeCase(a.name) + (isEntityType(a.type) ? '_id' : '');
    const parts = [col, colSqlType(a)];
    if (a.primaryKey) parts.push('PRIMARY KEY');
    if (a.required && !a.primaryKey) parts.push('NOT NULL');
    if (a.unique && !a.primaryKey) parts.push('UNIQUE');
    lines.push('  ' + parts.join(' '));
    if (isEntityType(a.type)) {
      fkLines.push('  FOREIGN KEY (' + col + ') REFERENCES ' + snakeCase(a.type) + '(id)');
    }
    if (isEnumType(a.type)) {
      const en = allEnums.find(function (x) { return x.name === a.type; });
      if (en) {
        const vals = (en.values || []).map(function (v) { return "'" + constantCase(v.name) + "'"; }).join(', ');
        enumChecks.push('  CHECK (' + col + ' IN (' + vals + '))');
      }
    }
  }
  const allLines = lines.concat(fkLines).concat(enumChecks);
  blocks.push('CREATE TABLE ' + tbl + ' (\\n' + allLines.join(',\\n') + '\\n);');
}
sqlBody = blocks.join('\\n\\n');
`,
    },
    {
      uuid: 'd4e4f4a4-4444-4304-8304-dddddddddddd',
      type: 'handlebars',
      content: `-- Auto-generated by xomda — Quarkus + Postgres schema for {{model.name}}
-- Apply via Flyway from Quarkus at startup.

{{{sqlBody}}}
`,
    },
    {
      uuid: 'd4e4f4a4-4444-4404-8404-dddddddddddd',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated-resources/db/migration/V1__init.sql',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────

const templates = [
  ['entity.template.json', entityTemplate],
  ['resource.template.json', resourceTemplate],
  ['enum.template.json', enumTemplate],
  ['sql-schema.template.json', sqlTemplate],
]

await mkdir(outDir, { recursive: true })
for (const [filename, tpl] of templates) {
  const path = join(outDir, filename)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(migrateTemplate(tpl), null, 2)}\n`, 'utf-8')
  console.log('wrote', filename)
}
