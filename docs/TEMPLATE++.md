# Advanced Templating Engine Design: TEMPLATE++

## Executive Summary

This document presents a comprehensive analysis and design proposal for an advanced templating engine (TEMPLATE++) to
replace and enhance the current Handlebars-based system in xomda.js. The new system will initially coexist with the
existing Handlebars approach, allowing for gradual migration.

The design adopts a cell-based architecture inspired by notebook environments, but with an imperative execution model
where cells are processed sequentially from top to bottom. JavaScript serves as the primary scripting language, with
implementations for both TypeScript/Node.js and Java-based code generation environments.

## Core Requirements

### Template Re-use

- **Predefined Templates**: System provides built-in templates for common patterns
- **User-Defined Templates**: Users can create and share custom templates
- **Template Inheritance**: Templates can extend and override other templates
- **Modular Architecture**: Templates composed of reusable components

### JavaScript as Scripting Language

- **Unified Scripting**: JavaScript used across all template logic
- **Cross-Platform Implementation**: JavaScript processing implemented in both:
  - TypeScript/Node.js environment (primary)
  - Java-based code generation (secondary, for compatibility)
- **Standard Library**: Access to modern JavaScript features and APIs

### Cell Types

Cells can for example come as a code editor, or a form, depending on the cell type.  
The engine supports multiple specialized cell types:

1. **Logic Cells**: Reusable JavaScript functions and utilities
2. **Markdown Cells**: Documentation and comments
3. **Handlebars Cells**: Legacy Handlebars template fragments
4. **Output Buffer Cells**: Stream-like buffers for accumulating output
5. **Output Definition Cells**: Specify file destinations and output configuration

### Variable Definition and Usage (ObservableHQ-style)

- **Cell Variables**: Like ObservableHQ, cells can define variables that become available to subsequent cells
- **Sequential Dependencies**: Variables defined in earlier cells can be referenced in later cells
- **Reactive Updates**: Changes to variable definitions automatically propagate to dependent cells
- **Scope Management**: Variables persist throughout template execution

### Execution Model

- **Sequential Processing**: Cells execute from top to bottom
- **Variable Propagation**: Variables defined in cells become available to subsequent cells
- **Reactive Dependencies**: Changes to variables automatically update dependent cells
- **State Persistence**: Variables and buffers persist across cells
- **Explicit Control**: Users control execution order and logic flow

### Template Storage Format

- **JSON Format**: Templates stored as JSON files containing an array of cells
- **Template UUID**: Each template has a unique identifier for referencing
- **Cell UUID**: Each cell has a unique identifier
- **Version Control**: UUIDs enable reliable template references regardless of file location

## Current State Analysis

### xomda.js Template System Overview

xomda.js is a Model-Driven Architecture (MDA) platform where users visually design data models and generate code through
Handlebars templates. The current template system consists of:

- **Handlebars Templates**: Stored in the `packages/template/` package
- **Template Storage**: File-based storage system for template files
- **Code Generation**: tRPC router in `packages/model/` handles CRUD operations
- **Template Helpers**: Custom Handlebars helpers for advanced logic

### Limitations of Current Approach

1. **Static Nature**: Templates are static files with no dynamic execution
2. **Limited Re-use**: Difficult to share and reuse template components
3. **Language Constraints**: Handlebars limits complex logic and modern JavaScript features
4. **Single Output**: Each template generates one output file
5. **Maintenance Burden**: Large templates become unwieldy and hard to maintain

## Inspiration from Reactive Systems

### Jupyter Notebook vs ObservableHQ Analysis

A recent analysis of notebook editing paradigms reveals two fundamental approaches to cell-based computation:

#### Jupyter Notebook: Imperative Execution Model

- **Execution**: Manual, stateful, sequential
- **State Management**: Variables persist across cells, order-dependent
- **Editing Experience**: Script-like, requires explicit re-execution
- **Consistency**: Can drift due to hidden state issues

#### ObservableHQ: Reactive Execution Model

- **Execution**: Automatic, dependency-driven, topological order
- **State Management**: Derived state, explicit dependencies
- **Editing Experience**: Spreadsheet-like, instant updates
- **Consistency**: Always consistent with current code

### Key Insight for Templating

The core insight is that **templates should be treated as reactive cells rather than static scripts**. In the context of
MDA:

- **Model ≠ Cells**: The data model is external and immutable within template execution
- **Cells Use Model**: Template cells reference the model to generate code fragments
- **Reactive Updates**: Changes to model or cell logic propagate automatically

## TEMPLATE++ Design Proposal

### Core Architecture

#### Cell-Based Template Structure

