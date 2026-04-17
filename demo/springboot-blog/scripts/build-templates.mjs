// Authoring helper — builds the .xomda/templates/SpringBoot/*.template.json files.
// Run with: node scripts/build-templates.mjs
//
// Only model-driven artefacts (entities, DTOs, repositories, services, enums,
// the Flyway migration) are templated. The app skeleton (pom.xml, application.yml,
// BlogServiceApplication.java, docker-compose.yml) is hand-written so the demo
// is a real Spring Boot 4 project you can `mvn spring-boot:run`.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const outDir = join(__dirname, '..', '.xomda', 'templates', 'SpringBoot')

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

// ──────────────────────────────────────────────────────────────────────────
// Shared logic-cell snippets (kept as plain JS strings).

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
javaFqType = function (t) { return javaPrim[t] || ('com.example.blog.' + (enumNames.has(t) ? 'enums.' : 'entity.') + pascalCase(t)); };
sqlTypeOf = function (t) { return sqlPrim[t] || 'TEXT'; };
isPrim = function (t) { return Object.prototype.hasOwnProperty.call(javaPrim, t); };
isEnumType = function (t) { return enumNames.has(t); };
isEntityType = function (t) { return entityNames.has(t); };
`

// ──────────────────────────────────────────────────────────────────────────
// 1. Entity (JPA @Entity) — Entity-scoped via provider.

const entityTemplate = {
  uuid: '7e70eeaa-d983-4bd4-b1d5-1258c4a10f43',
  name: 'Spring Boot JPA Entity',
  description:
    'Generates a JPA @Entity class per entity, with @Id, @Column, @ManyToOne, and @Enumerated annotations.',
  version: '1.0.0',
  folder: 'SpringBoot',
  cells: [
    {
      uuid: 'ac3d8f1f-428d-4bc1-ab4f-aa85beef4af3',
      type: 'provider',
      content: '',
      variableName: '$entity',
      providerSource: 'entities',
    },
    {
      uuid: '2fd3cad8-aaac-49e8-9a2c-0d8ce07c1e89',
      type: 'logic',
      content: TYPE_MAPS_AND_CLASSIFY,
    },
    {
      uuid: '85d1d930-7d52-4f96-9345-513e0806bdb0',
      type: 'logic',
      content: `
fields = (attributes || []).map(function (a) {
  return {
    name: a.name,
    camel: camelCase(a.name),
    pascal: pascalCase(a.name),
    column: snakeCase(a.name),
    rawType: a.type,
    javaType: javaTypeOf(a.type),
    required: !!a.required,
    primaryKey: !!a.primaryKey,
    unique: !!a.unique,
    multiValue: !!a.multiValue,
    isPrim: isPrim(a.type),
    isEnum: isEnumType(a.type),
    isEntity: isEntityType(a.type),
  };
});

const importSet = new Set(['jakarta.persistence.*']);
for (const f of fields) {
  if (f.rawType === 'decimal') importSet.add('java.math.BigDecimal');
  if (f.rawType === 'date') importSet.add('java.time.LocalDateTime');
  if (f.rawType === 'uuid') importSet.add('java.util.UUID');
  if (f.isEnum) importSet.add('com.example.blog.enums.' + pascalCase(f.rawType));
}
importLines = Array.from(importSet).sort().map(function (i) { return 'import ' + i + ';'; }).join('\\n');

fieldDecls = fields.map(function (f) {
  const lines = [];
  if (f.primaryKey) lines.push('  @Id');
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
  lines.push('  private ' + f.javaType + ' ' + f.camel + ';');
  return lines.join('\\n');
}).join('\\n\\n');

accessors = fields.map(function (f) {
  return (
    '  public ' + f.javaType + ' get' + f.pascal + '() { return ' + f.camel + '; }\\n' +
    '  public void set' + f.pascal + '(' + f.javaType + ' ' + f.camel + ') { this.' + f.camel + ' = ' + f.camel + '; }'
  );
}).join('\\n\\n');

tableName = snakeCase(name);
`,
    },
    {
      uuid: '73b92164-e918-493c-97ec-d1f2332b853a',
      type: 'handlebars',
      content: `package com.example.blog.entity;

{{{importLines}}}

@Entity
@Table(name = "{{tableName}}")
public class {{pascalCase name}} {

{{{fieldDecls}}}

