import type { CellOutput, Template, TemplateCell } from '@xomda/template'
import { executeTemplate } from '@xomda/template'
import { debounce } from 'lodash-es'
import { type MaybeRefOrGetter, onUnmounted, shallowRef, toValue, watch } from 'vue'

import { trpc } from '../trpc'

type Model = Awaited<ReturnType<typeof trpc.model.get.query>>

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
  let model: Model | null = null

  async function getModel(): Promise<Model> {
    if (!model) {
      model = await trpc.model.get.query()
    }
    return model
  }

  async function runPreview() {
    const t = toValue(template)
    if (!t) {
      previews.value = new Map()
      return
    }
    try {
      const m = await getModel()
      const all = flattenCells(t.cells)
      const map = new Map<string, CellPreview>(
        all.map((c) => [c.uuid, { cell: c, state: emptyState() }])
      )
      previews.value = map

      const result = await executeTemplate(t, m as never)
      const next = new Map(map)
      for (const out of result.cellOutputs) {
        const cell = next.get(out.uuid)?.cell
        if (cell) next.set(out.uuid, { cell, state: stateFromOutput(out) })
      }
      previews.value = next
    } catch {
      // don't clear existing output on transient errors
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