Templates are composed of **cells** - discrete units of code generation logic:

```typescript
interface TemplateCell {
  uuid: string; // Unique identifier for the cell
  type: 'logic' | 'markdown' | 'handlebars' | 'buffer' | 'output' | 'form';
  content: string; // JavaScript code or other content
  variableName?: string; // Variable name this cell defines (for logic cells)
  formOptions?: FormField[]; // Form configuration (for form cells or hybrid cells)
  metadata: CellMetadata;
}

interface Template {
  uuid: string; // Unique identifier for the template
  name: string;
  description?: string;
  version: string;
  cells: TemplateCell[];
  extends?: string; // UUID of parent template
  metadata: TemplateMetadata;
}
```

#### JSON Storage Format

Templates are stored as JSON files with the following structure:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "TypeScript Entity Template",
  "description": "Generates TypeScript entity classes with full CRUD operations",
  "version": "1.0.0",
  "cells": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440001",
      "type": "form",
      "content": "",
      "formOptions": [
        {
          "name": "includeValidation",
          "type": "boolean",
          "label": "Include validation decorators",
          "default": true
        },
        {
          "name": "generateTests",
          "type": "boolean",
          "label": "Generate unit tests",
          "default": false
        }
      ]
    },
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440002",
      "type": "logic",
      "variableName": "entityName",
      "content": "return pascalCase(model.name) + 'Entity';"
    },
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440003",
      "type": "logic",
      "variableName": "entityClass",
      "content": "return `export class ${entityName} {\\n${generateFields()}\\n}`;"
    }
  ]
}
```

#### Reactive Execution Engine

The engine builds a reactive dependency graph where cells can reference variables defined in previous cells:

- **Variable Definition**: Cells can define variables that become available to subsequent cells
- **Dependency Tracking**: Automatic detection of variable references between cells
- **Reactive Updates**: Changes to variable definitions propagate to dependent cells
- **Topological Execution**: Cells execute in dependency order, not just definition order

### Cell Types and Functionality

#### 1. Logic Cells (Variable-Defining)

Cells that define variables available to subsequent cells (ObservableHQ-style):

```javascript
// Cell defines variable: pascalCase (logic)
function pascalCase(str) {
  return str.replace(/(^\w|-\w)/g, (match) => match.toUpperCase().replace('-', ''));
}

// Cell defines variable: entityName (logic) - can reference previous variables
const entityName = pascalCase(model.name) + 'Entity';

// Cell defines variable: entityClass (logic) - references entityName
const entityClass = `export class ${entityName} {
${model.fields.map(field => `  ${field.name}: ${field.type};`).join('\n')}
}`;
```

#### 2. Markdown Cells

Documentation and comments within templates:

```markdown
# Entity Generation Template

This template generates TypeScript entity classes from the data model.

## Usage

- Define your model fields
- Run the template to generate classes
```

#### 3. Handlebars Cells

Legacy Handlebars template fragments for backward compatibility:

```handlebars
{{!-- Cell: entity-class --}}
export class {{entityName}} {
{{#each model.fields}}
  {{name}}: {{type}};
{{/each}}
}
```

#### 4. Form Cells

User interface elements for specifying template options:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440001",
  "type": "form",
  "content": "",
  "formOptions": [
    {
      "name": "includeValidation",
      "type": "boolean",
      "label": "Include validation decorators",
      "default": true
    },
    {
      "name": "generateTests",
      "type": "boolean",
      "label": "Generate unit tests",
      "default": false
    },
    {
      "name": "baseClass",
      "type": "string",
      "label": "Base class to extend",
      "default": "BaseEntity"
    }
  ]
}
```

#### 5. Hybrid Cells (Code + Form)

Cells that combine JavaScript logic with user-configurable options:

```javascript
// Cell with both code and form options
const validationDecorators = includeValidation ?
  model.fields.map(field => `@Validate(${field.validation})`).join('\n') : '';

const entityClass = `
${validationDecorators}
export class ${entityName} extends ${baseClass} {
${model.fields.map(field => `  ${field.name}: ${field.type};`).join('\n')}
}
`;
```

#### 6. Output Buffer Cells

Stream-like buffers that accumulate output from multiple cells:

```javascript
// Cell: imports-buffer (buffer)
const imports = createBuffer('imports');

// Later cells can write to this buffer
imports.write('import { Component } from \'@angular/core\';\n');
imports.write('import { Observable } from \'rxjs\';\n');
```

#### 7. Output Definition Cells

Specify file destinations and output configuration:

```javascript
// Cell: entity-output (output)
defineOutput({
  filename: `${entityName}.ts`,
  content: entityClass,
  path: 'src/entities/'
});
```

### Template Re-use System

#### Template Inheritance

Templates can extend other templates using UUID references:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440010",
  "name": "TypeScript Entity Template",
  "extends": "550e8400-e29b-41d4-a716-446655440000",
  // UUID of BaseEntityTemplate
  "cells": [
    // Additional cells specific to TypeScript
  ]
}
```

#### Template Imports

Import and use variables/functions from other templates within cells:

```javascript
// Cell: import-base-template
const baseTemplate = importTemplate('550e8400-e29b-41d4-a716-446655440000');

// Use functions from imported template
const baseFields = baseTemplate.generateBaseFields(model);

// Reference variables from imported template
const allFields = [...baseTemplate.commonFields, ...model.fields];
```

#### Cross-Template Variable References

Cells can reference variables defined in imported templates:

```javascript
// In BaseEntityTemplate, a cell defines:
const commonImports = [
  'import { BaseEntity } from \'./base\';',
  'import { Validate } from \'class-validator\';'
];

// In TypeScriptEntityTemplate, a cell can reference it:
const allImports = [...commonImports,
  'import { Entity, Column } from \'typeorm\';'
];
```

### JavaScript Implementation

#### TypeScript/Node.js Implementation

Primary implementation using modern JavaScript with reactive variable system:

```typescript
class TemplateEngine {
  private buffers: Map<string, WritableStream> = new Map();
  private variables: Map<string, any> = new Map();
  private cellResults: Map<string, any> = new Map(); // Cell UUID -> result