  public {{pascalCase name}}() {}

{{{accessors}}}
}
`,
    },
    {
      uuid: '02bc613f-bc6d-4592-80e8-2d5791306d36',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated/com/example/blog/entity/{{pascalCase name}}.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 2. DTO — Entity-scoped via provider.

const dtoTemplate = {
  uuid: '92ec2c03-002b-460e-891f-a9b61f956964',
  name: 'Spring Boot DTO',
  description:
    'Generates a Java record DTO per entity. Entity references are flattened to their FK id.',
  version: '1.0.0',
  folder: 'SpringBoot',
  cells: [
    {
      uuid: '1df3b4e9-e16e-4328-9ffa-cb2b7bbbc4ce',
      type: 'provider',
      content: '',
      variableName: '$entity',
      providerSource: 'entities',
    },
    {
      uuid: '0b52c58a-7ef7-4b64-825e-1fb742bfd039',
      type: 'logic',
      content: TYPE_MAPS_AND_CLASSIFY,
    },
    {
      uuid: '58cc6f15-de07-4274-94a9-4c59f9a3b897',
      type: 'logic',
      content: `
fields = (attributes || []).map(function (a) {
  let typeName;
  if (isEntityType(a.type)) typeName = 'java.util.UUID';
  else if (isEnumType(a.type)) typeName = pascalCase(a.type);
  else typeName = javaTypeOf(a.type);
  return {
    camel: a.type && isEntityType(a.type) ? camelCase(a.name) + 'Id' : camelCase(a.name),
    type: typeName,
    isEnum: isEnumType(a.type),
    rawType: a.type,
  };
});

const importSet = new Set();
for (const f of fields) {
  if (f.type === 'java.util.UUID' || f.type === 'UUID') importSet.add('java.util.UUID');
  if (f.rawType === 'decimal') importSet.add('java.math.BigDecimal');
  if (f.rawType === 'date') importSet.add('java.time.LocalDateTime');
  if (f.isEnum) importSet.add('com.example.blog.enums.' + pascalCase(f.rawType));
}
importLines = Array.from(importSet).sort().map(function (i) { return 'import ' + i + ';'; }).join('\\n');

paramList = fields.map(function (f) {
  const t = f.type === 'java.util.UUID' ? 'UUID' : f.type;
  return '    ' + t + ' ' + f.camel;
}).join(',\\n');
`,
    },
    {
      uuid: '8ff67d33-0309-49ee-850b-8e9b7b299c1b',
      type: 'handlebars',
      content: `package com.example.blog.dto;

{{{importLines}}}

public record {{pascalCase name}}Dto(
{{{paramList}}}
) {}
`,
    },
    {
      uuid: '954cc6d4-9cbd-4a4f-8b4c-9316735eef4b',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated/com/example/blog/dto/{{pascalCase name}}Dto.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Repository — Entity-scoped via provider.

const repositoryTemplate = {
  uuid: '57a5067c-1402-41eb-aab4-983715d9591b',
  name: 'Spring Boot Repository',
  description: 'Generates a Spring Data JPA repository interface per entity.',
  version: '1.0.0',
  folder: 'SpringBoot',
  cells: [
    {
      uuid: 'f2c7595c-b2a9-4d8d-b099-bc2bbe7c844b',
      type: 'provider',
      content: '',
      variableName: '$entity',
      providerSource: 'entities',
    },
    {
      uuid: 'e736f5c4-cf69-4c65-b621-3566bfd5d039',
      type: 'logic',
      content: `
const idAttr = (attributes || []).find(function (a) { return a.primaryKey; }) || { type: 'uuid' };
idJavaType = idAttr.type === 'uuid' ? 'UUID' : (idAttr.type === 'number' ? 'Long' : 'String');
`,
    },
    {
      uuid: 'cb2b26da-085d-4fd5-8c4b-476af8e774b4',
      type: 'handlebars',
      content: `package com.example.blog.repository;

