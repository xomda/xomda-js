import type { Meta, StoryObj } from '@storybook/vue3'
import * as icons from '@xomda/icons'
import { computed, defineComponent, ref } from 'vue'
import { VBtn, VIcon, VTextField } from 'vuetify/components'

import { SvgIcon } from './components/SvgIcon'

interface IconEntry {
  name: string
  value: string
  kind: 'material' | 'devicon'
}

// Build the catalog once at module load — `@xomda/icons` exposes ~15k
// auto-generated Material Symbols + a handful of devicons. Discriminate
// on the leading `<` (same heuristic `PluginIcon` uses at runtime) so
// each entry knows whether to render via Vuetify's path-string set or
// via `SvgIcon`.
const allEntries: IconEntry[] = Object.entries(icons)
  .map(
    ([name, value]): IconEntry => ({
      name,
      value: value as string,
      kind: (value as string).startsWith('<') ? 'devicon' : 'material',
    })
  )
  .sort((a, b) => a.name.localeCompare(b.name))

// Hard cap on visible tiles. At ~15k Material icons, rendering them all
// freezes the browser; the user filters and pages through instead.
const PAGE_SIZE = 300

const Catalog = defineComponent({
  name: 'IconCatalog',
  props: {
    kind: { type: String as () => IconEntry['kind'] | 'all', default: 'all' },
    size: { type: Number, default: 32 },
  },
  setup(props) {
    const filter = ref('')
    const page = ref(0)

    const filtered = computed(() => {
      const needle = filter.value.trim().toLowerCase()
      return allEntries.filter((e) => {
        if (props.kind !== 'all' && e.kind !== props.kind) return false
        if (!needle) return true
        return e.name.toLowerCase().includes(needle)
      })
    })

    const visible = computed(() =>
      filtered.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE)
    )
    const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

    // Filter changes → snap back to page 0 so the user doesn't end up
    // on a now-empty page after typing.
    const onFilter = (v: string) => {
      filter.value = v
      page.value = 0
    }

    const copy = (name: string) => {
      void navigator.clipboard?.writeText(name)
    }

    return () => (
      <div style={{ padding: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ width: '320px' }}>
            <VTextField
              modelValue={filter.value}
              onUpdate:modelValue={onFilter}
              label="Filter by name"
              density="compact"
              hideDetails
              clearable
              placeholder="e.g. save, arrow-up, folder"
            />
          </div>
          <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            {filtered.value.length.toLocaleString()} match
            {filtered.value.length === 1 ? '' : 'es'}
            {props.kind === 'all' ? '' : ` (${props.kind})`}
            {totalPages.value > 1 && (
              <>
                {' '}
                · showing {(page.value * PAGE_SIZE + 1).toLocaleString()}–
                {Math.min((page.value + 1) * PAGE_SIZE, filtered.value.length).toLocaleString()}
              </>
            )}
          </div>
          {totalPages.value > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <VBtn
                size="small"
                variant="tonal"
                disabled={page.value === 0}
                onClick={() => (page.value = Math.max(0, page.value - 1))}
              >
                Prev
              </VBtn>
              <span style={{ fontSize: '0.875rem', minWidth: '80px', textAlign: 'center' }}>
                Page {page.value + 1} / {totalPages.value}
              </span>
              <VBtn
                size="small"
                variant="tonal"
                disabled={page.value >= totalPages.value - 1}
                onClick={() => (page.value = Math.min(totalPages.value - 1, page.value + 1))}
              >
                Next
              </VBtn>
            </div>
          )}
        </div>

        {filtered.value.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', opacity: 0.6 }}>
            No icons match “{filter.value}”.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '8px',
            }}
          >
            {visible.value.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => copy(entry.name)}
                title={`Click to copy "${entry.name}"`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '8px',
                  padding: '12px 8px',
                  background: 'rgba(0,0,0,0.02)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'inherit',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: `${props.size}px`,
                    height: `${props.size}px`,
                  }}
                >
                  {entry.kind === 'devicon' ? (
                    <SvgIcon svg={entry.value} size={props.size} />
                  ) : (
                    <VIcon icon={entry.value} size={props.size} />
                  )}
                </div>
                <code
                  style={{
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    lineHeight: 1.2,
                    opacity: 0.85,
                  }}
                >
                  {entry.name}
                </code>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  },
})

/**
 * Reference catalogue of every icon `@xomda/icons` exports — ~15k
 * Material Symbols (auto-generated from iconify) plus the brand
 * devicons. Click a tile to copy the export name. The shown name is
 * the exact import (`import { SaveIcon } from '@xomda/icons'`).
 *
 * Two underlying formats sit behind one import surface: Material
 * Symbols are path strings (rendered via Vuetify's `mdi-svg` iconset),
 * devicons are full multi-colour SVG markup (rendered via `SvgIcon`).
 * The catalog filters/paginates so even the full list stays usable.
 */
const meta: Meta<typeof Catalog> = {
  component: Catalog,
  title: 'Icons/Catalog',
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof Catalog>

export const All: Story = {
  args: { kind: 'all', size: 32 },
  render: (args) => ({
    components: { Catalog },
    setup: () => () => <Catalog {...args} />,
  }),
}

export const Material: Story = {
  args: { kind: 'material', size: 32 },
  render: (args) => ({
    components: { Catalog },
    setup: () => () => <Catalog {...args} />,
  }),
}

export const Devicons: Story = {
  args: { kind: 'devicon', size: 40 },
  render: (args) => ({
    components: { Catalog },
    setup: () => () => <Catalog {...args} />,
  }),
}
