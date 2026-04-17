/**
 * Tiny, dependency-free markdown parser. Covers the CommonMark + GFM
 * subset we need for read-only previews: headings, paragraphs, lists
 * (flat), blockquotes (one level), fenced code with language, GFM
 * tables, thematic breaks, links, images, emphasis, inline code.
 *
 * Anything the parser doesn't recognise is emitted as an `unsupported`
 * node so the renderer can surface it visibly — the goal is "if it
 * isn't rendered the way you expect, you can see why" rather than
 * silently swallowing input.
 *
 * Deliberately *not* a CommonMark-conformant implementation: no setext
 * headings, no reference links, no HTML passthrough, no nested lists,
 * no footnotes. The preview is for casual reading, not authoring.
 */

export interface MdHeading {
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  inline: InlineNode[]
}
export interface MdParagraph {
  type: 'paragraph'
  inline: InlineNode[]
}
export interface MdCode {
  type: 'code'
  lang: string | null
  value: string
}
export interface MdBlockquote {
  type: 'blockquote'
  children: BlockNode[]
}
export interface MdList {
  type: 'list'
  ordered: boolean
  items: InlineNode[][]
}
export interface MdTable {
  type: 'table'
  header: InlineNode[][]
  align: Array<'left' | 'right' | 'center' | null>
  rows: InlineNode[][][]
}
export interface MdHr {
  type: 'hr'
}
export interface MdUnsupportedBlock {
  type: 'unsupported-block'
  reason: string
  raw: string
}

export type BlockNode =
  | MdHeading
  | MdParagraph
  | MdCode
  | MdBlockquote
  | MdList
  | MdTable
  | MdHr
  | MdUnsupportedBlock

export interface InlineText {
  type: 'text'
  value: string
}
export interface InlineStrong {
  type: 'strong'
  children: InlineNode[]
}
export interface InlineEm {
  type: 'em'
  children: InlineNode[]
}
export interface InlineCode {
  type: 'code'
  value: string
}
export interface InlineLink {
  type: 'link'
  href: string
  title: string | null
  children: InlineNode[]
}
export interface InlineImage {
  type: 'image'
  src: string
  alt: string
  title: string | null
}
export interface InlineBr {
  type: 'br'
}
export interface InlineUnsupported {
  type: 'unsupported'
  reason: string
  raw: string
}

export type InlineNode =
  | InlineText
  | InlineStrong
  | InlineEm
  | InlineCode
  | InlineLink
  | InlineImage
  | InlineBr
  | InlineUnsupported

const HR_RE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)\s*$/
const BLOCKQUOTE_RE = /^ {0,3}>\s?(.*)$/
const UL_RE = /^ {0,3}[-*+]\s+(.*)$/
const OL_RE = /^ {0,3}\d+\.\s+(.*)$/
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/

