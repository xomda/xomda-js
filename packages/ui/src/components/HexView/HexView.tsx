import { computed, defineComponent, type PropType } from 'vue'

import styles from './HexView.module.scss'

const BYTES_PER_ROW = 16

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0')
}

function toAscii(byte: number): string {
  return byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.'
}

interface HexRow {
  offset: string
  hex: string[]
  ascii: string
}

function chunkRows(bytes: Uint8Array, maxRows: number): HexRow[] {
  const rows: HexRow[] = []
  const limit = Math.min(bytes.length, maxRows * BYTES_PER_ROW)
  for (let i = 0; i < limit; i += BYTES_PER_ROW) {
    const slice = bytes.subarray(i, Math.min(i + BYTES_PER_ROW, limit))
    rows.push({
      offset: i.toString(16).padStart(8, '0'),
      hex: Array.from(slice, toHex),
      ascii: Array.from(slice, toAscii).join(''),
    })
  }
  return rows
}

/**
 * Read-only paged hex/ASCII view. Renders the first `maxRows * 16`
 * bytes; the file browser bounds the input size before handing the
 * payload to this component.
 */
export const HexView = defineComponent({
  name: 'HexView',
  props: {
    bytes: { type: Object as PropType<Uint8Array>, required: true },
    maxRows: { type: Number, default: 512 },
  },
  setup(props) {
    const rows = computed(() => chunkRows(props.bytes, props.maxRows))
    const truncated = computed(() => props.bytes.length > rows.value.length * BYTES_PER_ROW)
    return () => (
      <div class={styles.hexView}>
        <div class={styles.header}>
          <span>{`${props.bytes.length} bytes`}</span>
          {truncated.value && <span class={styles.truncated}>(truncated)</span>}
        </div>
        <div class={styles.body} role="grid">
          {rows.value.map((row) => (
            <div class={styles.row} key={row.offset} role="row">
              <span class={styles.offset}>{row.offset}</span>
              <span class={styles.hex}>
                {row.hex.map((h, i) => (
                  <span class={styles.byte} key={i}>
                    {h}
                  </span>
                ))}
              </span>
              <span class={styles.ascii}>{row.ascii}</span>
            </div>
          ))}
        </div>
      </div>
    )
  },
})
