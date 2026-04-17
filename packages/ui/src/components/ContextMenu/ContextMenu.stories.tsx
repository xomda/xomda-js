import type { Meta, StoryObj } from '@storybook/vue3'
import {
  CodeXmlIcon,
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  FilePresentIcon,
  FolderIcon,
  MoveToFolderIcon,
  OpenWithIcon,
  PropertiesIcon,
  UploadIcon,
} from '@xomda/icons'
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test'

import type { MenuItemConfig } from '../Menu'
import { ContextMenu } from './ContextMenu'

const meta: Meta<typeof ContextMenu> = {
  component: ContextMenu,
  title: 'UI/ContextMenu',
  parameters: { layout: 'padded' },
  argTypes: {
    // Surfaces the `onOpen` callback in the Actions panel even when no
    // explicit spy is bound — every story logs right-click events.
    onOpen: { action: 'open' },
  },
}

export default meta
type Story = StoryObj<typeof ContextMenu>

// Use synthetic `contextmenu` instead of `userEvent.pointer` — Vuetify's
// `VApp` wrapper sometimes has `pointer-events: none` during transitions,
// which trips userEvent's pointer-trace check.
const rightClick = (el: Element) => fireEvent.contextMenu(el)

const fileItems: MenuItemConfig[] = [
  { key: 'open', title: 'Open', icon: OpenWithIcon, shortcut: '⏎' },
  { key: 'edit', title: 'Edit', icon: EditIcon, shortcut: '⌘E' },
  { key: 'duplicate', title: 'Duplicate', icon: DuplicateIcon, shortcut: '⌘D' },
  { divider: true, key: 'd1' },
  {
    key: 'move',
    title: 'Move to…',
    icon: MoveToFolderIcon,
    submenu: [
      { key: 'docs', title: 'Documents', icon: FolderIcon },
      { key: 'pics', title: 'Pictures', icon: FolderIcon },
      { key: 'projects', title: 'Projects', icon: FolderIcon },
      { divider: true, key: 'd-m' },
      { key: 'new', title: 'New folder…', icon: FolderIcon },
    ],
  },
  {
    key: 'export',
    title: 'Export as',
    icon: UploadIcon,
    submenu: [
      { key: 'pdf', title: 'PDF document', icon: FilePresentIcon },
      { key: 'md', title: 'Markdown', icon: FilePresentIcon },
      { key: 'json', title: 'JSON', icon: CodeXmlIcon },
    ],
  },
  { divider: true, key: 'd2' },
  { key: 'properties', title: 'Properties', icon: PropertiesIcon, shortcut: '⌘I' },
  { divider: true, key: 'd3' },
  { key: 'delete', title: 'Delete', icon: DeleteIcon, color: 'error', shortcut: '⌫' },
]

const surfaceStyle =
  'padding:24px;border:1px dashed rgba(127,127,127,0.6);border-radius:8px;min-height:160px;display:flex;align-items:center;justify-content:center;color:rgba(127,127,127,0.9);font-size:13px;user-select:none'

// `onItemClick` is a story-only spy — the real ContextMenu has no such
// prop. Per-item handlers wire to it so the Actions panel shows which
// menu entry was activated during play.
type StoryArgs = {
  onOpen?: (e: MouseEvent) => void
  onItemClick?: (key: string) => void
}

export const Basic: Story = {
  args: {
    onOpen: fn(),
    onItemClick: fn(),
  } as StoryArgs,
  render: (args: StoryArgs) => ({
    setup() {
      const items: MenuItemConfig[] = fileItems.map((i) =>
        'title' in i && !('submenu' in i)
          ? { ...i, onClick: () => args.onItemClick?.((i as { key: string }).key) }
          : i
      )
      return () => (
        <div data-testid="surface" style={surfaceStyle}>
          Right-click anywhere in this box
          <ContextMenu items={items} onOpen={args.onOpen} />
        </div>
      )
    },
  }),
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)

    await step('right-click opens the menu and emits `open`', async () => {
      await rightClick(canvas.getByTestId('surface'))
      await waitFor(() => expect(args.onOpen).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(document.querySelector('.xomda-menu')).toBeTruthy())
    })

    await step('clicking "Edit" fires the per-item handler', async () => {
      const edit = await within(document.body).findByText('Edit')
      await fireEvent.click(edit)
      await waitFor(() => expect((args as StoryArgs).onItemClick).toHaveBeenCalledWith('edit'))
    })
  },
}

