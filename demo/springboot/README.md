# Spring Boot 4 + Postgres demo

This demo defines a `BlogService` domain model in code, persists it under
`.xomda/`, and renders a runnable Spring Boot 4 project from project-local
templates in `.xomda/templates/SpringBoot/`.

## What it generates

```
output/
├── pom.xml                               # Spring Boot 4 + JPA + Flyway + Postgres
├── docker-compose.yml                    # Postgres 16 service for local dev
├── src/main/java/com/example/blog/
│   ├── BlogServiceApplication.java       # @SpringBootApplication entry point
│   ├── entity/{Author,Post,Comment}.java # JPA @Entity classes
│   ├── enums/PostStatus.java             # Java enum
│   ├── dto/*Dto.java                     # Java record DTOs (FKs flattened to UUID ids)
│   ├── repository/*Repository.java       # Spring Data JpaRepository<E, UUID>
│   └── service/*Service.java             # Transactional CRUD service
└── src/main/resources/
    ├── application.yml                   # Wired to the docker-compose Postgres
    └── db/migration/V1__init.sql         # Flyway migration with Postgres-native types
```

## Run it

```bash
pnpm install                              # once, from the repo root
pnpm --filter @xomda/demo-springboot start
pnpm --filter @xomda/demo-springboot test # tests against the generated code
```

## Templates

All templates live in `.xomda/templates/SpringBoot/` and are authored by the
helper script `scripts/build-templates.mjs`. Re-run the script if you tweak the
helper to regenerate the JSON. Templates are loaded from the demo's own
`.xomda/` directory (not the repo root), so they ship with the demo.

## Trying the generated app

```bash
cd output
docker compose up -d                      # start Postgres
mvn spring-boot:run                       # run the Spring Boot 4 app
```
