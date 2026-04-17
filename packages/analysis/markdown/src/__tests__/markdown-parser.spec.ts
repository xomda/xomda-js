import { describe, expect, it } from 'vitest'

import { parseInline, parseMarkdown } from '../markdown-parser'

describe('parseMarkdown — blocks', () => {
  it('parses ATX headings at each level', () => {
    const blocks = parseMarkdown('# h1\n## h2\n### h3\n###### h6')
    expect(blocks.map((b) => b.type === 'heading' && b.level)).toEqual([1, 2, 3, 6])
  })

  it('groups consecutive non-block lines into a single paragraph', () => {
    const blocks = parseMarkdown('one\ntwo\nthree')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('paragraph')
  })

  it('separates paragraphs by blank lines', () => {
    const blocks = parseMarkdown('one\n\ntwo')
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'paragraph'])
  })

  it('parses thematic breaks', () => {
    const blocks = parseMarkdown('---\n\n***\n\n___')
    expect(blocks.map((b) => b.type)).toEqual(['hr', 'hr', 'hr'])
  })

  it('parses fenced code blocks and captures language', () => {
    const blocks = parseMarkdown('```ts\nconst x = 1\nconst y = 2\n```')
    expect(blocks[0]).toEqual({
      type: 'code',
      lang: 'ts',
      value: 'const x = 1\nconst y = 2',
    })
  })

  it('parses code fences without language', () => {
    const blocks = parseMarkdown('```\nplain\n```')
    expect(blocks[0]).toMatchObject({ type: 'code', lang: null, value: 'plain' })
  })

  it('parses flat unordered lists', () => {
    const blocks = parseMarkdown('- one\n- two\n- three')
    expect(blocks[0]?.type).toBe('list')
    if (blocks[0]?.type === 'list') {
      expect(blocks[0].ordered).toBe(false)
      expect(blocks[0].items).toHaveLength(3)
    }
  })

  it('parses ordered lists', () => {
    const blocks = parseMarkdown('1. one\n2. two')
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: true })
  })

  it('parses single-level blockquotes', () => {
    const blocks = parseMarkdown('> quoted line\n> second line')
    expect(blocks[0]?.type).toBe('blockquote')
  })

  it('flags nested blockquotes as unsupported', () => {
    const blocks = parseMarkdown('> > nested')
    if (blocks[0]?.type !== 'blockquote') throw new Error('expected blockquote')
    const last = blocks[0].children[blocks[0].children.length - 1]
    expect(last?.type).toBe('unsupported-block')
  })

  it('parses GFM tables with alignment', () => {
    const md = '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |'
    const blocks = parseMarkdown(md)
    expect(blocks[0]?.type).toBe('table')
    if (blocks[0]?.type === 'table') {
      expect(blocks[0].align).toEqual(['left', 'center', 'right'])
      expect(blocks[0].rows).toHaveLength(2)
      expect(blocks[0].header).toHaveLength(3)
    }
  })
})

describe('parseInline', () => {
  it('parses bold and italic', () => {
    const out = parseInline('**bold** and *em*')
    expect(out.map((n) => n.type)).toEqual(['strong', 'text', 'em'])
  })

  it('parses inline code with mixed backticks', () => {
    const out = parseInline('a `x` b ``y`y`` c')
    expect(
      out
        .filter((n): n is Extract<typeof n, { type: 'code' }> => n.type === 'code')
        .map((n) => n.value)
    ).toEqual(['x', 'y`y'])
  })

  it('parses links', () => {
    const out = parseInline('[home](https://x.test)')
    expect(out[0]).toMatchObject({ type: 'link', href: 'https://x.test' })
  })

  it('parses images', () => {
    const out = parseInline('![alt](/img.png "title")')
    expect(out[0]).toMatchObject({ type: 'image', src: '/img.png', alt: 'alt', title: 'title' })
  })

  it('honours backslash escapes', () => {
    const out = parseInline('\\*not em\\*')
    expect(out).toEqual([{ type: 'text', value: '*not em*' }])
  })

  it('handles hard line breaks (two trailing spaces)', () => {
    const out = parseInline('line  \nnext')
    expect(out.some((n) => n.type === 'br')).toBe(true)
  })

  it('flags raw HTML as unsupported instead of passing it through', () => {
    const out = parseInline('hi <script>evil()</script>')
    expect(out.some((n) => n.type === 'unsupported')).toBe(true)
  })

  it('does not emphasise intra-word underscores', () => {
    const out = parseInline('snake_case_word')
    expect(out).toEqual([{ type: 'text', value: 'snake_case_word' }])
  })
})
