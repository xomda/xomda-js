import type { Model } from '@xomda/core'
import type { CellOutput, Template, TemplateCell } from '@xomda/template'
import { executeTemplate } from '@xomda/template'
import { createLogger } from '@xomda/util'
import { debounce } from 'lodash-es'
import { type MaybeRefOrGetter, onUnmounted, shallowRef, toValue, watch } from 'vue'

import { trpc } from '../trpc'

const logger = createLogger('useTemplatePreview')

export interface CellPreviewState {
  output: string
  contextDiff: Record<string, unknown>
  consoleLogs: string[]
  error: string | undefined
  done: boolean
}

export interface CellPreview {
  cell: TemplateCell
  state: CellPreviewState
}

function emptyState(): CellPreviewState {
  return { output: '', contextDiff: {}, consoleLogs: [], error: undefined, done: false }
}

function stateFromOutput(o: CellOutput): CellPreviewState {
  return {
    output: o.output,
    contextDiff: o.contextDiff ?? {},
    consoleLogs: o.consoleLogs ?? [],
    error: o.error,
    done: true,
  }
}

function flattenCells(cells: TemplateCell[], out: TemplateCell[] = []): TemplateCell[] {
  for (const c of cells) {
    out.push(c)
    if (c.children?.length) flattenCells(c.children, out)
  }
  return out
}

export function useTemplatePreview(template: MaybeRefOrGetter<Template | null>) {
  const previews = shallowRef<Map<string, CellPreview>>(new Map())

  // Fetch the model on every preview run. Caching it for the composable's
  // lifetime would silently render the preview against a stale schema
  // whenever the user edits entities/enums in ModelView between previews.
  // The 300 ms debounce on `runPreview` keeps the request rate sane;
  // model.get is a cheap read-from-disk on the server. When a Pinia
  // `useModelStore` lands, swap this for a subscription to that store.
  // The tRPC-inferred return type round-trips through Zod and is structurally
  // identical to Model from @xomda/core but TS infers it as a separate
  // (sometimes readonly-wrapped) shape. Re-narrow at the boundary so the rest
  // of the composable is typed against the canonical Model.
  async function fetchModel(): Promise<Model> {
    return (await trpc.model.get.query()) as Model
  }

  async function runPreview() {
    const t = toValue(template)
    if (!t) {
      // shallowRef triggers downstream effects on every assignment regardless
      // of value equality. A null → null watcher fire would otherwise cause
      // a no-op re-render across every consumer of `previews`.
      if (previews.value.size !== 0) previews.value = new Map()
      return
    }
    try {
      const m = await fetchModel()
      const all = flattenCells(t.cells)
      const map = new Map<string, CellPreview>(
        all.map((c) => [c.uuid, { cell: c, state: emptyState() }])
      )
      previews.value = map

      const result = await executeTemplate(t, m)
      const next = new Map(map)
      for (const out of result.cellOutputs) {
        const cell = next.get(out.uuid)?.cell
        if (cell) next.set(out.uuid, { cell, state: stateFromOutput(out) })
      }
      previews.value = next
    } catch (e) {
      // Don't clear existing output on transient errors so the user keeps
      // a useful preview while editing — but log to LogsView so the
      // underlying failure is observable instead of silent.
      logger.debug('template preview failed', { data: e })
    }
  }

  const debouncedRun = debounce(runPreview, 300)

  const stop = watch(() => toValue(template), debouncedRun, { deep: true, immediate: true })

  onUnmounted(() => {
    stop()
    debouncedRun.cancel()
  })

  return previews
}