  async executeTemplate(template: Template, model: any): Promise<FileOutput[]> {
    // Load extended templates if any
    const extendedTemplates = await this.loadExtendedTemplates(template);

    const context = this.createExecutionContext(model, extendedTemplates);

    // Execute cells in topological order based on dependencies
    const executionOrder = this.buildExecutionOrder(template.cells);

    for (const cell of executionOrder) {
      const result = await this.executeCell(cell, context);
      if (cell.variableName) {
        this.variables.set(cell.variableName, result);
        this.cellResults.set(cell.uuid, result);
      }
    }

    return this.collectOutputs();
  }

  private createExecutionContext(model: any, extendedTemplates: Template[]) {
    return {
      model,
      buffers: this.buffers,
      variables: this.variables,
      cellResults: this.cellResults,
      extendedTemplates,
      // Built-in utilities
      pascalCase: (str: string) => str.replace(/(^\w|-\w)/g, (match) => match.toUpperCase().replace('-', '')),
      camelCase: (str: string) => str.charAt(0).toLowerCase() + str.slice(1),
      importTemplate: (uuid: string) => this.findTemplateByUuid(uuid, extendedTemplates),
      // ... more utilities
    };
  }

  private buildExecutionOrder(cells: TemplateCell[]): TemplateCell[] {
    // Build dependency graph and return topological sort
    // Variables referenced in cell content determine dependencies
    return cells; // Simplified - would implement topological sort
  }
}
```

#### Java Implementation

Secondary implementation for Java-based code generation using GraalVM JavaScript:

```java
public class JavaTemplateEngine {
  private Map<String, PrintStream> buffers = new HashMap<>();
  private Map<String, Object> variables = new HashMap<>();
  private Map<String, Object> cellResults = new HashMap<>(); // Cell UUID -> result

  public List<FileOutput> executeTemplate(Template template, Object model) throws Exception {
    // Initialize GraalVM JavaScript engine
    Context context = Context.newBuilder("js")
      .allowAllAccess(true) // For template execution - restrict in production
      .build();

    // Load extended templates if any
    List<Template> extendedTemplates = loadExtendedTemplates(template);

    // Set up global context
    Value global = context.getBindings("js");
    global.putMember("model", model);
    global.putMember("buffers", buffers);
    global.putMember("variables", variables);
    global.putMember("cellResults", cellResults);
    global.putMember("extendedTemplates", extendedTemplates);

    // Add built-in utilities
    context.eval("js", """
          function pascalCase(str) {
              return str.replace(/(^\\w|-\\w)/g, (match) => match.toUpperCase().replace('-', ''));
          }
          function camelCase(str) {
              return str.charAt(0).toLowerCase() + str.slice(1);
          }
          function importTemplate(uuid) {
              // Find template by UUID from extendedTemplates
              return extendedTemplates.find(t => t.uuid === uuid);
          }
          // ... more utilities
      """);

    // Execute cells in topological order
    List<TemplateCell> executionOrder = buildExecutionOrder(template.getCells());

    for (TemplateCell cell : executionOrder) {
      Object result = executeCell(cell, context);
      if (cell.getVariableName() != null) {
        variables.put(cell.getVariableName(), result);
        cellResults.put(cell.getUuid(), result);
      }
    }

    return collectOutputs();
  }