import com.example.blog.entity.{{pascalCase name}};
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface {{pascalCase name}}Repository extends JpaRepository<{{pascalCase name}}, {{{idJavaType}}}> {
}
`,
    },
    {
      uuid: '16ebbac3-3bca-4c19-bc1c-80d2bdcfc53b',
      type: 'output',
      content: '',
      outputFilename:
        'src/main/generated/com/example/blog/repository/{{pascalCase name}}Repository.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Service — Entity-scoped via provider.

const serviceTemplate = {
  uuid: '0ba04927-487f-426f-86dc-a705c0b93ad2',
  name: 'Spring Boot Service',
  description: 'Generates a basic CRUD service per entity, delegating to the repository.',
  version: '1.0.0',
  folder: 'SpringBoot',
  cells: [
    {
      uuid: 'bf6379ce-6de7-4bc6-8e25-64788825e9f3',
      type: 'provider',
      content: '',
      variableName: '$entity',
      providerSource: 'entities',
    },
    {
      uuid: '45ae7a8f-74cf-43f1-9380-f5bfacf92737',
      type: 'handlebars',
      content: `package com.example.blog.service;

import com.example.blog.entity.{{pascalCase name}};
import com.example.blog.repository.{{pascalCase name}}Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class {{pascalCase name}}Service {
  private final {{pascalCase name}}Repository repository;

  public {{pascalCase name}}Service({{pascalCase name}}Repository repository) {
    this.repository = repository;
  }

  public List<{{pascalCase name}}> findAll() { return repository.findAll(); }
  public Optional<{{pascalCase name}}> findById(UUID id) { return repository.findById(id); }
  public {{pascalCase name}} save({{pascalCase name}} entity) { return repository.save(entity); }
  public void deleteById(UUID id) { repository.deleteById(id); }
}
`,
    },
    {
      uuid: '5f5f8fa1-4aa0-44e2-9c66-b1c523d191ec',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated/com/example/blog/service/{{pascalCase name}}Service.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 5. Java enum — Enum-scoped via provider.

const enumTemplate = {
  uuid: '6cda9a33-b898-4b60-aa24-3095c3c506db',
  name: 'Spring Boot Java Enum',
  description: 'Generates a Java enum per model enum.',
  version: '1.0.0',
  folder: 'SpringBoot',
  cells: [
    {
      uuid: '3f4f183b-134a-49fb-b14d-bf06f4aa61a2',
      type: 'provider',
      content: '',
      variableName: '$enum',
      providerSource: 'enums',
    },
    {
      uuid: '168691b3-b268-4364-b717-837fa1bd458f',
      type: 'logic',
      content: `
valueList = (values || []).map(function (v) { return '  ' + constantCase(v.name); }).join(',\\n') + ';';
`,
    },
    {
      uuid: '808f776a-f9af-411a-9837-e4764d1f7507',
      type: 'handlebars',
      content: `package com.example.blog.enums;

public enum {{pascalCase name}} {
{{{valueList}}}
}
`,
    },
    {
      uuid: 'aecb1956-cad0-4808-b316-8dc4afb8c0d5',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated/com/example/blog/enums/{{pascalCase name}}.java',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────
// 6. SQL schema (Flyway V1) — Model-scoped (no provider).

const sqlTemplate = {
  uuid: '698dca8e-5b1c-475e-9b12-b820d1306aba',
  name: 'Spring Boot Postgres Schema (Flyway V1)',
  description:
    'Generates a single Flyway V1__init.sql migration with CREATE TABLE statements for every entity, using Postgres-native types.',
  version: '1.0.0',
  folder: 'SpringBoot',
  cells: [
    {
      uuid: 'dadda294-49a0-4b27-b988-4444d52b037b',
      type: 'logic',
      content: TYPE_MAPS_AND_CLASSIFY,
    },
    {
      uuid: 'a5cba8ed-1d33-4524-8896-f75d28ab1493',
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
      uuid: 'edbd60c6-da2e-44b2-be05-20108b9a32f8',
      type: 'handlebars',
      content: `-- Auto-generated by xomda — Spring Boot Postgres schema for {{model.name}}
-- Apply via Flyway from Spring Boot at startup.

{{{sqlBody}}}
`,
    },
    {
      uuid: '24cfe670-38c0-4ebb-af90-7c52a939bd8d',
      type: 'output',
      content: '',
      outputFilename: 'src/main/generated-resources/db/migration/V1__init.sql',
    },
  ],
}

// ──────────────────────────────────────────────────────────────────────────

const templates = [
  ['entity.template.json', entityTemplate],
  ['dto.template.json', dtoTemplate],
  ['repository.template.json', repositoryTemplate],
  ['service.template.json', serviceTemplate],
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
