import './MarkdownPreview.scss'

import { OpenWorkspaceLinkKey } from '@xomda/analysis-client'
import { CodeEditor } from '@xomda/codeeditor'
import { computed, defineComponent, inject, type PropType, type VNode } from 'vue'
import { useTheme } from 'vuetify'

import { handleLocalLinkClick } from './link-handler'
import { type BlockNode, type InlineNode, parseMarkdown } from './markdown-parser'

/**
 * Read-only preview for `.md` files. Parses the source ourselves and
 * renders to Vue VNodes so we never need to set `innerHTML` from a
 * string — anything we don't understand is wrapped in a visibly-marked
 * `<span class="md-unsupported">` rather than passed through as raw
 * HTML. Code fences delegate to the existing `CodeEditor` so language
 * highlighting matches the rest of the app instead of inventing a
 * second highlighter.
 *
 * Receives the standard custom-preview prop shape
 * (`{ path, text, data }`); only `text` is used.
 */
export const MarkdownPreview = defineComponent({
  name: 'MarkdownPreview',
  props: {
    path: { type: String, default: '' },
    text: { type: String, default: '' },
    data: { type: null as unknown as PropType<unknown>, default: undefined },
  },
  setup(props) {
    const theme = useTheme()
    const editorTheme = computed(() =>
      theme.global.current.value.dark ? 'xomda-dark' : 'xomda-light'
    )
    const ast = computed(() => parseMarkdown(props.text ?? ''))
    // Match the Monaco theme's editor background so the wrapper's padding
    // blends into the editor itself rather than showing the page through.
    const codeBg = computed(() => (theme.global.current.value.dark ? '#1B1E26' : '#FFFFFF'))

    // Host-provided handler for workspace-internal links. Absent in
    // standalone usage (tests, Storybook); links degrade gracefully to
    // an inert anchor in that case.
    const openWorkspaceLink = inject(OpenWorkspaceLinkKey, null)

    const onLocalLinkClick = (e: MouseEvent, href: string) =>
      handleLocalLinkClick(e, href, props.path, openWorkspaceLink)

    return () => (
      <div class="md-preview">
        <article class="md-preview-body">
          {ast.value.map((block, idx) =>
            renderBlock(block, idx, editorTheme.value, codeBg.value, onLocalLinkClick)
          )}
        </article>
      </div>
    )
  },
})

type LocalLinkHandler = (e: MouseEvent, href: string) => void