export function parseMarkdown(input: string): BlockNode[] {
  // Normalise EOLs; tab → 4 spaces keeps indent math simple.
  const lines = input.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')
  const blocks: BlockNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (line.trim() === '') {
      i++
      continue
    }

    // Fenced code block — must come before paragraph so ``` doesn't
    // get mangled by inline backtick scanning.
    const fence = line.match(FENCE_RE)
    if (fence) {
      const marker = fence[1]!
      const lang = fence[2]?.trim() || null
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith(marker)) {
        body.push(lines[i]!)
        i++
      }
      i++ // closing fence (or EOF)
      blocks.push({ type: 'code', lang, value: body.join('\n') })
      continue
    }

    // Thematic break
    if (HR_RE.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // ATX heading
    const heading = line.match(HEADING_RE)
    if (heading) {
      const level = heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6
      blocks.push({ type: 'heading', level, inline: parseInline(heading[2] ?? '') })
      i++
      continue
    }

    // Blockquote (one level)
    if (BLOCKQUOTE_RE.test(line)) {
      const buf: string[] = []
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i]!)) {
        buf.push(lines[i]!.replace(BLOCKQUOTE_RE, '$1'))
        i++
      }
      // Detect (but don't recurse into) nested blockquotes so we can
      // flag them rather than silently dropping a '>' character.
      const nested = buf.some((l) => /^ {0,3}>/.test(l))
      const inner = parseMarkdown(buf.join('\n'))
      if (nested) {
        inner.push({
          type: 'unsupported-block',
          reason: 'nested blockquote',
          raw: '> >',
        })
      }
      blocks.push({ type: 'blockquote', children: inner })
      continue
    }

    // GFM table — header row, then separator, then body rows
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]!)) {
      const headerCells = splitTableRow(line)
      const sepCells = splitTableRow(lines[i + 1]!)
      const align = sepCells.map(parseAlign)
      const rows: InlineNode[][][] = []
      i += 2
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim() !== '') {
        const cells = splitTableRow(lines[i]!).map((c) => parseInline(c))
        // Pad/truncate to header width.
        while (cells.length < headerCells.length) cells.push([])
        cells.length = headerCells.length
        rows.push(cells)
        i++
      }
      blocks.push({
        type: 'table',
        header: headerCells.map((c) => parseInline(c)),
        align,
        rows,
      })
      continue
    }

    // Lists (flat; mixed markers within a block start a new list)
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const ordered = OL_RE.test(line)
      const re = ordered ? OL_RE : UL_RE
      const items: InlineNode[][] = []
      while (i < lines.length && re.test(lines[i]!)) {
        const m = lines[i]!.match(re)!
        items.push(parseInline(m[1] ?? ''))
        i++
        // Eat blank continuation lines? Keep it strict for now —
        // a blank line ends the list.
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Paragraph: gather until blank line or block start.
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i]!.trim() !== '' && !startsBlock(lines[i]!)) {
      para.push(lines[i]!)
      i++
    }
    blocks.push({ type: 'paragraph', inline: parseInline(para.join('\n')) })
  }

  return blocks
}

function startsBlock(line: string): boolean {
  return (
    HR_RE.test(line) ||
    HEADING_RE.test(line) ||
    FENCE_RE.test(line) ||
    BLOCKQUOTE_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line)
  )
}

function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  // Allow `\|` to escape a pipe inside a cell.
  const cells: string[] = []
  let buf = ''
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === '\\' && s[k + 1] === '|') {
      buf += '|'
      k++
      continue
    }
    if (c === '|') {
      cells.push(buf.trim())
      buf = ''
      continue
    }
    buf += c
  }
  cells.push(buf.trim())
  return cells
}