  private Object executeCell(TemplateCell cell, Context context) throws Exception {
    switch (cell.getType()) {
      case LOGIC:
        Value result = context.eval("js", cell.getContent());
        return result.as(Object.class);
      case BUFFER:
        PrintStream buffer = new PrintStream(new ByteArrayOutputStream());
        buffers.put(cell.getUuid(), buffer);
        context.getBindings("js").putMember(cell.getUuid(), buffer);
        return buffer;
      case FORM:
        // Form cells are handled at UI level, skip execution
        return null;
      case OUTPUT:
        // Handle output definition
        return null;
      default:
        return null;
    }
  }

  private List<TemplateCell> buildExecutionOrder(List<TemplateCell> cells) {
    // Build dependency graph based on variable references
    // Return topological sort - simplified implementation
    return cells;
  }
}
```

#### GraalVM Integration Benefits

- **High Performance**: GraalVM JavaScript provides near-native performance for JavaScript execution
- **Modern JavaScript**: Full ES2020+ support with advanced features
- **Interoperability**: Seamless data exchange between Java and JavaScript objects
- **Security**: Configurable access controls for safe template execution
- **Polyglot**: Can leverage other GraalVM languages if needed

### Buffer System for Hoisting

Output buffers enable hoisting patterns:

#### Import Hoisting

```javascript
// Cell: imports-buffer (buffer)
const importsBuffer = createBuffer('imports');

// Cell: add-angular-imports
importsBuffer.write('import { Component, OnInit } from \'@angular/core\';\n');

// Cell: add-rxjs-imports
importsBuffer.write('import { Observable, BehaviorSubject } from \'rxjs\';\n');

// Later cell uses the hoisted imports
const classDefinition = `
${importsBuffer.getContent()}

@Component({...})
export class ${model.name}Component implements OnInit {
  // Component logic
}
`;
```

#### Global Member Hoisting

```javascript
// Cell: static-members-buffer (buffer)
const staticMembers = createBuffer('staticMembers');

// Cell: add-static-constants
staticMembers.write('  private static readonly API_ENDPOINT = \'/api/v1\';\n');

// Cell: add-static-methods
staticMembers.write(`
  private static validateInput(input: any): boolean {
    return input != null;
  }
`);

// Cell: generate-class
const entityClass = `
export class ${model.name} {
${staticMembers.getContent()}

  // Instance members
  constructor() {}
}
`;
```

### Multi-File Output

Single templates can generate multiple files:

```javascript
// Cell: entity-file-output (output)
defineOutput({
  filename: `${model.name}.entity.ts`,
  content: entityBuffer.getContent(),
  directory: 'src/entities'
});

// Cell: dto-file-output (output)
defineOutput({
  filename: `${model.name}.dto.ts`,
  content: dtoBuffer.getContent(),
  directory: 'src/dtos'
});

// Cell: service-file-output (output)
defineOutput({
  filename: `${model.name}.service.ts`,
  content: serviceBuffer.getContent(),
  directory: 'src/services'
});
```

#### Error Handling and Validation

Built-in validation and error reporting:

```javascript
// Cell with validation
try {
  const generatedCode = generateEntityCode(model);
  validateTypeScript(generatedCode);
  entityBuffer.write(generatedCode);
} catch (error) {
  throw new TemplateError(`Code generation failed: ${error.message}`, cell.id);
}
```

#### Debugging and Inspection

Rich debugging capabilities:

- **Cell Execution Tracing**: Track execution order and timing
- **Buffer Inspection**: Examine buffer contents at any point
- **Variable Watching**: Monitor variable changes across cells
- **Error Context**: Detailed error information with cell references

### Implementation Strategy

#### Phase 1: Core Engine (TypeScript/Node.js)

1. **Cell Parser**: Parse template definitions into cell structures
2. **JavaScript Runtime**: Implement JavaScript execution environment
3. **Buffer System**: Create stream-like buffer implementation
4. **Output System**: Multi-file output handling

#### Phase 2: Java Implementation

1. **GraalVM Integration**: Implement GraalVM JavaScript engine for high-performance JavaScript execution
2. **Buffer Compatibility**: Implement PrintStream-like buffers in Java with GraalVM interoperability
3. **Cross-Platform Testing**: Ensure feature parity between TypeScript and Java implementations

#### Phase 3: Advanced Features

1. **Template Inheritance**: Support for template extension and composition
2. **Validation Framework**: Built-in code validation and error handling
3. **Debugging Tools**: Rich debugging and inspection interface

#### Phase 4: Integration

1. **Handlebars Migration**: Gradual migration path from Handlebars
2. **UI Integration**: Cell-based editing in xomda.js client interface
3. **Performance Optimization**: Optimize for large-scale code generation

### Benefits

#### Developer Experience

- **ObservableHQ-style Variables**: Define variables in cells that automatically become available to subsequent cells
- **Reactive Dependencies**: Changes propagate automatically through the template execution graph
- **Form-based Configuration**: User-friendly forms for template customization
- **JavaScript Power**: Full JavaScript language for complex logic
- **Template Re-use**: Modular, composable template system with UUID-based references
- **Multi-File Output**: Generate complete applications from single templates
- **Buffer Flexibility**: Advanced output management with hoisting capabilities

#### System Performance

- **Dependency-based Execution**: Only execute cells when their dependencies change
- **Buffer Streaming**: Memory-efficient output accumulation
- **Caching**: Computed results and variables cached for performance
- **Topological Optimization**: Execute cells in optimal dependency order

#### Maintainability

- **UUID-based Identity**: Reliable template and cell references regardless of location
- **Modular Design**: Cells promote reusable, maintainable templates
- **JSON Storage**: Human-readable, version-controllable format
- **Rich Debugging**: Comprehensive tools for troubleshooting variable flow and dependencies

### Challenges and Mitigations

#### Cross-Platform Compatibility

**Challenge**: Maintaining feature parity between TypeScript and Java implementations

**Mitigation**:

- Comprehensive test suites for both platforms
- Shared specification documents
- Regular synchronization of implementations

#### Learning Curve

**Challenge**: New concepts (buffers, cell types) require learning

**Mitigation**:

- Extensive documentation and examples
- Interactive tutorials
- Gradual migration with backward compatibility

#### Performance Overhead

**Challenge**: JavaScript execution in Java environment may be slower

**Mitigation**:

- **GraalVM JavaScript**: High-performance JavaScript engine with near-native execution speed
- Provide native Java alternatives for performance-critical operations
- Performance profiling and optimization tools
- JIT compilation benefits from repeated template execution

### Migration Path

#### Gradual Adoption

1. **Parallel Implementation**: Develop TEMPLATE++ alongside existing system
2. **Feature Flags**: Allow users to opt into new features
3. **Template Conversion**: Automated tools to convert Handlebars templates
4. **Backward Compatibility**: Ensure existing templates continue to work

#### Integration Points

- **Model System**: Integrate with existing tRPC routers
- **Storage System**: Extend current template storage for JSON format
- **Client Interface**: Add cell-based editing with form support
- **Build System**: Integrate with pnpm workspace builds

### Technical Requirements

#### TypeScript/Node.js Environment

- **Node.js**: Version 18+ for modern JavaScript features
- **TypeScript**: Version 5.0+ for advanced type system
- **Build Tools**: pnpm for workspace management

#### Java Environment

- **Java**: Version 11+ (required for GraalVM)
- **GraalVM**: Version 22+ for JavaScript engine
- **Maven/Gradle**: For Java plugin integration
- **JVM Options**: Configure for GraalVM JavaScript performance

### Future Extensions

#### Advanced Reactivity

- **Signals Integration**: Use reactive signals for fine-grained updates
- **Async Cells**: Support for asynchronous code generation
- **Streaming Outputs**: Real-time streaming of generated code

#### AI-Assisted Templating

- **Auto-completion**: AI-powered cell content suggestions
- **Template Generation**: Generate templates from model examples
- **Optimization**: AI-driven template performance improvements

#### Multi-Language Support

- **Cross-Platform**: Generate code for multiple languages simultaneously
- **Language Plugins**: Extensible architecture for new target languages
- **Type Safety**: Ensure type consistency across generated code

## Conclusion

TEMPLATE++ represents a revolutionary advancement in code generation technology, combining the reactive variable system
of ObservableHQ with modern JavaScript programming in the domain of model-driven development. By adopting a cell-based
approach where variables defined in cells automatically become available to subsequent cells, xomda.js provides an
intuitive and powerful templating system.

The design introduces UUID-based identity for reliable template and cell references, form-based user configuration, and
a JSON storage format that enables sophisticated template composition and re-use. The reactive dependency system ensures
that changes propagate efficiently through the execution graph, while the dual implementation strategy maintains
compatibility across different deployment environments.

This approach transforms xomda.js into a leader in advanced code generation, enabling developers to create more
sophisticated applications with unprecedented ease, flexibility, and maintainability.