export const Nested: Story = {
  args: {
    onOpen: fn(),
    onItemClick: fn(),
  } as StoryArgs,
  render: (args: StoryArgs) => ({
    setup() {
      const wireClicks = (items: MenuItemConfig[]): MenuItemConfig[] =>
        items.map((i) => {
          if ('submenu' in i) return { ...i, submenu: wireClicks(i.submenu) } as MenuItemConfig
          if ('title' in i && !('subheader' in i))
            return { ...i, onClick: () => args.onItemClick?.((i as { key: string }).key) }
          return i
        })

      const outerItems: MenuItemConfig[] = wireClicks([
        { subheader: 'Workspace' },
        { key: 'new-file', title: 'New file', icon: FilePresentIcon, shortcut: '⌘N' },
        { key: 'new-folder', title: 'New folder', icon: FolderIcon, shortcut: '⇧⌘N' },
        { divider: true, key: 'd1' },
        {
          key: 'sort',
          title: 'Sort by',
          icon: PropertiesIcon,
          submenu: [
            { key: 'name', title: 'Name', checked: true },
            { key: 'date', title: 'Date modified' },
            { key: 'size', title: 'Size' },
          ],
        },
        { key: 'props', title: 'Workspace settings', icon: PropertiesIcon },
      ])

      const innerItems: MenuItemConfig[] = wireClicks([
        { subheader: 'File · report.md' },
        { key: 'open', title: 'Open', icon: OpenWithIcon, shortcut: '⏎' },
        { key: 'edit', title: 'Edit', icon: EditIcon, shortcut: '⌘E' },
        { key: 'duplicate', title: 'Duplicate', icon: DuplicateIcon, shortcut: '⌘D' },
        { divider: true, key: 'd1' },
        {
          key: 'export',
          title: 'Export as',
          icon: UploadIcon,
          submenu: [
            { key: 'pdf', title: 'PDF document', icon: FilePresentIcon },
            { key: 'md', title: 'Markdown', icon: FilePresentIcon },
            { key: 'json', title: 'JSON', icon: CodeXmlIcon },
          ],
        },
        { divider: true, key: 'd2' },
        { key: 'delete', title: 'Delete', icon: DeleteIcon, color: 'error', shortcut: '⌫' },
      ])

      const outerStyle =
        'padding:24px;border:1px dashed rgba(127,127,127,0.6);border-radius:8px;min-height:260px;display:flex;flex-direction:column;gap:16px;color:rgba(127,127,127,0.9);font-size:13px;user-select:none'
      const innerStyle =
        'padding:24px;border:1px dashed #f08;border-radius:8px;color:#f08;display:flex;align-items:center;justify-content:center;min-height:120px'
      return () => (
        <div data-testid="outer" style={outerStyle}>
          <div>Outer area — right-click anywhere outside the pink box (workspace menu)</div>
          <ContextMenu items={outerItems} onOpen={args.onOpen} />
          <div data-testid="inner" style={innerStyle}>
            Inner area — right-click here for the file menu
            <ContextMenu items={innerItems} onOpen={args.onOpen} />
          </div>
          <div style="font-size:11px;opacity:0.7">
            Try it: open one menu, then right-click in the other region. The first menu closes
            before the new one opens.
          </div>
        </div>
      )
    },
  }),
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)

    await step('right-click outer opens workspace menu', async () => {
      await rightClick(canvas.getByTestId('outer'))
      await waitFor(() => expect(body.queryByText('Workspace')).toBeTruthy())
    })

    await step('right-click inner opens file menu', async () => {
      await rightClick(canvas.getByTestId('inner'))
      await waitFor(() => expect(body.queryByText('File · report.md')).toBeTruthy())
    })

    await step('exactly one menu overlay is visible — the outer was closed', async () => {
      // `.xomda-menu` lingers in detached overlay portals; `.v-overlay--active`
      // is Vuetify's truth for "actually showing right now."
      await waitFor(() => expect(document.querySelectorAll('.v-overlay--active').length).toBe(1))
      expect(args.onOpen).toHaveBeenCalledTimes(2)
    })

    await step('clicking "Export as" reveals its submenu', async () => {
      // VMenu's `openOnHover` doesn't fire reliably from synthetic
      // pointer events; `openOnClick` is also set on the submenu so
      // we click instead — exercises the same submenu surface.
      const exportItem = await body.findByText('Export as')
      await fireEvent.click(exportItem)
      await waitFor(() => expect(body.queryByText('PDF document')).toBeTruthy())
    })
  },
}
