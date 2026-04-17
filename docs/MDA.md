# Model-Driven Architecture (MDA) in xomda.js

xomda.js is a **Model-Driven Architecture (MDA)** platform that enables the creation of data-driven applications through
self-defining models and automated code generation. The core principle is that **xomda defines its own model within
itself**, creating a bootstrapping system where the platform evolves through its own model definitions.

---

## Core Principle: Self-Definition & Bootstrapping

### The Self-Referential Architecture

When you run xomda within the xomda project folder (`.xomda/`), it displays and manages its own core models. These
aren't hardcoded structures—they are entities defined within xomda's own model system.

**Key Concept**: xomda is both the tool and the model it manages. The core models (Entity, Attribute, Package, Enum,
Template) are defined as entities within the `.xomda/model.json` file.

### Self-Bootstrapping Process

1. **Model Definition**: xomda defines what an `Entity`, `Attribute`, or `Template` looks like within its own model
2. **Code Generation**: Using its own templates, xomda generates TypeScript/Java code for these core models (typically
   in `packages/core/`)
3. **Dynamic Adaptation**: The UI forms automatically adapt based on model changes—no hardcoded forms
4. **Automatic Restart**: Similar to Vite's HMR, when the model changes and code regenerates, the system should restart
   to use the new definitions

**Example**: If you add a `validationPattern` attribute to the `Attribute` entity in the model, the xomda UI should
automatically show a regex input field when editing attributes.

---

## Advanced Modeling Concepts

### Inheritance & Blueprint System

xomda supports sophisticated modeling patterns for production applications:

- **Inheritance**: Entities can inherit properties and behavior from parent entities
- **Blueprints/Prototypes/Interfaces**: Reusable model structures that define contracts without strict hierarchies
- **Specialization**: Attribute subclasses based on type (e.g., `StringAttribute` with `maxLength`, `NumericAttribute`
  with `min/max`)

### Target-Specific Customization

For different runtime environments, xomda allows fine-grained control:

#### Spring Boot Integration

- **Class vs Record**: Choose between traditional Java classes or modern records
- **Lombok Support**: Toggle `@Data`, `@Builder`, `@Getter/@Setter` annotations
- **Java Version Targeting**: Adapt to Java 8, 11, 17, 21+ features
- **Build System**: Maven or Gradle integration

#### Cross-Environment Compatibility

- **Frontend/Backend**: Unified models work in Vue.js, React, Node.js, Spring Boot
- **Multi-Language**: Generate TypeScript, Java, Python, C# from same model
- **Framework Agnostic**: Support for JPA, Hibernate, TypeORM, Prisma, etc.

---

## Template Package System

### Template Packages & Plugin Architecture

xomda uses **Template Packages** to organize generation targets:

```typescript
interface TemplatePackage {
  id: string
  name: string
  description: string
  targetFramework: 'spring-boot' | 'nestjs' | 'nextjs' | 'vue' | etc.options
  : TemplateOption[]
  templates: Template[]
  plugins: Plugin[]
}
```

**Example Template Packages**:

- **Spring Boot JPA**: Java 21, Lombok, Maven, H2/PostgreSQL
- **NestJS GraphQL**: TypeScript, TypeORM, PostgreSQL
- **Next.js Full-Stack**: React, Prisma, PostgreSQL

### Plugin System

External plugins can extend xomda's capabilities:

- **Custom Templates**: Add domain-specific code generation
- **Validation Rules**: Custom model validation logic
- **Transformers**: Pre/post-processing of generated code
- **Integrations**: Database, API, deployment connectors

---

## Dynamic UI & Forms

### Model-Driven User Interface

Unlike traditional applications with hardcoded forms, xomda's UI adapts to the model:

- **Form Generation**: Forms are generated from model definitions
- **Field Types**: Input types determined by attribute types and constraints
- **Validation**: Client/server validation based on model rules
- **Relationships**: Dynamic handling of entity relationships

**Example**: Adding a new attribute type in the model automatically creates corresponding UI components.

---

## Production-Ready Features

### Runtime & Compile-Time Support

xomda provides comprehensive runtime capabilities:

- **Model Introspection**: Query model structure at runtime
- **Dynamic Validation**: Runtime validation against model constraints
- **Metadata Access**: Access to model documentation, relationships, constraints
- **Type Safety**: Generated types ensure compile-time safety

### Testing Infrastructure

Built-in testing support for xomda-generated applications:

- **Model-Based Testing**: Generate test cases from model constraints
- **Data Generation**: Create realistic test data based on model definitions
- **Integration Testing**: Test generated APIs against model contracts
- **Migration Testing**: Validate data migrations between model versions

### Model Versioning & Diff System

Advanced version control for models:

- **Semantic Versioning**: Track model changes with semantic versions
- **Diff Analysis**: Compare model versions to identify changes
- **Migration Generation**: Auto-generate database/API migration code
- **Upgrade Templates**: Generate upgrade scripts for deployed applications

**Example**: When adding a required field to an entity, xomda can generate:

- Database migration scripts
- API versioning code
- Data transformation logic
- Backward compatibility layers

---

## Development Workflow

### Self-Hosted Development

When developing xomda itself:

1. **Run xomda**: Start the application in the project directory
2. **Edit Core Models**: Modify Entity, Attribute, Template definitions
3. **Generate Code**: Use templates to regenerate core packages
4. **Auto-Restart**: System reloads with new model definitions
5. **Test Changes**: Verify the changes work in the updated system

### Application Development Workflow

For building applications with xomda:

1. **Define Model**: Create entities, attributes, relationships
2. **Select Template Package**: Choose target framework (Spring Boot, NestJS, etc.)
3. **Configure Options**: Set Java version, database, etc.
4. **Generate Code**: Produce complete application boilerplate
5. **Customize**: Add business logic to generated templates
6. **Deploy**: Use generated Docker configs, CI/CD pipelines

---

## 🏭 Current Implementation Status

### Core Models (Implemented)

-  Entity with attributes
-  Package hierarchy
-  Enum definitions
-  Basic templates

### Advanced Features (In Development)

- 🔄 Inheritance system
- 🔄 Blueprint/prototype concepts
- 🔄 Template packages
- 🔄 Plugin architecture
- 🔄 Model diffing
- 🔄 Dynamic UI generation

### Proof of Concept Templates

-  TypeScript interfaces/entities
-  Java Spring Boot classes
- 🔄 Additional language/framework support

---

##  Vision & Goals

xomda aims to be the **ultimate data-driven application platform** where:

- **The model is the single source of truth** for database, API, UI, and business logic
- **Code generation eliminates boilerplate** while maintaining flexibility
- **Cross-platform compatibility** enables seamless technology migration
- **Self-definition enables evolution** of the platform itself
- **Production readiness** supports enterprise-scale applications

The platform should enable developers to focus on **business logic** rather than infrastructure, while maintaining full
control over generated code and the ability to customize any aspect of the system.

---

## Related Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Technical architecture and package structure
- **[REFACTORING.md](REFACTORING.md)**: Code organization and centralization efforts
- **Template Documentation**: Individual template package guides
- **Plugin Development**: Extending xomda with custom functionality
