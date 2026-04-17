# xomda.js TODO List

This list tracks the development milestones and tasks for xomda.js, aligned with its **Model-Driven Architecture (MDA)**
vision. The self-definition loop has been successfully closed, and the platform now demonstrates genuine MDA
capabilities.

## Current Status: Self-Definition Loop Closed 

xomda.js has achieved its core MDA vision:

- **Self-Defining**: Core types defined within the model itself
- **Self-Bootstrapping**: UI adapts dynamically to model changes
- **Self-Regeneration**: Code generation with diff/promote workflow
- **Runtime Introspection**: Model knowledge extraction for production

**14 tests passing** across core packages. TypeScript has build issues in client package. Dev servers boot successfully.

---

## High Priority: Template Packages & Cross-Environment Support

### Template Package System

- [ ] **Template Package Architecture**
  - [ ] Define plugin interface for external template packages
  - [ ] Package metadata format (name, description, supported languages/frameworks)
  - [ ] Template discovery and loading mechanism
  - [ ] Package-specific options/configuration UI

- [ ] **Spring Boot Template Package**
  - [ ] Complete Lombok integration with configurable options
  - [ ] JPA/Hibernate entity generation with relationships
  - [ ] Spring Data repository interfaces
  - [ ] REST controller generation with validation
  - [ ] Maven/Gradle build file generation
  - [ ] Application properties configuration

- [ ] **NestJS Template Package**
  - [ ] TypeORM entity generation
  - [ ] Controller/service/dto generation
  - [ ] Module structure and dependency injection
  - [ ] Validation pipes and decorators

- [ ] **Next.js Template Package**
  - [ ] API route generation
  - [ ] Component generation with TypeScript
  - [ ] Database integration (Prisma/TypeORM)

### Cross-Environment Validation

- [ ] **Build Verification**
  - [ ] Generated code compilation testing
  - [ ] Dependency resolution validation
  - [ ] Framework-specific linting integration

---

## Advanced MDA Features

### Tier-2 User Experience

- [ ] **Pick-Meta-Type UX in Add Dialogs**
  - [ ] When multiple entity types exist, show picker for concrete types only
  - [ ] Abstract entities (`abstract: true`) excluded from instantiation
  - [ ] Smart defaults: single concrete type → direct instantiation

- [ ] **DynamicForm with Effective Attributes**
  - [ ] Render inherited attributes in edit forms
  - [ ] Visual distinction for inherited vs. own attributes
  - [ ] Override inherited attributes in child entities

### Model Validation & Quality

- [ ] **Advanced Uniqueness Enforcement**
  - [ ] Implement `uniqueScope: 'parent'` in generated schemas
  - [ ] Cross-reference validation for references
  - [ ] Circular dependency detection

- [ ] **Model Integrity Checks**
  - [ ] Orphaned reference detection
  - [ ] Type consistency validation
  - [ ] Migration impact analysis

---

## Production-Ready Features

### Self-Bootstrapping Engine

- [ ] **Automatic Restart on Model Change**
  - [ ] File watcher for `.xomda/model.json`
  - [ ] Hot Module Replacement (HMR) for model changes
  - [ ] Graceful server restart with state preservation

### Enterprise Features

- [ ] **Model Upgrade Generation**
  - [ ] Database migration scripts from model diffs
  - [ ] API versioning and backward compatibility
  - [ ] Data transformation pipelines

- [ ] **Multi-User Collaboration**
  - [ ] Concurrent editing with conflict resolution
  - [ ] Model locking and change tracking
  - [ ] Review and approval workflows

### Performance & Scale

- [ ] **Large Model Optimization**
  - [ ] Lazy loading for model elements
  - [ ] Virtual scrolling in diagram canvas
  - [ ] Incremental generation for large codebases

---

## Documentation & Ecosystem

### Documentation Updates

- [ ] **API Documentation**
  - [ ] Complete tRPC procedure documentation
  - [ ] Runtime introspection API reference
  - [ ] Template helper function reference

- [ ] **Template Authoring Guide**
  - [ ] Handlebars template best practices
  - [ ] Custom helper development
  - [ ] Multi-scope generation patterns

### Community & Adoption

- [ ] **Example Projects**
  - [ ] Real-world MDA examples (e-commerce, CMS, etc.)
  - [ ] Template package development tutorials
  - [ ] Migration guides from traditional development

- [ ] **Plugin Ecosystem**
  - [ ] Template package marketplace
  - [ ] Community contribution guidelines
  - [ ] Quality assurance for third-party packages

---

## Technical Debt & Maintenance

### Code Quality

- [ ] **TypeScript Strict Mode**
  - [ ] Enable remaining strict checks
  - [ ] Eliminate `any` types in critical paths
  - [ ] Comprehensive type coverage

### Testing Infrastructure

- [ ] **Integration Testing**
  - [ ] End-to-end model editing workflows
  - [ ] Template generation verification
  - [ ] Cross-package integration tests

### Build & CI/CD

- [ ] **Release Automation**
  - [ ] Automated package publishing
  - [ ] Version management and tagging
  - [ ] Cross-platform build verification