function parseAlign(sep: string): 'left' | 'right' | 'center' | null {
  const s = sep.trim()
  const left = s.startsWith(':')
  const right = s.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

/**
 * Inline scanner. Walks the string left-to-right and matches the
 * earliest delimiter; everything between matches becomes a text node.
 * Order of patterns matters — images must precede links, strong must
 * precede em, etc.
 */
export function parseInline(input: string): InlineNode[] {
  const out: InlineNode[] = []
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf) {
      out.push({ type: 'text', value: buf })
      buf = ''
    }
  }

  while (i < input.length) {
    const ch = input[i]!

    // Backslash escape — next char is literal.
    if (ch === '\\' && i + 1 < input.length) {
      buf += input[i + 1]
      i += 2
      continue
    }

    // Hard line break: two trailing spaces before newline.
    if (ch === ' ' && input[i + 1] === ' ' && input[i + 2] === '\n') {
      flush()
      out.push({ type: 'br' })
      i += 3
      continue
    }
    if (ch === '\n') {
      // Soft break → space (CommonMark default).
      buf += ' '
      i++
      continue
    }

    // Inline code: longest matching backtick run wins.
    if (ch === '`') {
      let run = 1
      while (input[i + run] === '`') run++
      const tick = '`'.repeat(run)
      const end = input.indexOf(tick, i + run)
      if (end !== -1) {
        flush()
        out.push({ type: 'code', value: input.slice(i + run, end) })
        i = end + run
        continue
      }
      // No closing run — fall through as text.
    }

    // Image: ![alt](src "title")
    if (ch === '!' && input[i + 1] === '[') {
      const m = matchLinkLike(input, i + 1)
      if (m) {
        flush()
        const parsed = parseLinkDest(m.dest)
        out.push({
          type: 'image',
          alt: m.label,
          src: parsed.url,
          title: parsed.title,
        })
        i = m.end
        continue
      }
    }

    // Link: [text](href "title")
    if (ch === '[') {
      const m = matchLinkLike(input, i)
      if (m) {
        flush()
        const parsed = parseLinkDest(m.dest)
        out.push({
          type: 'link',
          href: parsed.url,
          title: parsed.title,
          children: parseInline(m.label),
        })
        i = m.end
        continue
      }
    }

    // Strong + em. Two-char delimiters first.
    if ((ch === '*' || ch === '_') && input[i + 1] === ch) {
      const delim = ch + ch
      const end = findCloser(input, i + 2, delim)
      if (end !== -1) {
        flush()
        out.push({ type: 'strong', children: parseInline(input.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    if (ch === '*' || ch === '_') {
      const end = findCloser(input, i + 1, ch)
      // Underscore inside a word (intra_word_emphasis) is a CommonMark
      // non-emphasis case — skip when both sides are alphanumeric.
      const prev = input[i - 1] ?? ' '
      const next = input[i + 1] ?? ' '
      const intraWord = ch === '_' && /\w/.test(prev) && /\w/.test(next)
      if (end !== -1 && !intraWord) {
        flush()
        out.push({ type: 'em', children: parseInline(input.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    // Raw HTML — visibly flag rather than render. We don't trust or
    // strip HTML; surfacing it is the safest "unsupported" behavior.
    if (ch === '<') {
      const close = input.indexOf('>', i + 1)
      if (close !== -1 && /^<[/!?a-zA-Z]/.test(input.slice(i))) {
        flush()
        const raw = input.slice(i, close + 1)
        out.push({ type: 'unsupported', reason: 'inline HTML', raw })
        i = close + 1
        continue
      }
    }

    buf += ch
    i++
  }

  flush()
  return out
}

interface LinkMatch {
  label: string
  dest: string
  end: number
}

function matchLinkLike(s: string, start: number): LinkMatch | null {
  // s[start] must be '['
  if (s[start] !== '[') return null
  let depth = 1
  let k = start + 1
  while (k < s.length && depth > 0) {
    const c = s[k]
    if (c === '\\') {
      k += 2
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) break
    }
    k++
  }
  if (depth !== 0) return null
  const labelEnd = k
  if (s[labelEnd + 1] !== '(') return null
  const destStart = labelEnd + 2
  let pdepth = 1
  let j = destStart
  while (j < s.length && pdepth > 0) {
    const c = s[j]
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === '(') pdepth++
    else if (c === ')') {
      pdepth--
      if (pdepth === 0) break
    }
    j++
  }
  if (pdepth !== 0) return null
  return {
    label: s.slice(start + 1, labelEnd),
    dest: s.slice(destStart, j),
    end: j + 1,
  }
}

function parseLinkDest(dest: string): { url: string; title: string | null } {
  const s = dest.trim()
  // url "title" or url 'title' or url (title)
  const m = s.match(/^(\S+)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/)
  if (m) {
    return { url: m[1] ?? '', title: m[2] ?? m[3] ?? m[4] ?? null }
  }
  return { url: s, title: null }
}

function findCloser(s: string, from: number, delim: string): number {
  let k = from
  while (k < s.length) {
    if (s[k] === '\\') {
      k += 2
      continue
    }
    if (delim.length === 1) {
      if (s[k] === delim) return k
    } else {
      if (s[k] === delim[0] && s[k + 1] === delim[1]) return k
    }
    k++
  }
  return -1
}