function renderBlock(
  block: BlockNode,
  key: number,
  editorTheme: string,
  codeBg: string,
  onLocalLinkClick: LocalLinkHandler
): VNode | null {
  const inline = (node: InlineNode, i: number) => renderInline(node, i, onLocalLinkClick)
  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level}` as 'h1'
      return <Tag key={key}>{block.inline.map(inline)}</Tag>
    }
    case 'paragraph':
      return <p key={key}>{block.inline.map(inline)}</p>
    case 'hr':
      return <hr key={key} />
    case 'blockquote':
      return (
        <blockquote key={key}>
          {block.children.map((b, i) => renderBlock(b, i, editorTheme, codeBg, onLocalLinkClick))}
        </blockquote>
      )
    case 'list':
      if (block.ordered) {
        return (
          <ol key={key}>
            {block.items.map((item, i) => (
              <li key={i}>{item.map(inline)}</li>
            ))}
          </ol>
        )
      }
      return (
        <ul key={key}>
          {block.items.map((item, i) => (
            <li key={i}>{item.map(inline)}</li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <div key={key} class="md-preview-table-wrap">
          <table class="md-preview-table">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} style={alignStyle(block.align[i])}>
                    {cell.map(inline)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={alignStyle(block.align[ci])}>
                      {cell.map(inline)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'code': {
      // Pick a height that fits the content without scrolling for
      // typical-sized snippets, but cap so a 2000-line dump doesn't
      // take over the pane.
      const lineCount = block.value.split('\n').length
      // 16px of vertical padding inside the editor + small buffer; cap so a
      // huge dump doesn't take over the pane.
      const height = Math.min(Math.max(lineCount, 1) * 19 + 32, 500)
      return (
        <div key={key} class="md-preview-code" style={{ backgroundColor: codeBg }}>
          <CodeEditor
            modelValue={block.value}
            language={block.lang ?? 'plaintext'}
            theme={editorTheme}
            readOnly={true}
            lineNumbers={false}
            stickyScroll={false}
            height={height}
            options={{
              minimap: { enabled: false },
              folding: false,
              scrollBeyondLastLine: false,
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: { vertical: 'auto', horizontal: 'auto' },
              wordWrap: 'off',
              guides: { indentation: false },
              padding: { top: 8, bottom: 8 },
              lineDecorationsWidth: 12,
              lineNumbersMinChars: 0,
            }}
          />
        </div>
      )
    }
    case 'unsupported-block':
      return (
        <div key={key} class="md-preview-unsupported" title={`Unsupported: ${block.reason}`}>
          {block.raw}
        </div>
      )
  }
}

function renderInline(
  node: InlineNode,
  key: number,
  onLocalLinkClick: LocalLinkHandler
): VNode | string {
  const recurse = (n: InlineNode, i: number) => renderInline(n, i, onLocalLinkClick)
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong':
      return <strong key={key}>{node.children.map(recurse)}</strong>
    case 'em':
      return <em key={key}>{node.children.map(recurse)}</em>
    case 'code':
      return <code key={key}>{node.value}</code>
    case 'br':
      return <br key={key} />
    case 'link': {
      const href = safeHref(node.href)
      const kind = linkKind(node.href)
      // Workspace-internal links delegate to the host-provided click
      // handler. The host resolves the link against the file the
      // preview is rendered from and either navigates the file
      // browser to it (inside the workspace) or refuses with a
      // visible error (outside). The visible `href` keeps right-click
      // → copy useful even though we intercept the primary click.
      if (kind === 'local') {
        return (
          <a
            key={key}
            href={href}
            title={node.title ?? `Workspace link: ${node.href}`}
            onClick={(e: MouseEvent) => onLocalLinkClick(e, node.href)}
          >
            {node.children.map(recurse)}
          </a>
        )
      }
      // Fragment links (`#section`) stay in-page; no new tab.
      if (kind === 'fragment') {
        return (
          <a key={key} href={href} title={node.title ?? undefined}>
            {node.children.map(recurse)}
          </a>
        )
      }
      // External (http/https/mailto/tel): open in a new tab.
      return (
        <a
          key={key}
          href={href}
          title={node.title ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          {node.children.map(recurse)}
        </a>
      )
    }
    case 'image':
      return (
        <img
          key={key}
          src={safeHref(node.src)}
          alt={node.alt}
          title={node.title ?? undefined}
          loading="lazy"
        />
      )
    case 'unsupported':
      return (
        <span
          key={key}
          class="md-preview-unsupported md-preview-unsupported-inline"
          title={`Unsupported: ${node.reason}`}
        >
          {node.raw}
        </span>
      )
  }
}

function alignStyle(a: 'left' | 'right' | 'center' | null | undefined) {
  if (!a) return undefined
  return { textAlign: a }
}

/**
 * Classify a link's destination so we can route external clicks to a
 * new tab, keep fragment clicks in-page, and make local file links
 * inert (we don't know how to navigate to "the preview of another
 * file" from here, so opening a real URL would just land the user on
 * a 404).
 */
function linkKind(url: string): 'external' | 'fragment' | 'local' {
  const t = url.trim()
  if (t.startsWith('#')) return 'fragment'
  if (/^(https?:|mailto:|tel:|data:image\/)/i.test(t)) return 'external'
  return 'local'
}

/**
 * Block `javascript:` and other non-http(s) schemes in user-supplied
 * markdown. The preview pane reads files from the user's own project,
 * but the file could be third-party — and a rendered link is one
 * click away from script execution. Allow only known-safe schemes
 * plus relative/fragment URLs.
 */
function safeHref(url: string): string {
  const trimmed = url.trim()
  if (trimmed === '') return '#'
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(trimmed)) return trimmed
  if (/^data:image\//i.test(trimmed)) return trimmed
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed // relative
  return '#'
}
