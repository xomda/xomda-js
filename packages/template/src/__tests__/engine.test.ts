import type { Model, Template } from '@xomda/core'
import { describe, expect, it } from 'vitest'

import { executeTemplate, OutputBuffer } from '../engine'

const emptyModel: Model = {
  id: 'test-model',
  name: 'TestModel',
  version: '1.0.0',
  packages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  elementsOrder: [],
}

function makeTemplate(cells: Template['cells']): Template {
  return { uuid: crypto.randomUUID(), name: 'Test', version: '1.0.0', cells }
}

describe('OutputBuffer', () => {
  it('accumulates chunks', () => {
    const buf = new OutputBuffer()
    buf.write('hello ')
    buf.write('world')
    expect(buf.getContent()).toBe('hello world')
  })

  it('toString delegates to getContent', () => {
    const buf = new OutputBuffer()
    buf.write('abc')
    expect(String(buf)).toBe('abc')
  })
})

describe('executeTemplate', () => {
  it('returns empty when output cell has no filename', async () => {
    const template = makeTemplate([
      { uuid: crypto.randomUUID(), type: 'output', content: '' },
    ])
    expect((await executeTemplate(template, emptyModel)).files).toHaveLength(0)
  })

  it('output cell with static filename produces a result', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
        outputContent: 'text',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'logic',
        content: 'text = "hello"',
      },
    ])
    // logic cell runs after output cell here — result should be empty string since 'text' not yet defined
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results).toHaveLength(1)
    expect(results[0].outputPath).toBe('out.txt')
  })

  it('logic cell variable is available to subsequent output cell', async () => {
    const template = makeTemplate([
      { uuid: crypto.randomUUID(), type: 'logic', content: 'msg = "hello"' },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
        outputContent: 'msg',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results[0].content).toBe('hello')
  })

  it('evaluates outputFilename using Handlebars interpolation', async () => {
    const template = makeTemplate([
      { uuid: crypto.randomUUID(), type: 'logic', content: 'name = "Entity"' },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: '{{name}}.ts',
        outputContent: 'name',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results[0].outputPath).toBe('Entity.ts')
  })

  it('outputFilename can include a directory path', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'src/gen/file.ts',
        outputContent: 'x',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results[0].outputPath).toBe('src/gen/file.ts')
  })

  it('uses built-in helpers in outputFilename via Handlebars', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: '{{pascalCase model.name}}.ts',
        outputContent: 'x',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results[0].outputPath).toBe('TestModel.ts')
  })

  it('accumulates content via OutputBuffer', async () => {
    const template = makeTemplate([
      { uuid: crypto.randomUUID(), type: 'buffer', content: '', variableName: 'buf' },
      {
        uuid: crypto.randomUUID(),
        type: 'logic',
        content: `buf.write('line1\\n'); buf.write('line2\\n')`,
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
        outputContent: 'buf',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results[0].content).toBe('line1\nline2\n')
  })

  it('generates multiple output files', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'a.ts',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'b.ts',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results.map((r) => r.outputPath)).toEqual(['a.ts', 'b.ts'])
  })

  it('passes model into cell context', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'out.txt',
        outputContent: 'model',
      },
    ])
    // model is an object; content will be "[object Object]" — just testing it doesn't throw
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results).toHaveLength(1)
  })

  it('renders handlebars cells and exposes result as variable', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'handlebars',
        content: 'hello {{model.name}}',
        variableName: 'hbs',
      },
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: 'h.txt',
        outputContent: 'hbs',
      },
    ])
    const results = (await executeTemplate(template, emptyModel)).files
    expect(results[0].content).toBe('hello TestModel')
  })

  it('scope context variables are available in output filename via Handlebars', async () => {
    const template = makeTemplate([
      {
        uuid: crypto.randomUUID(),
        type: 'output',
        content: '',
        outputFilename: '{{entity.name}}.ts',
      },
    ])
    const results = (await executeTemplate(template, emptyModel, { entity: { name: 'User' } })).files
    expect(results[0].outputPath).toBe('User.ts')
  })

  describe('$out implicit per-cell buffer', () => {
    it('logic cell can write to $out and output cell collects it', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `$out.write('hello from logic')`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      expect(results[0].content).toBe('hello from logic')
    })

    it('handlebars cell writes to $out automatically', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'handlebars',
          content: 'name: {{model.name}}',
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      expect(results[0].content).toBe('name: TestModel')
    })

    it('output cell without outputContent concatenates preceding cell $out buffers in order', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `$out.write('A')`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `$out.write('B')`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      expect(results[0].content).toBe('AB')
    })

    it('output cell with outputContent uses named buffer, not $out buffers', async () => {
      const template = makeTemplate([
        { uuid: crypto.randomUUID(), type: 'buffer', content: '', variableName: 'named' },
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `$out.write('from $out'); named.write('from named')`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
          outputContent: 'named',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      expect(results[0].content).toBe('from named')
    })

    it('$out is fresh per cell and does not bleed between cells', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `$out.write('cell1')`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `$out.write('cell2')`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      // each $out is independent; sequential concatenation gives 'cell1cell2'
      expect(results[0].content).toBe('cell1cell2')
    })
  })

  describe('sandbox', () => {
    it('blocks access to window', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: 'result = typeof window',
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
          outputContent: 'result',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      expect(results[0].content).toBe('undefined')
    })

    it('blocks access to globalThis', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: 'result = typeof globalThis',
        },
        {
          uuid: crypto.randomUUID(),
          type: 'output',
          content: '',
          outputFilename: 'out.txt',
          outputContent: 'result',
        },
      ])
      const results = (await executeTemplate(template, emptyModel)).files
      expect(results[0].content).toBe('undefined')
    })

    it('captures console.log output', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `console.log('hello', 'world')`,
        },
      ])
      const { cellOutputs } = await executeTemplate(template, emptyModel)
      expect(cellOutputs[0].consoleLogs).toEqual(['hello world'])
    })

    it('records error on cell that throws', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: 'throw new Error("boom")',
        },
      ])
      const { cellOutputs } = await executeTemplate(template, emptyModel)
      expect(cellOutputs[0].error).toBe('boom')
    })

    it('bare assignment exposes variable to subsequent cells; let/const stay cell-local', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `exposed = 'yes'; const hidden = 'no'; let alsoHidden = 'no'`,
        },
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: `seenExposed = typeof exposed; seenHidden = typeof hidden`,
        },
      ])
      const { cellOutputs } = await executeTemplate(template, emptyModel)
      expect(cellOutputs[0].contextDiff).toEqual({ exposed: 'yes' })
      expect(cellOutputs[1].contextDiff).toEqual({
        seenExposed: 'string',
        seenHidden: 'undefined',
      })
    })

    it('tracks contextDiff for logic cells', async () => {
      const template = makeTemplate([
        {
          uuid: crypto.randomUUID(),
          type: 'logic',
          content: 'answer = 42',
        },
      ])
      const { cellOutputs } = await executeTemplate(template, emptyModel)
      expect(cellOutputs[0].contextDiff).toEqual({ answer: 42 })
    })
  })
})
